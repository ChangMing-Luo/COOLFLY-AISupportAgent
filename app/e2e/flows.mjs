/**
 * v4 验收契约的闭环端到端（真实后端 + 真实 PostgreSQL + Zendesk 沙箱 + 真实千问）。
 * 对应 doc/v4/SPEC-v4.md §8：FLOW-01…10 / RULE-01…05。
 * 跑法：pnpm -C app db:seed && node e2e/flows.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3311';
const PWD = process.env.SEED_PASSWORD ?? 'Coolfly@2026';

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
  async login(email) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PWD }),
    });
    if (!res.ok) throw new Error(`${this.name} 登录失败 ${res.status}`);
    this.cookie = (res.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');
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

const admin = new Session('陈默');
const ops = new Session('林静');
await admin.login('chenmo@coolfly.com');
await ops.login('linjing@coolfly.com');

/* ══════ RULE-03 未登录一律 401 ══════ */
{
  const res = await fetch(`${API}/api/entries?view=all`);
  record('RULE-03', res.status === 401, `未登录访问 /api/entries → ${res.status}`);
}

/* ══════ RULE-01 ops 越权访问系统管理 → 403 ══════ */
{
  const r = await ops.get('/api/admin/users');
  record('RULE-01', r.status === 403, `林静（知识运营）访问 /api/admin/users → ${r.status} ${r.body.message ?? ''}`);
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
    r.status === 200 && draftCode && r.body.entry.source.includes(cand.code) && after.body.candidates.length === task.body.candidates.length - 1,
    `候选 ${cand.code} → ${draftCode}，来源「${r.body.entry?.source}」，剩余候选 ${after.body.candidates.length}`,
  );
}

/* ══════ FLOW-02 缺英文 → 提交被拒 ══════ */
{
  const r = await admin.post(`/api/entries/${draftCode}/submit`);
  const errs = r.body.errors ?? [];
  record(
    'FLOW-02',
    r.status === 422 && errs.some((e) => e.includes('英文')),
    `未翻译提交 → ${r.status}，校验项：${errs.join(' / ')}`,
  );
}

/* ══════ FLOW-03 翻译 ══════ */
{
  const r = await admin.post(`/api/entries/${draftCode}/translate`);
  const e = r.body.entry ?? {};
  record(
    'FLOW-03',
    r.status === 200 && e.translated && e.titleEn && /[A-Za-z]/.test(e.titleEn),
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
  const logs = await admin.get('/api/sync/logs');
  const rec = logs.body.logs.find((l) => l.entryCode === draftCode);
  record(
    'FLOW-05',
    e.syncStatus === 'synced' && Boolean(log) && Boolean(rec) && rec.durationMs >= 0 && rec.payloadNo.startsWith('#'),
    `同步状态 ${e.syncLabel}，日志「${log?.label}」报文 ${rec?.payloadNo} 耗时 ${rec?.durationMs}ms`,
  );
}

/* ══════ FLOW-06 驳回必须带意见 + 回写草稿 ══════ */
{
  const queue = await admin.get('/api/entries?view=queue');
  const target = queue.body.entries[0];
  const noComment = await admin.post(`/api/entries/${target.code}/reject`, { comment: '' });
  const ok = await admin.post(`/api/entries/${target.code}/reject`, { comment: '费率与新政策不符' });
  const detail = await admin.get(`/api/entries/${target.code}`);
  record(
    'FLOW-06',
    noComment.status === 400 && ok.status === 200 && detail.body.entry.status === 'rejected' && detail.body.entry.rejectReason === '费率与新政策不符',
    `空意见 → ${noComment.status}；带意见 → ${target.code} 状态 ${detail.body.entry.statusLabel}，意见「${detail.body.entry.rejectReason}」`,
  );
}

/* ══════ FLOW-07 反馈拉取 + 去修复 ══════ */
{
  const pull = await admin.post('/api/feedback/pull');
  const list = await admin.get('/api/feedback');
  const open = list.body.feedbacks.find((f) => f.state === 'open');
  const before = await admin.get(`/api/entries/${open.entryCode}`);
  const fix = await admin.post(`/api/feedback/${open.code}/fix`);
  const after = await admin.get(`/api/entries/${open.entryCode}`);
  const fbAfter = (await admin.get('/api/feedback')).body.feedbacks.find((f) => f.code === open.code);
  record(
    'FLOW-07',
    pull.status === 200 && fix.status === 200 && after.body.entry.status === 'draft' && fbAfter.state === 'fixing' &&
      after.body.entry.version !== before.body.entry.version === (before.body.entry.status === 'published'),
    `拉取返回「${pull.body.note}」；${open.code} 去修复 → ${open.entryCode} ${before.body.entry.version}→${after.body.entry.version} 状态 ${after.body.entry.statusLabel}，反馈置 ${fbAfter.stateLabel}`,
  );
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
    `${m.code} → ${r.body.entry?.code}（来源「${r.body.entry?.source}」），未命中置 ${after.stateLabel}`,
  );
}

/* ══════ FLOW-09 回滚必须过审 ══════ */
{
  const detail = await admin.get('/api/entries/KB-20418');
  const target = detail.body.versions.find((v) => !v.isCurrent && v.version === 'v3.1');
  const sub = await admin.post('/api/entries/KB-20418/rollback', { version: target.version });
  const pending = await admin.get('/api/entries/KB-20418');
  const review = await admin.get('/api/entries/KB-20418/review');
  const ap = await admin.post('/api/entries/KB-20418/approve');
  const after = await admin.get('/api/entries/KB-20418');
  const bodyReverted = after.body.paragraphsZh.every((p) => !p.includes('24 小时至 4 小时按 20%'));
  record(
    'FLOW-09',
    sub.status === 200 && pending.body.entry.status === 'pending' && pending.body.entry.pendingKind === 'rollback' &&
      review.body.diff.label.includes('回滚审核') && ap.status === 200 &&
      after.body.entry.version === 'v3.1' && bodyReverted && after.body.entry.syncStatus === 'synced',
    `提交后状态 ${pending.body.entry.statusLabel}(${pending.body.entry.pendingKind})，diff「${review.body.diff.label}」，过审后版本 ${after.body.entry.version} 内容已回退=${bodyReverted} 同步 ${after.body.entry.syncLabel}`,
  );
}

/* ══════ FLOW-10 下线 → 恢复 ══════ */
{
  const off = await admin.post('/api/entries/KB-20460/offline');
  const offList = await admin.get('/api/entries?view=offline');
  const inOffline = offList.body.entries.some((x) => x.code === 'KB-20460');
  const back = await admin.post('/api/entries/KB-20460/restore');
  const after = await admin.get('/api/entries/KB-20460');
  record(
    'FLOW-10',
    off.status === 200 && off.body.entry.status === 'offline' && off.body.entry.syncStatus === 'none' &&
      inOffline && back.status === 200 && after.body.entry.status === 'draft',
    `下线 → ${off.body.entry.statusLabel}/${off.body.entry.syncLabel}，已下线页可见=${inOffline}，恢复 → ${after.body.entry.statusLabel}`,
  );
}

/* ══════ RULE-04 新增分类/场景 → 建 Zendesk 目录 ══════ */
{
  const cat = await admin.post('/api/meta/categories', { nameZh: '验收测试分类', nameEn: 'Acceptance Test Category' });
  const scene = await admin.post('/api/meta/scenes', {
    nameZh: '验收测试场景',
    nameEn: 'Acceptance Test Scene',
    categoryId: cat.body.category.id,
  });
  const created = await admin.post('/api/entries', {
    titleZh: '验收测试知识：目录同步校验',
    bodyZh: '一、适用范围。本条目仅用于验收 Zendesk 目录懒创建。\n\n二、处理规则。发布后应在 Zendesk 建出对应 Category 与 Section。',
    categoryId: cat.body.category.id,
    sceneId: scene.body.scene.id,
  });
  const code = created.body.entry.code;
  await admin.post(`/api/entries/${code}/translate`);
  await admin.post(`/api/entries/${code}/submit`);
  await admin.post(`/api/entries/${code}/approve`);
  const detail = await admin.get(`/api/entries/${code}`);
  const scenes = await admin.get('/api/meta/scenes');
  const s = scenes.body.scenes.find((x) => x.id === scene.body.scene.id);
  record(
    'RULE-04',
    detail.body.entry.syncStatus === 'synced' && Boolean(s.zendeskRef),
    `${code} 同步 ${detail.body.entry.syncLabel}，场景「${s.nameZh}」已挂 Zendesk Section ${s.zendeskRef}`,
  );
}

/* ══════ RULE-05 标签不翻译、不进 Zendesk ══════ */
{
  const tags = await admin.get('/api/meta/tags');
  const hasEnField = Object.prototype.hasOwnProperty.call(tags.body.tags[0] ?? {}, 'nameEn');
  const tr = await admin.post('/api/meta/translate', { text: '改签', kind: '标签' });
  record(
    'RULE-05',
    !hasEnField && tr.status === 400,
    `标签对象无英文字段=${!hasEnField}；对标签调翻译端点 → ${tr.status}（仅分类/场景可翻译）`,
  );
}

/* ══════ RULE-02 审计 append-only（写操作留痕 + 接口层无修改路径） ══════ */
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
