import { DEFAULT_PERMISSION_MATRIX, PERMISSIONS, ROLES } from '@kb/contracts';
import { pool, query, newId } from './pool.js';
import { hashPassword } from '../core/auth.js';
import { embed, toPgVector } from '../integrations/embedding.js';
import { contentHash, toPlainText, toPublicHtml } from '../core/content.js';
import { getZendesk } from '../integrations/zendesk.js';

const INITIAL_PASSWORD = process.env.SEED_PASSWORD ?? 'Coolfly@2026';

async function seedMatrix(): Promise<void> {
  for (const p of PERMISSIONS) {
    for (const r of ROLES) {
      await query(
        `INSERT INTO permission_matrix (permission, role, allowed) VALUES ($1,$2,$3)
         ON CONFLICT (permission, role) DO NOTHING`,
        [p, r, DEFAULT_PERMISSION_MATRIX[p][r]],
      );
    }
  }
}

async function main(): Promise<void> {
  await query('TRUNCATE sessions, translation_pairs, sync_tasks, sync_mappings, drift_records, entry_vectors, entry_versions, version_metrics, entry_effect_metrics, signal_events, mining_candidates, mining_batches, revision_candidates, knowledge_gaps, no_result_keywords, coverage_scenes, signal_matrix, audit_logs CASCADE');
  await query('DELETE FROM entries');
  await query('DELETE FROM chapters');
  await query('DELETE FROM libraries');
  await query('DELETE FROM users');
  await seedMatrix();

  // ===== 用户（RBAC 四角色真实账号；首次登录强制改密） =====
  const pwd = await hashPassword(INITIAL_PASSWORD);
  const users = [
    { id: 'usr_wangwen', name: '王雯', email: 'wangwen@coolfly.com', role: 'kb_manager', must: false },
    { id: 'usr_lixiao', name: '李骁', email: 'lixiao@coolfly.com', role: 'kb_reviewer', must: false },
    { id: 'usr_lizhen', name: '李真', email: 'lizhen@coolfly.com', role: 'kb_reviewer', must: false },
    { id: 'usr_chendi', name: '陈迪', email: 'chendi@coolfly.com', role: 'ai_ops', must: false },
    { id: 'usr_ken', name: '运维 Ken', email: 'ken@coolfly.com', role: 'sys_admin', must: false },
  ];
  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, library_scope, must_change_password, last_active_at)
       VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,$6, now())`,
      [u.id, u.name, u.email, pwd, u.role, u.must],
    );
  }

  // ===== 知识库与结构树 =====
  const libs = [
    { id: 'lib_policy', name: '政策与售后知识库', note: '退款/退货/保修口径 · 含仅内部条目', internal: false, order: 1 },
    { id: 'lib_product', name: '产品与使用知识库', note: '安装、配网、画质、会员', internal: false, order: 2 },
    { id: 'lib_script', name: '客服话术库（仅内部）', note: '不对外公开，仅挂客服 segment', internal: true, order: 3 },
  ];
  for (const l of libs) {
    await query('INSERT INTO libraries (id, name, note, internal_only, sort_order) VALUES ($1,$2,$3,$4,$5)', [
      l.id, l.name, l.note, l.internal, l.order,
    ]);
  }

  const chapters = [
    { id: 'ch_after', lib: 'lib_policy', parent: null, name: '售后政策', ref: null, order: 1 },
    { id: 'ch_refund', lib: 'lib_policy', parent: 'ch_after', name: '退款与退货', ref: 'Sec 5101', order: 2 },
    { id: 'ch_warranty', lib: 'lib_policy', parent: 'ch_after', name: '保修与换新', ref: 'Sec 5102', order: 3 },
    { id: 'ch_order', lib: 'lib_policy', parent: null, name: '订单与物流', ref: null, order: 4 },
    { id: 'ch_ship', lib: 'lib_policy', parent: 'ch_order', name: '发货与签收', ref: 'Sec 5110', order: 5 },
    { id: 'ch_member', lib: 'lib_policy', parent: null, name: '会员与账户', ref: null, order: 6 },
    { id: 'ch_billing', lib: 'lib_policy', parent: 'ch_member', name: '会员计费', ref: 'Sec 5120', order: 7 },
    { id: 'ch_setup', lib: 'lib_product', parent: null, name: '网络与配对', ref: null, order: 8 },
    { id: 'ch_wifi', lib: 'lib_product', parent: 'ch_setup', name: 'Wi-Fi 配对', ref: 'Sec 5130', order: 9 },
    { id: 'ch_power', lib: 'lib_product', parent: null, name: '供电', ref: null, order: 10 },
    { id: 'ch_solar', lib: 'lib_product', parent: 'ch_power', name: '太阳能', ref: 'Sec 5140', order: 11 },
    { id: 'ch_script', lib: 'lib_script', parent: null, name: '内部话术', ref: null, order: 12 },
    { id: 'ch_script_refund', lib: 'lib_script', parent: 'ch_script', name: '退款沟通话术', ref: 'Sec 5201', order: 13 },
  ];
  for (const c of chapters) {
    await query(
      'INSERT INTO chapters (id, library_id, parent_id, name, zendesk_section_ref, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
      [c.id, c.lib, c.parent, c.name, c.ref, c.order],
    );
  }

  // ===== 条目（对齐 v3 原型 ENTRIES 语义） =====
  interface SeedEntry {
    id: string; code: string; title: string; lib: string; chapter: string; type: string;
    visibility: 'public' | 'internal' | 'mixed'; status: string; enStatus: string; syncStatus: string;
    vectorStatus: string; version: number; sceneL1: string; sceneL2: string; labels: string[];
    dueDays: number; paragraphs: Array<{ text: string; internal?: boolean; heading?: boolean }>;
    owner: string;
  }
  const entries: SeedEntry[] = [
    {
      id: 'ent_0201', code: 'KB-0201', title: '退款政策', lib: 'lib_policy', chapter: 'ch_refund',
      type: 'FAQ 政策型', visibility: 'mixed', status: 'published', enStatus: 'synced', syncStatus: 'synced',
      vectorStatus: 'ready', version: 2, sceneL1: '售后与退款', sceneL2: '退款时限',
      labels: ['退款', '退货', '运费'], dueDays: 114, owner: 'usr_wangwen',
      paragraphs: [
        { text: '退款时限', heading: true },
        { text: '质量问题：签收后 30 天内可申请全额退款，运费由公司承担。' },
        { text: '非质量问题：签收后 5 天内可退，运费由用户承担。' },
        { text: '会员服务：按自然月退订。' },
        { text: '内部：超时个案走主管审批，额度上限 $80。', internal: true },
      ],
    },
    {
      id: 'ent_0188', code: 'KB-0188', title: '保修期与凭证要求', lib: 'lib_policy', chapter: 'ch_warranty',
      type: 'FAQ 政策型', visibility: 'public', status: 'published', enStatus: 'synced', syncStatus: 'synced',
      vectorStatus: 'ready', version: 3, sceneL1: '售后与退款', sceneL2: '保修换新',
      labels: ['保修', '凭证'], dueDays: 47, owner: 'usr_wangwen',
      paragraphs: [
        { text: '保修范围', heading: true },
        { text: '整机自签收之日起保修 12 个月，配件保修 6 个月。' },
        { text: '申请保修需提供订单号与设备序列号照片。' },
      ],
    },
    {
      id: 'ent_0240', code: 'KB-0240', title: '会员退订与计费周期', lib: 'lib_policy', chapter: 'ch_billing',
      type: 'FAQ 型', visibility: 'public', status: 'rejected', enStatus: 'pending_human', syncStatus: 'blocked',
      vectorStatus: 'stale', version: 2, sceneL1: '会员与账户', sceneL2: '会员计费',
      labels: ['会员', '退订', '计费'], dueDays: -12, owner: 'usr_wangwen',
      paragraphs: [
        { text: '计费周期', heading: true },
        { text: '会员按自然月计费，退订在当前周期结束时生效。' },
      ],
    },
    {
      id: 'ent_0155', code: 'KB-0155', title: '太阳能板阴天充不满电', lib: 'lib_product', chapter: 'ch_solar',
      type: '操作流程型', visibility: 'public', status: 'published', enStatus: 'synced', syncStatus: 'synced',
      vectorStatus: 'failed', version: 4, sceneL1: '安装与配网', sceneL2: '太阳能供电',
      labels: ['太阳能', '充电'], dueDays: -47, owner: 'usr_wangwen',
      paragraphs: [
        { text: '排查步骤', heading: true },
        { text: '1. 检查太阳能板表面是否有遮挡或积灰。' },
        { text: '2. 确认安装角度朝南且每日直射不少于 4 小时。' },
        { text: '3. 阴天连续 3 天以上建议改用 USB 补电。' },
      ],
    },
    {
      id: 'ent_0212', code: 'KB-0212', title: '退货运费承担规则', lib: 'lib_script', chapter: 'ch_script_refund',
      type: '内部口径', visibility: 'internal', status: 'draft', enStatus: 'none', syncStatus: 'none',
      vectorStatus: 'none', version: 0, sceneL1: '售后与退款', sceneL2: '退货运费',
      labels: ['运费', '预付面单'], dueDays: 180, owner: 'usr_wangwen',
      paragraphs: [
        { text: '质量问题退货：运费由公司承担，客服直接发预付面单。' },
        { text: '非质量问题 7 天无理由：运费由用户承担。' },
        { text: '超 30 天：走个案审批，需主管确认。' },
      ],
    },
    {
      id: 'ent_0233', code: 'KB-0233', title: '订单发出后能否改地址', lib: 'lib_policy', chapter: 'ch_ship',
      type: 'FAQ 型', visibility: 'public', status: 'draft', enStatus: 'none', syncStatus: 'none',
      vectorStatus: 'none', version: 0, sceneL1: '订单与物流', sceneL2: '地址修改',
      labels: ['改地址', '发货'], dueDays: 180, owner: 'usr_wangwen',
      paragraphs: [
        { text: '订单发出前可在个人中心修改收货地址。' },
        { text: '已发出订单需联系承运商，公司不承诺一定可改。' },
      ],
    },
  ];

  for (const e of entries) {
    const body = {
      paragraphs: e.paragraphs.map((p, i) => ({
        id: `p_${i}`, text: p.text, internal: p.internal ?? false, heading: p.heading ?? false,
      })),
    };
    await query(
      `INSERT INTO entries (id, code, title, en_title, library_id, chapter_id, entry_type, visibility, scene_l1, scene_l2,
         labels, body, status, en_status, sync_status, vector_status, current_version, owner_id, submitter_id,
         review_due_at, reject_reason, updated_at)
       VALUES ($1,$2,$3,$21,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$17,
               now() + ($18 || ' days')::interval, $19, now() - ($20 || ' hours')::interval)`,
      [
        e.id, e.code, e.title, e.lib, e.chapter, e.type, e.visibility, e.sceneL1, e.sceneL2,
        JSON.stringify(e.labels), JSON.stringify(body), e.status, e.enStatus, e.syncStatus,
        e.vectorStatus, e.version, e.owner, String(e.dueDays),
        e.status === 'rejected' ? '计费周期与财务口径不符，请附财务确认截图' : null,
        String(entries.indexOf(e) * 3),
        // 英文标题与逐段译文同批产生：英文状态到「待人工校验」及之后才有
        e.enStatus === 'synced' || e.enStatus === 'pending_human' ? EN_TITLES[e.code] ?? null : null,
      ],
    );

    if (e.version > 0) {
      for (let v = 1; v <= e.version; v += 1) {
        await query(
          `INSERT INTO entry_versions (id, entry_id, version_no, label, body_snapshot, plain_text, status, author_id, author_name, effective_from, effective_to)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9, now() - ($10 || ' days')::interval, $11)`,
          [
            newId('ver'), e.id, v,
            v === 1 && e.code === 'KB-0201' ? 'v1 退款 7 天（原始口径）' : v === 2 && e.code === 'KB-0201' ? 'v2 退款 5 天（财务口径调整）' : `v${v}`,
            JSON.stringify(
              v === 1 && e.code === 'KB-0201'
                ? { paragraphs: body.paragraphs.map((p) => (p.text.includes('5 天内可退') ? { ...p, text: '非质量问题：签收后 7 天内可退，运费由用户承担。' } : p)) }
                : body,
            ),
            toPlainText(body), v === e.version ? 'current' : 'history',
            v === e.version ? 'usr_lixiao' : 'usr_wangwen', v === e.version ? '李骁' : '王雯',
            String((e.version - v + 1) * 10), v === e.version ? null : new Date(),
          ],
        );
        const metrics =
          e.code === 'KB-0201'
            ? [{ calls: 10000, hit: 95, solve: 90, adopt: 88 }, { calls: 8000, hit: 90, solve: 70, adopt: 61 }][v - 1]
            : { calls: 1200 * v, hit: 88, solve: e.code === 'KB-0155' ? 41 : e.code === 'KB-0240' ? 58 : 84, adopt: 70 };
        if (metrics) {
          await query(
            `INSERT INTO version_metrics (entry_id, version_no, calls, hit_rate, solve_rate, adopt_rate) VALUES ($1,$2,$3,$4,$5,$6)`,
            [e.id, v, metrics.calls, metrics.hit, metrics.solve, metrics.adopt],
          );
        }
      }
    }

    if (e.vectorStatus === 'ready') {
      const text = `${e.title}\n${toPlainText(body)}`;
      await query(
        `INSERT INTO entry_vectors (entry_id, embedding, source_text) VALUES ($1,$2::vector,$3)`,
        [e.id, toPgVector(embed(text)), text],
      );
    }

    if (e.enStatus === 'synced' || e.enStatus === 'pending_human') {
      let seq = 0;
      for (const p of body.paragraphs) {
        await query(
          `INSERT INTO translation_pairs (id, entry_id, paragraph_id, seq, zh_text, en_text, internal, human_edited, edit_note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            newId('pair'), e.id, p.id, seq, p.text,
            p.internal ? null : englishOf(p.text),
            p.internal,
            p.text.includes('非质量问题'),
            p.text.includes('非质量问题') ? '人工把 “buyer’s remorse” 改为 “change of mind”，更贴近北美用户表述（陈迪 08-01）' : null,
          ],
        );
        seq += 1;
      }
    }
  }

  // 已同步条目：建立映射与哈希（drift 比对基准）+ 推入沙箱 Zendesk
  const zd = getZendesk();
  // 演示数据禁止进真实帮助中心：seed 只在沙箱模式下推送（SEED_ALLOW_LIVE=1 显式解除）
  if (zd.mode === 'live' && process.env.SEED_ALLOW_LIVE !== '1') {
    throw new Error(
      'Zendesk 处于 live 模式，seed 会把演示条目推送到真实帮助中心。请清空 Zendesk 凭据后再跑 seed；确需推送则设 SEED_ALLOW_LIVE=1',
    );
  }
  const { rows: published } = await query<{ id: string; code: string; title: string; body: { paragraphs: Array<{ id: string; text: string; internal: boolean; heading: boolean }> }; visibility: string; labels: string[]; chapter_id: string; ref: string | null }>(
    `SELECT e.id, e.code, e.title, e.body, e.visibility, e.labels, e.chapter_id, c.zendesk_section_ref AS ref
     FROM entries e JOIN chapters c ON c.id=e.chapter_id WHERE e.sync_status='synced'`,
  );
  for (const p of published) {
    const article = await zd.upsertArticle({
      entryCode: p.code,
      title: p.title,
      publicHtml: toPublicHtml(p.body),
      labels: p.labels,
      sectionRef: p.ref ?? 'Sec 5101',
      internalOnly: p.visibility === 'internal',
    });
    await query(
      `INSERT INTO sync_mappings (id, entry_id, chapter_id, local_label, zendesk_kind, zendesk_ref, visibility, published_hash)
       VALUES ($1,$2,$3,$4,'article',$5,$6,$7)`,
      [newId('map'), p.id, p.chapter_id, `${p.code} ${p.title}`, article.id, p.visibility, contentHash(toPlainText(p.body))],
    );
    await query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ($1,$2,1,'更新正文 + labels',$3,'synced','中 / 英')`,
      [newId('sync'), p.id, p.visibility === 'internal' ? '内部知识 · 仅客服 segment' : '帮助中心 · 对外文章'],
    );
  }

  // 效果指标（信号聚合）
  const effects = [
    { id: 'ent_0155', bot: 58, agent: 21, down: 9, flag: 3, solve: 41 },
    { id: 'ent_0240', bot: 44, agent: 12, down: 6, flag: 2, solve: 58 },
    { id: 'ent_0201', bot: 132, agent: 47, down: 11, flag: 1, solve: 70 },
    { id: 'ent_0188', bot: 96, agent: 33, down: 3, flag: 0, solve: 84 },
    { id: 'ent_0212', bot: 0, agent: 6, down: 0, flag: 0, solve: null },
  ];
  for (const m of effects) {
    await query(
      `INSERT INTO entry_effect_metrics (entry_id, bot_refs, agent_refs, downvotes, flags, solve_rate)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m.id, m.bot, m.agent, m.down, m.flag, m.solve],
    );
  }

  // 信号事件（条目级反馈列表）
  const signalEvents = [
    { entry: 'ent_0201', channel: '用户自助浏览', type: '文章被踩', excerpt: '5 天太短，与页面标注不一致', certainty: 'certain' },
    { entry: 'ent_0201', channel: 'AI bot 自动回答', type: 'bot 未解决转人工', excerpt: '缺跨境订单说明', certainty: 'tier_dependent' },
    { entry: 'ent_0155', channel: '客服主动反馈', type: '客服 flag', excerpt: '固件 2.4 后阈值变化，步骤过时', certainty: 'certain' },
    { entry: 'ent_0240', channel: 'AI bot 自动回答', type: 'bot 未解决转人工', excerpt: '缺跨月退订示例', certainty: 'tier_dependent' },
  ];
  for (const s of signalEvents) {
    await query(
      `INSERT INTO signal_events (id, entry_id, channel, signal_type, certainty, excerpt) VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId('sig'), s.entry, s.channel, s.type, s.certainty, s.excerpt],
    );
  }

  // 信号矩阵（四渠道，含确定性档位）
  const matrix = [
    { scene: 'AI bot 自动回答', channel: '在线聊天', hit: 'bot 引用了哪篇文章 + 哪个锚点', solve: 'automated resolution（确认解决或未追问）；转人工 = 未解决', cert: 'tier_dependent', order: 1 },
    { scene: '人工工单', channel: '邮件 + 转人工', hit: '客服 Knowledge 面板引用记录', solve: '工单 solved + reopen + CSAT', cert: 'unverified', order: 2 },
    { scene: '用户自助浏览', channel: '帮助中心', hit: '浏览与搜索点击', solve: '文章赞 / 踩；看完未提单（弱信号）', cert: 'unverified', order: 3 },
    { scene: '客服主动反馈', channel: 'Zendesk 侧', hit: '—', solve: '客服标记文章过时 / 有问题（flag）', cert: 'certain', order: 4 },
  ];
  for (const m of matrix) {
    await query(
      `INSERT INTO signal_matrix (id, scene, channel, hit_signal, solve_signal, certainty, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newId('sm'), m.scene, m.channel, m.hit, m.solve, m.cert, m.order],
    );
  }

  // 修订候选（五来源）
  const revisions = [
    { src: '客服 flag', entry: 'ent_0155', topic: '太阳能板阴天充不满电 v4', note: '3 位客服标记步骤过时（固件 2.4 后阈值变化）', count: '3 flag' },
    { src: '文章被踩', entry: 'ent_0201', topic: '退款政策 v2', note: '踩 11 次，评论集中在「5 天太短，与页面标注不一致」', count: '11 踩' },
    { src: 'bot 未解决', entry: 'ent_0240', topic: '会员退订与计费周期 v2', note: 'bot 引用后 18 次转人工，缺跨月退订示例', count: '18 转人工' },
    { src: '高频无覆盖', entry: null, topic: '第三方支架兼容', note: '工单 11 次 / 周，无覆盖 → 立新条', count: '11 次' },
    { src: '搜索无结果', entry: null, topic: 'refund how long（命名不匹配）', note: '搜索 24 次无结果，已有条目 → 改标题与 labels', count: '24 次' },
  ];
  for (const r of revisions) {
    await query(
      `INSERT INTO revision_candidates (id, source, entry_id, topic, signal_note, count_label) VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId('rev'), r.src, r.entry, r.topic, r.note, r.count],
    );
  }

  // 场景覆盖 / 缺口 / 搜索无结果
  const scenes = [
    { name: '退款退货', n: 31, pct: 100 }, { name: '联网配对', n: 28, pct: 90 },
    { name: '安装供电', n: 22, pct: 71 }, { name: '会员账户', n: 11, pct: 35 }, { name: '配件兼容', n: 6, pct: 19 },
  ];
  let so = 0;
  for (const s of scenes) {
    so += 1;
    await query('INSERT INTO coverage_scenes (id, name, entry_count, coverage_pct, sort_order) VALUES ($1,$2,$3,$4,$5)', [
      newId('cov'), s.name, s.n, s.pct, so,
    ]);
  }
  const gaps = [
    { topic: '喂鸟器极寒天气自动关机', n: '17 次 / 周', src: '工单 12 · 聊天 5', cover: '未覆盖 → 立新条', act: '新增' },
    { topic: '跨境订单退款起算日', n: '13 次 / 周', src: '工单 11 · 聊天 2', cover: '已覆盖但答不好 → 修订', act: '修订' },
    { topic: '第三方支架是否兼容', n: '11 次 / 周', src: '工单 8 · 聊天 3', cover: '未覆盖 → 立新条', act: '新增' },
  ];
  for (const g of gaps) {
    await query('INSERT INTO knowledge_gaps (id, topic, weekly_count, source_split, coverage_verdict, action) VALUES ($1,$2,$3,$4,$5,$6)', [
      newId('gap'), g.topic, g.n, g.src, g.cover, g.act,
    ]);
  }
  const noResults = [
    { kw: 'return shipping', n: 31, verdict: '无对应条目（内部有口径未对外）', level: 'bad' },
    { kw: 'refund how long', n: 24, verdict: '有条目，命名不匹配', level: 'warn' },
    { kw: 'freeze / frozen', n: 42, verdict: '无对应条目', level: 'bad' },
  ];
  for (const n of noResults) {
    await query('INSERT INTO no_result_keywords (id, keyword, weekly_count, verdict, level) VALUES ($1,$2,$3,$4,$5)', [
      newId('nr'), n.kw, n.n, n.verdict, n.level,
    ]);
  }

  // 挖掘批次（含完成/空/失败三态）
  const today = new Date();
  const batches = [
    { d: 0, email: 21, chat: 16, n: 3, status: 'completed', reason: null },
    { d: 1, email: 18, chat: 11, n: 0, status: 'completed', reason: null },
    { d: 2, email: 3, chat: 1, n: 0, status: 'empty', reason: null },
    { d: 3, email: 0, chat: 0, n: 0, status: 'failed', reason: 'Zendesk API 429 限流 · 次日照常拉取' },
  ];
  const batchIds: string[] = [];
  for (const b of batches) {
    const id = newId('batch');
    batchIds.push(id);
    const date = new Date(today.getTime() - b.d * 86400000).toISOString().slice(0, 10);
    await query(
      `INSERT INTO mining_batches (id, batch_date, email_count, chat_count, candidate_count, status, fail_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, date, b.email, b.chat, b.n, b.status, b.reason],
    );
  }
  const candidates = [
    { type: 'new', title: '喂鸟器在极寒天气下自动关机', src: '17 会话 · 工单 12 / 聊天 5', freq: 17, dup: 0.42, gap: '未覆盖', note: '三重准入通过 → 建议立新条', target: null,
      summary: '用户反馈 -15°C 以下设备夜间自动关机、白天回温恢复。客服口径已趋一致，但知识库无对应条目，每次手写。',
      body: '为什么低温天气下喂鸟器会自动关机？\n1. -15°C 以下电池触发低温保护，设备自动断电，回温后自行恢复。\n2. 需连续供电请加装保温罩，并换用低温型号电池（BT-LOW）。\n3. 关机期间录像中断，历史录像不受影响。' },
    { type: 'revision', title: '太阳能板阴天充不满电（挂到 KB-0155）', src: '14 会话 · 工单 5 / 聊天 9', freq: 14, dup: 0.88, gap: '已覆盖但答不好', note: '查重 ≥ 0.85 → 不新建，挂修订', target: 'KB-0155',
      summary: '现有条目只写「检查遮挡」，未覆盖固件 2.4 后的充电阈值变化；客服 flag 3 次「步骤过时」。',
      body: '补充：固件 2.4 起充电阈值由 12% 调整为 18%，阴天需连续 2 日以上才触发补电提示。' },
    { type: 'merge', title: '两条 Wi-Fi 配对条目内容重叠', src: '本台查重发现', freq: 11, dup: 0.91, gap: '重复建条', note: '合并后另一条 Zendesk 归档并重定向', target: 'KB-0188',
      summary: '两条回答同一问题，bot 引用被分流导致都拿不满样本量。',
      body: '合并说明：保留主条目，另一条归档并在 Zendesk 端建立重定向。' },
  ];
  for (const c of candidates) {
    await query(
      `INSERT INTO mining_candidates (id, batch_id, type, title, source_summary, frequency, dedupe_score, gap_verdict, ai_summary, draft_body, admission_note, target_entry_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [newId('cand'), batchIds[0], c.type, c.title, c.src, c.freq, c.dup, c.gap, c.summary, c.body, c.note, c.target],
    );
  }

  // 审计初始记录（真实动作留痕由运行期产生，这里仅记录种子初始化）
  await query(
    `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, object_type, object_id, object_label, action, category, field, before_value, after_value, note)
     VALUES ($1,'usr_ken','运维 Ken','sys_admin','system',NULL,'知识运营中台','初始化种子数据','admin','数据集','—','飞书 120+ 篇迁移基线（首批 6 条）','初始迁移演练基线')`,
    [newId('log')],
  );

  console.log('种子数据完成：');
  console.log(`  用户 ${users.length} 个（初始密码：${INITIAL_PASSWORD}）`);
  console.log(`  知识库 ${libs.length} 个 / 章节 ${chapters.length} 个 / 条目 ${entries.length} 条`);
  console.log(`  挖掘批次 ${batches.length} 批（含空批次与失败批次）/ 候选 ${candidates.length} 条`);
  console.log(`  Zendesk 沙箱已推送 ${published.length} 篇文章（drift 比对基准就位）`);
  await pool.end();
}

/** 英文标题（人工校验后的定稿；缺失会让英文读者看到中文标题） */
const EN_TITLES: Record<string, string> = {
  'KB-0155': 'Solar panel not charging fully on cloudy days',
  'KB-0188': 'Warranty period and proof of purchase',
  'KB-0201': 'Refund policy',
  'KB-0212': 'Who pays return shipping',
  'KB-0233': 'Changing the delivery address after shipment',
  'KB-0240': 'Membership cancellation and billing cycle',
};

function englishOf(zh: string): string {
  const map: Record<string, string> = {
    退款时限: 'Refund window',
    '质量问题：签收后 30 天内可申请全额退款，运费由公司承担。':
      'Quality issues: full refund within 30 days of delivery; return shipping is covered by COOLFLY.',
    '非质量问题：签收后 5 天内可退，运费由用户承担。':
      'Change of mind: returns accepted within 5 days of delivery; return shipping is paid by the customer.',
    '会员服务：按自然月退订。': 'Membership: cancellation takes effect at the end of the calendar month.',
    保修范围: 'Warranty scope',
    '整机自签收之日起保修 12 个月，配件保修 6 个月。':
      'Complete units are covered for 12 months from delivery; accessories for 6 months.',
    '申请保修需提供订单号与设备序列号照片。':
      'Warranty claims require the order number and a photo of the device serial number.',
    计费周期: 'Billing cycle',
    '会员按自然月计费，退订在当前周期结束时生效。':
      'Membership is billed by calendar month; cancellation takes effect at the end of the current cycle.',
    排查步骤: 'Troubleshooting steps',
    '1. 检查太阳能板表面是否有遮挡或积灰。': '1. Check the solar panel for shade or dust build-up.',
    '2. 确认安装角度朝南且每日直射不少于 4 小时。':
      '2. Make sure the panel faces south and gets at least 4 hours of direct sunlight per day.',
    '3. 阴天连续 3 天以上建议改用 USB 补电。':
      '3. After 3 or more overcast days, top up the battery over USB.',
  };
  return map[zh] ?? zh;
}

main().catch((err) => {
  console.error('种子数据失败：', err);
  process.exit(1);
});
