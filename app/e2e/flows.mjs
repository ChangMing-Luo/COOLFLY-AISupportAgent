/**
 * v4 验收契约的闭环端到端（真实后端 + 真实 PostgreSQL + Zendesk 沙箱 + 真实千问）。
 * 对应 doc/v4/SPEC-v4.md §8：FLOW-01…10 / RULE-01…05。
 *
 * 自带 fixture：不依赖任何演示种子——分类/场景由接口建，抽取候选、未命中、反馈
 * 全部由**真实管道**从 Zendesk 沙箱语料生成，跑的就是生产同一条代码路径。
 *
 * 跑法：ZENDESK_FORCE_SANDBOX=1 起服务，然后
 *   E2E_PASSWORD=<超管密码> node e2e/flows.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3311';
const PWD = process.env.E2E_PASSWORD;
if (!PWD) {
  console.error('缺少 E2E_PASSWORD（超级管理员密码）。示例：E2E_PASSWORD=xxx node e2e/flows.mjs');
  process.exit(1);
}

// 安全闸：本套会建条目、发布、下线，跑在 live 上会把测试内容写进真实帮助中心。
{
  const health = await (await fetch(`${API}/healthz`)).json();
  if (health.zendesk !== 'sandbox') {
    console.error(
      `拒绝执行：服务端 Zendesk 模式为「${health.zendesk}」。` +
        '请用 ZENDESK_FORCE_SANDBOX=1 重启服务后再跑本套闭环用例。',
    );
    process.exit(1);
  }
}

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

class Session {
  constructor(name) {
    this.name = name;
    this.cookie = '';
  }
  async login(email, password = PWD) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`${this.name} 登录失败 ${res.status}`);
    this.cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
    return (await res.json()).user;
  }
  async req(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { cookie: this.cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : {} };
  }
  get = (p) => this.req('GET', p);
  post = (p, b) => this.req('POST', p, b);
  put = (p, b) => this.req('PUT', p, b);
}

const admin = new Session('超级管理员');
const ops = new Session('知识运营');
await admin.login(process.env.E2E_SUPER_EMAIL ?? 'admin@coolfly.com');
await ops.login(process.env.E2E_OPS_EMAIL ?? 'ops@coolfly.com', process.env.E2E_OPS_PASSWORD ?? PWD);

/* ══════════ fixture：全部由真实管道生成 ══════════ */
const stamp = String(Date.now()).slice(-6);
const cat = (await admin.post('/api/meta/categories', { nameZh: `验收分类 ${stamp}`, nameEn: `Acceptance ${stamp}` }))
  .body.category;
const scene = (
  await admin.post('/api/meta/scenes', {
    nameZh: `验收场景 ${stamp}`,
    nameEn: `Acceptance Scene ${stamp}`,
    categoryId: cat.id,
  })
).body.scene;
const collect = await admin.post('/api/collect/run');
const missRefresh = await admin.post('/api/misses/refresh');
console.log(
  `fixture：分类 ${cat.code} / 场景 ${scene.code} / 抽取候选 ${collect.body.candidates?.length ?? 0} 条 / 未命中新增 ${missRefresh.body.created ?? 0} 条\n`,
);

const NEW_BODY = [
  '一、适用范围。本条款适用于 COOLFLY 平台的验收场景。',
  '二、处理规则。旅客可在起飞前通过 App 提交申请，系统在 30 分钟内反馈结果。',
  '三、特殊情形。因承运人原因导致的变更不收取任何费用。',
].join('\n\n');

/** 走完整闭环把一条草稿推到已发布 */
async function publishNew(title, body = NEW_BODY) {
  const created = await admin.post('/api/entries', {
    titleZh: title,
    bodyZh: body,
    categoryId: cat.id,
    sceneId: scene.id,
  });
  const code = created.body.entry.code;
  await admin.post(`/api/entries/${code}/translate`);
  await admin.post(`/api/entries/${code}/submit`);
  await admin.post(`/api/entries/${code}/approve`, { comment: '验收发布' });
  return code;
}

/* ══════ RULE-03 未登录一律 401 ══════ */
{
  const res = await fetch(`${API}/api/entries?view=all`);
  record('RULE-03', res.status === 401, `未登录访问 /api/entries → ${res.status}`);
}

/* ══════ RULE-01 ops 越权访问系统管理 → 403 ══════ */
{
  const r = await ops.get('/api/admin/users');
  record('RULE-01', r.status === 403, `知识运营访问 /api/admin/users → ${r.status} ${r.body.message ?? ''}`);
}

/* ══════ FLOW-01 候选采纳 → 草稿 ══════ */
let draftCode = '';
{
  const task = await admin.get('/api/collect/task');
  const cand = task.body.candidates[0];
  const r = await admin.post(`/api/collect/candidates/${cand.code}/accept`);
  draftCode = r.body.entry?.code ?? '';
  const after = await admin.get('/api/collect/task');
  record(
    'FLOW-01',
    r.status === 200 && Boolean(draftCode) && r.body.entry.source.includes(cand.code) &&
      after.body.candidates.length === task.body.candidates.length - 1,
    `候选 ${cand.code}「${cand.title}」→ ${draftCode}，来源「${r.body.entry?.source}」，剩余候选 ${after.body.candidates.length}`,
  );
}

/* ══════ FLOW-02 缺英文 → 提交被拒 ══════ */
{
  await admin.put(`/api/entries/${draftCode}`, {
    titleZh: '验收：抽取候选转草稿后补全',
    titleEn: '',
    bodyZh: NEW_BODY,
    bodyEn: '',
    categoryId: cat.id,
    sceneId: scene.id,
    tags: ['验收'],
    note: '',
  });
  const r = await admin.post(`/api/entries/${draftCode}/submit`);
  const errs = r.body.errors ?? [];
  record('FLOW-02', r.status === 422 && errs.some((e) => e.includes('英文')), `未翻译提交 → ${r.status}，校验项：${errs.join(' / ')}`);
}

/* ══════ FLOW-03 真实大模型翻译 ══════ */
{
  const r = await admin.post(`/api/entries/${draftCode}/translate`);
  const e = r.body.entry ?? {};
  record(
    'FLOW-03',
    r.status === 200 && e.translated && Boolean(e.titleEn) && /[A-Za-z]/.test(e.titleEn),
    `翻译（${r.body.mode}）→ 英文标题「${e.titleEn}」`,
  );
}

/* ══════ FLOW-04 提交 → 待审 → 通过 → 大版本 +1 ══════ */
{
  const sub = await admin.post(`/api/entries/${draftCode}/submit`);
  const queue = await admin.get('/api/entries?view=queue');
  const inQueue = queue.body.entries.some((x) => x.code === draftCode);
  const ap = await admin.post(`/api/entries/${draftCode}/approve`, { comment: '内容准确，通过发布' });
  const detail = await admin.get(`/api/entries/${draftCode}`);
  const v = detail.body.entry.version;
  const versionRow = detail.body.versions.find((x) => x.version === v && x.act === '发布');
  record(
    'FLOW-04',
    sub.status === 200 && inQueue && ap.status === 200 && v === 'v1.0' && Boolean(versionRow),
    `提交进队列=${inQueue}，通过后版本 ${v}，版本历史含「${versionRow?.note ?? '—'}」`,
  );
}

/* ══════ FLOW-05 发布即同步 + 报文级日志 ══════ */
{
  const detail = await admin.get(`/api/entries/${draftCode}`);
  const e = detail.body.entry;
  const log = detail.body.syncLogs[0];
  const rec = (await admin.get('/api/sync/logs')).body.logs.find((l) => l.entryCode === draftCode);
  record(
    'FLOW-05',
    e.syncStatus === 'synced' && Boolean(log) && Boolean(rec) && rec.durationMs >= 0 && rec.payloadNo.startsWith('#'),
    `同步状态 ${e.syncLabel}，日志「${log?.label}」报文 ${rec?.payloadNo} 耗时 ${rec?.durationMs}ms`,
  );
}

/* ══════ FLOW-06 驳回必须带意见 + 回写草稿 ══════ */
{
  const created = await admin.post('/api/entries', {
    titleZh: '验收：待驳回条目',
    bodyZh: NEW_BODY,
    categoryId: cat.id,
    sceneId: scene.id,
  });
  const code = created.body.entry.code;
  await admin.post(`/api/entries/${code}/translate`);
  await admin.post(`/api/entries/${code}/submit`);
  const noComment = await admin.post(`/api/entries/${code}/reject`, { comment: '' });
  const ok = await admin.post(`/api/entries/${code}/reject`, { comment: '费率与新政策不符' });
  const detail = await admin.get(`/api/entries/${code}`);
  record(
    'FLOW-06',
    noComment.status === 400 && ok.status === 200 && detail.body.entry.status === 'rejected' &&
      detail.body.entry.rejectReason === '费率与新政策不符',
    `空意见 → ${noComment.status}；带意见 → ${code} 状态 ${detail.body.entry.statusLabel}，意见「${detail.body.entry.rejectReason}」`,
  );
}

/* ══════ FLOW-07 反馈拉取（真实投票增量）+ 去修复 ══════ */
{
  const pull = await admin.post('/api/feedback/pull');
  const list = await admin.get('/api/feedback');
  const open = list.body.feedbacks.find((f) => f.state === 'open');
  if (!open) {
    record('FLOW-07', false, `拉取返回「${pull.body.note}」，但没有待处理反馈`);
  } else {
    const before = await admin.get(`/api/entries/${open.entryCode}`);
    const fix = await admin.post(`/api/feedback/${open.code}/fix`);
    const after = await admin.get(`/api/entries/${open.entryCode}`);
    const fbAfter = (await admin.get('/api/feedback')).body.feedbacks.find((f) => f.code === open.code);
    record(
      'FLOW-07',
      pull.status === 200 && pull.body.created > 0 && fix.status === 200 &&
        after.body.entry.status === 'fixing' && fbAfter.state === 'fixing',
      `拉取「${pull.body.note}」；${open.code} 去修复 → ${open.entryCode} ${before.body.entry.version}→${after.body.entry.version} 状态 ${after.body.entry.statusLabel}，反馈置 ${fbAfter.stateLabel}`,
    );
  }
}

/* ══════ FLOW-08 未命中建条目 ══════ */
{
  const misses = await admin.get('/api/misses');
  const m = misses.body.misses.find((x) => x.state === 'open');
  const r = await admin.post(`/api/misses/${m.code}/draft`);
  const after = (await admin.get('/api/misses')).body.misses.find((x) => x.code === m.code);
  record(
    'FLOW-08',
    r.status === 200 && r.body.entry.source === `未命中 ${m.code}` && after.state === 'planned',
    `${m.code}「${m.question}」→ ${r.body.entry?.code}（来源「${r.body.entry?.source}」），未命中置 ${after.stateLabel}`,
  );
}

/* ══════ FLOW-09 回滚必须过审，且内容真回退 ══════ */
{
  const code = await publishNew('验收：版本回滚链路', NEW_BODY);
  // 造第二个已发布版本：修订 → 改正文 → 提交 → 通过（v1.0 → v2.0）
  await admin.post(`/api/entries/${code}/revise`);
  await admin.put(`/api/entries/${code}`, {
    titleZh: '验收：版本回滚链路',
    titleEn: 'Acceptance: rollback path',
    bodyZh: `${NEW_BODY}\n\n四、生效日期。本版新增条款，回滚后应当消失。`,
    bodyEn: '<p>I. Scope.</p><p>II. Handling.</p><p>III. Special cases.</p><p>IV. Effective date (added).</p>',
    categoryId: cat.id,
    sceneId: scene.id,
    tags: [],
    note: '新增生效日期条款',
  });
  await admin.post(`/api/entries/${code}/submit`);
  await admin.post(`/api/entries/${code}/approve`, { comment: '新增条款，通过' });

  const sub = await admin.post(`/api/entries/${code}/rollback`, { version: 'v1.0' });
  const pending = await admin.get(`/api/entries/${code}`);
  const review = await admin.get(`/api/entries/${code}/review`);
  const ap = await admin.post(`/api/entries/${code}/approve`);
  const after = await admin.get(`/api/entries/${code}`);
  const reverted = after.body.paragraphsZh.every((p) => !p.includes('回滚后应当消失'));
  record(
    'FLOW-09',
    sub.status === 200 && pending.body.entry.status === 'pending' && pending.body.entry.pendingKind === 'rollback' &&
      review.body.diff.label.includes('回滚审核') && ap.status === 200 &&
      after.body.entry.version === 'v1.0' && reverted && after.body.entry.syncStatus === 'synced',
    `提交后 ${pending.body.entry.statusLabel}(${pending.body.entry.pendingKind})，diff「${review.body.diff.label}」；过审后版本 ${after.body.entry.version} 内容已回退=${reverted} 同步 ${after.body.entry.syncLabel}`,
  );
}

/* ══════ FLOW-10 下线 → 恢复 ══════ */
{
  const code = await publishNew('验收：下线与恢复链路');
  const off = await admin.post(`/api/entries/${code}/offline`);
  const inOffline = (await admin.get('/api/entries?view=offline')).body.entries.some((x) => x.code === code);
  const back = await admin.post(`/api/entries/${code}/restore`);
  const after = await admin.get(`/api/entries/${code}`);
  const archiveLog = (await admin.get('/api/sync/logs')).body.logs.find(
    (l) => l.entryCode === code && l.objectLabel.includes('归档'),
  );
  record(
    'FLOW-10',
    off.status === 200 && off.body.entry.status === 'offline' && off.body.entry.syncStatus === 'none' &&
      inOffline && back.status === 200 && after.body.entry.status === 'draft' && Boolean(archiveLog),
    `下线 → ${off.body.entry.statusLabel}/${off.body.entry.syncLabel}，归档留痕「${archiveLog?.objectLabel}」，已下线页可见=${inOffline}，恢复 → ${after.body.entry.statusLabel}`,
  );
}

/* ══════ RULE-04 新增分类/场景 → 懒创建 Zendesk 目录 ══════ */
{
  const scenes = await admin.get('/api/meta/scenes');
  const s = scenes.body.scenes.find((x) => x.id === scene.id);
  const cats = await admin.get('/api/meta/categories');
  const c = cats.body.categories.find((x) => x.id === cat.id);
  record(
    'RULE-04',
    Boolean(s.zendeskRef) && Boolean(c.zendeskRef),
    `分类「${c.nameZh}」→ Category ${c.zendeskRef}；场景「${s.nameZh}」→ Section ${s.zendeskRef}`,
  );
}

/* ══════ RULE-05 标签不翻译、不进 Zendesk ══════ */
{
  const tags = await admin.get('/api/meta/tags');
  const hasEnField = Object.prototype.hasOwnProperty.call(tags.body.tags[0] ?? {}, 'nameEn');
  const tr = await admin.post('/api/meta/translate', { text: '改签', kind: '标签' });
  record('RULE-05', !hasEnField && tr.status === 400, `标签对象无英文字段=${!hasEnField}；对标签调翻译端点 → ${tr.status}（仅分类/场景可翻译）`);
}

/* ══════ RULE-02 审计 append-only ══════ */
{
  const before = (await admin.get('/api/admin/audit')).body.logs;
  const created = await admin.post('/api/entries', { titleZh: '审计增量校验条目' });
  const after = (await admin.get('/api/admin/audit')).body.logs;
  const newRow = after.find((l) => l.objCode === created.body.entry.code && l.act === '新建条目');
  const putAudit = await admin.put('/api/admin/audit', {});
  record(
    'RULE-02',
    after.length === before.length + 1 && Boolean(newRow) && putAudit.status === 404,
    `审计条数 ${before.length} → ${after.length}，新增「${newRow?.act} ${newRow?.obj}」；PUT /api/admin/audit → ${putAudit.status}（无修改路径）`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
if (failed.length) {
  console.log('失败项：', failed.map((f) => f.id).join(', '));
  process.exit(1);
}
