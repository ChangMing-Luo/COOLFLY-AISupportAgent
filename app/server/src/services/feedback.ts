import {
  bumpVersion,
  canTransition,
  ENTRY_STATUS_META,
  MISS_STATE_LABELS,
  FEEDBACK_STATE_LABELS,
  type SessionUser,
} from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit, SYSTEM_ACTOR } from '../core/audit.js';
import { desensitize, toPlainText } from '../core/content.js';
import { fmtShort } from '../core/fmt.js';
import { getZendesk } from '../integrations/zendesk.js';
import { literalSimilarity } from '../integrations/llm.js';
import { DomainError, actorOf, createEntry, findEntry, listEntries, type EntryRow } from './entries.js';

/* ══════════ 反馈 ══════════ */

export interface FeedbackDto {
  code: string;
  entryCode: string;
  type: string;
  text: string;
  conversation: string;
  state: string;
  stateLabel: string;
  at: string;
}

export async function listFeedbacks(entryId?: string): Promise<FeedbackDto[]> {
  const { rows } = await query<{
    code: string;
    entry_code: string;
    type: string;
    text: string;
    conversation: string;
    state: string;
    occurred_at: Date;
  }>(
    `SELECT code, entry_code, type, text, conversation, state, occurred_at FROM feedbacks
     ${entryId ? 'WHERE entry_id=$1' : ''} ORDER BY occurred_at DESC`,
    entryId ? [entryId] : [],
  );
  return rows.map((r) => ({
    code: r.code,
    entryCode: r.entry_code,
    type: r.type,
    text: r.text,
    conversation: r.conversation,
    state: r.state,
    stateLabel: FEEDBACK_STATE_LABELS[r.state as keyof typeof FEEDBACK_STATE_LABELS],
    at: fmtShort(r.occurred_at),
  }));
}

async function nextFeedbackCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'FB-([0-9]+)') AS INT))::text AS max FROM feedbacks`,
  );
  return `FB-${Number(rows[0]?.max ?? 9900) + 1}`;
}

const COMPLAINT_HINTS: Array<[RegExp, '差评' | '信息有误' | '无法解决']> = [
  [/不一致|不对|写错|过期|旧政策/, '信息有误'],
  [/说不清|没写清|找不到|解决不了|追问|还是不懂/, '无法解决'],
  [/太长|念不完|等不及|态度|体验差/, '差评'],
];

/**
 * 从 Zendesk 拉客诉：
 * ①文章 down 投票增量 → 差评；②近 7 日会话里带抱怨语气且能匹配到已发布知识的 → 按语气归类。
 * 全部走真实接口，拉不到就返回 0 条并如实提示，不造数据。
 */
export async function pullFromZendesk(user: SessionUser): Promise<{ created: number; note: string }> {
  const zd = getZendesk();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let created = 0;
  let refreshed = 0;
  let totalUp = 0;
  let totalDown = 0;

  // ① 投票增量
  const { rows: mapped } = await query<{
    entry_id: string;
    code: string;
    title_zh: string;
    article_ref: string;
    votes_down: number;
    votes_up: number;
  }>(
    `SELECT e.id AS entry_id, e.code, e.title_zh, m.zendesk_article_ref AS article_ref,
            COALESCE(mt.votes_down,0) AS votes_down, COALESCE(mt.votes_up,0) AS votes_up
     FROM entries e
     JOIN sync_mappings m ON m.entry_id = e.id AND m.zendesk_article_ref IS NOT NULL
     LEFT JOIN entry_metrics mt ON mt.entry_id = e.id`,
    // 不按 status 过滤：文章一旦推上帮助中心就会持续收到投票，
    // 条目在中台被改成草稿/修复中并不代表线上文章下线了——按状态过滤会让投票永远回不来。
  );
  for (const m of mapped) {
    let votes: { up: number; down: number };
    try {
      votes = await zd.fetchArticleVotes(m.article_ref);
    } catch {
      continue;
    }
    refreshed += 1;
    totalUp += votes.up;
    totalDown += votes.down;
    const total = votes.up + votes.down;
    await query(
      `INSERT INTO entry_metrics (entry_id, votes_up, votes_down, adopt_rate, refreshed_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (entry_id) DO UPDATE SET votes_up=EXCLUDED.votes_up, votes_down=EXCLUDED.votes_down,
                                            adopt_rate=EXCLUDED.adopt_rate, refreshed_at=now()`,
      [m.entry_id, votes.up, votes.down, total ? Math.round((votes.up / total) * 100) : 0],
    );
    const delta = votes.down - m.votes_down;
    if (delta > 0) {
      await query(
        `INSERT INTO feedbacks (id, code, entry_id, entry_code, type, text, conversation, state, occurred_at)
         VALUES ($1,$2,$3,$4,'差评',$5,$6,'open',now())`,
        [
          newId('fb'),
          await nextFeedbackCode(),
          m.entry_id,
          m.code,
          `帮助中心新增 ${delta} 条踩，累计 ${votes.down} 踩 / ${votes.up} 赞，需复核内容准确性`,
          `ZD-VOTE-${m.article_ref}`,
        ],
      );
      created += 1;
    }
  }

  // ② 会话文本
  let items: string[] = [];
  try {
    items = (await zd.fetchConversations(since)).items.map(desensitize);
  } catch {
    items = [];
  }
  const published = await listEntries(`WHERE e.status='published'`);
  for (const raw of items) {
    const hint = COMPLAINT_HINTS.find(([re]) => re.test(raw));
    if (!hint) continue;
    let best = { entry: null as EntryRow | null, score: 0 };
    for (const p of published) {
      const s = literalSimilarity(raw, `${p.title_zh} ${toPlainText(p.body_zh).slice(0, 200)}`);
      if (s > best.score) best = { entry: p, score: s };
    }
    if (!best.entry || best.score < 0.12) continue;
    const conv = `ZD-${Math.abs(hashCode(raw)) % 100000}`;
    const { rows: dup } = await query('SELECT 1 FROM feedbacks WHERE conversation=$1', [conv]);
    if (dup.length) continue;
    await query(
      `INSERT INTO feedbacks (id, code, entry_id, entry_code, type, text, conversation, state, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open',now())`,
      [newId('fb'), await nextFeedbackCode(), best.entry.id, best.entry.code, hint[1], raw.slice(0, 160), conv],
    );
    created += 1;
  }

  await writeAudit(SYSTEM_ACTOR, {
    action: 'Zendesk 拉取',
    objectType: 'feedback',
    objectCode: null,
    objectLabel: `刷新 ${refreshed} 篇文章投票（赞 ${totalUp} / 踩 ${totalDown}），新增 ${created} 条客诉`,
  });
  const voteNote = refreshed
    ? `已刷新 ${refreshed} 篇文章的投票：累计 ${totalUp} 赞 / ${totalDown} 踩，采纳率已更新。`
    : '尚无已同步到 Zendesk 的文章，暂无投票可拉。';
  return {
    created,
    note: created
      ? `${voteNote}并新增 ${created} 条待处理客诉，可直接在列表修复。`
      : `${voteNote}近 7 日没有新增的踩或客诉会话（数据源：${zd.mode === 'live' ? '真实实例' : '沙箱'}）。`,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * 修复发布后关闭该条目上「修复中」的反馈——这是反馈闭环的最后一步。
 * 原来只有「忽略」一条路能写 closed，且它要求 state='open'，于是走过「去修复」的反馈
 * 永远停在修复中：既关不掉、也点不了忽略（会报 404），运营无法区分真在修与早修完。
 */
export async function closeFixedFeedbacks(entryId: string, entryCode: string, version: string): Promise<number> {
  const { rowCount } = await query(
    `UPDATE feedbacks SET state='closed', handled_at=now() WHERE entry_id=$1 AND state='fixing'`,
    [entryId],
  );
  if (rowCount) {
    await writeAudit(SYSTEM_ACTOR, {
      action: '反馈闭环',
      objectType: 'feedback',
      objectCode: entryCode,
      objectLabel: `${entryCode} ${version} 发布后关闭 ${rowCount} 条修复中的反馈`,
    });
  }
  return rowCount ?? 0;
}

export async function ignoreFeedback(user: SessionUser, code: string): Promise<void> {
  const { rows } = await query<{ entry_code: string }>(
    `UPDATE feedbacks SET state='closed', handled_by=$2, handled_at=now()
     WHERE code=$1 AND state='open' RETURNING entry_code`,
    [code, user.id],
  );
  if (!rows[0]) throw new DomainError('反馈不存在或已处理。', 404);
  await writeAudit(actorOf(user), {
    action: '忽略反馈',
    objectType: 'feedback',
    objectCode: code,
    objectLabel: `${code} → ${rows[0].entry_code}`,
  });
}

/** 去修复：生成小版本草稿，线上仍为上一版本；反馈置「修复中」 */
export async function fixFeedback(user: SessionUser, code: string): Promise<EntryRow> {
  const { rows } = await query<{ entry_code: string; text: string; state: string }>(
    'SELECT entry_code, text, state FROM feedbacks WHERE code=$1',
    [code],
  );
  const fb = rows[0];
  if (!fb) throw new DomainError('反馈不存在。', 404);
  // 幂等：已在修复或已关闭的反馈不能再点一次。否则每点一次都 bumpVersion，
  // 版本号会在没有任何实际修订的情况下空跳（v3.2 → v3.3 → v3.4），note 也被反复覆盖。
  if (fb.state !== 'open') {
    throw new DomainError(
      fb.state === 'fixing' ? '该反馈已在修复中，请直接到编辑器继续修订。' : '该反馈已关闭。',
      409,
    );
  }
  const entry = await findEntry(fb.entry_code);
  // 状态守卫：pending → fixing / offline → fixing 都是非法流转。
  // 前者会把条目从审核队列里抽走、留下一条永远批不掉的审核请求；
  // 后者能让已归档文章绕过「恢复→草稿→重走流程」直接被重新发布上线。
  if (!canTransition(entry.status, 'fixing')) {
    throw new DomainError(
      `知识 ${entry.code} 当前为「${ENTRY_STATUS_META[entry.status].label}」，不能直接转修复。${
        entry.status === 'pending' ? '请先等待审核结论。' : '请先在已下线列表中恢复为草稿。'
      }`,
      409,
    );
  }
  const next = entry.status === 'published' ? bumpVersion(entry.version, false) : entry.version;
  // 置「修复中」而不是「草稿」——六态里 fixing 的定义就是「正在根据反馈修订」，
  // 写成 draft 会让这个状态永远不可达，界面上也分不清「自发修订」与「被投诉后修复」。
  await query(
    `UPDATE entries SET status='fixing', version=$2, note=$3, owner_id=$4, owner_name=$5, updated_at=now()
     WHERE code=$1`,
    [entry.code, next, `修复反馈 ${code}：${fb.text}`, user.id, user.name],
  );
  await query(`UPDATE feedbacks SET state='fixing', handled_by=$2, handled_at=now() WHERE code=$1`, [
    code,
    user.id,
  ]);
  await writeAudit(actorOf(user), {
    action: '反馈转修复',
    objectCode: entry.code,
    objectLabel: `${code} → ${entry.code} ${next}`,
    version: next,
  });
  return findEntry(entry.code);
}

/* ══════════ 未命中问题 ══════════ */

export interface MissDto {
  code: string;
  question: string;
  sceneZh: string;
  count7d: number;
  hitRate: string;
  state: string;
  stateLabel: string;
  aiSummary: string;
}

export async function listMisses(): Promise<MissDto[]> {
  const { rows } = await query<{
    code: string;
    question: string;
    scene_zh: string | null;
    count_7d: number;
    hit_rate: number;
    state: string;
    ai_summary: string;
  }>(
    `SELECT m.code, m.question, s.name_zh AS scene_zh, m.count_7d, m.hit_rate, m.state, m.ai_summary
     FROM misses m LEFT JOIN scenes s ON s.id=m.scene_id
     ORDER BY m.count_7d DESC, m.created_at DESC`,
  );
  return rows.map((r) => ({
    code: r.code,
    question: r.question,
    sceneZh: r.scene_zh ?? '未识别',
    count7d: r.count_7d,
    hitRate: `${r.hit_rate}%`,
    state: r.state,
    stateLabel: MISS_STATE_LABELS[r.state as keyof typeof MISS_STATE_LABELS],
    aiSummary: r.ai_summary,
  }));
}

/** 从 Zendesk 帮助中心「搜索无结果」刷新未命中；接口不可得时不写数据 */
export async function refreshMisses(): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let list: Array<{ keyword: string; count: number }> = [];
  try {
    list = await getZendesk().fetchNoResultSearches(since);
  } catch {
    return 0;
  }
  if (!list.length) return 0;
  const scenes = await query<{ id: string; name_zh: string }>('SELECT id, name_zh FROM scenes WHERE active');
  let n = 0;
  for (const k of list) {
    const { rows } = await query('SELECT 1 FROM misses WHERE question=$1', [k.keyword]);
    const scene = scenes.rows.find((s) => k.keyword.includes(s.name_zh.slice(0, 2)));
    if (rows.length) {
      await query('UPDATE misses SET count_7d=$2, updated_at=now() WHERE question=$1', [k.keyword, k.count]);
      continue;
    }
    const { rows: seq } = await query<{ max: string | null }>(
      `SELECT MAX(CAST(SUBSTRING(code FROM 'MS-([0-9]+)') AS INT))::text AS max FROM misses`,
    );
    await query(
      `INSERT INTO misses (id, code, question, scene_id, count_7d, hit_rate, state, ai_summary)
       VALUES ($1,$2,$3,$4,$5,0,'open',$6)`,
      [
        newId('ms'),
        `MS-${Number(seq[0]?.max ?? 420) + 1}`,
        k.keyword,
        scene?.id ?? null,
        k.count,
        `帮助中心搜索无结果 ${k.count} 次，尚无知识覆盖该提问。`,
      ],
    );
    n += 1;
  }
  if (n) {
    await writeAudit(SYSTEM_ACTOR, {
      action: '未命中刷新',
      objectType: 'miss',
      objectCode: null,
      objectLabel: `新增 ${n} 条未命中问题`,
    });
  }
  return n;
}

export async function createDraftFromMiss(user: SessionUser, code: string): Promise<EntryRow> {
  const { rows } = await query<{
    id: string;
    question: string;
    scene_id: string | null;
    state: string;
    entry_id: string | null;
  }>('SELECT id, question, scene_id, state, entry_id FROM misses WHERE code=$1', [code]);
  const m = rows[0];
  if (!m) throw new DomainError('未命中问题不存在。', 404);
  // 已排期且草稿还在 → 不重复建（原来可重复点，misses.entry_id 被最后一次覆盖，先建的条目失去回链）。
  // 已排期但草稿已被删（外键 ON DELETE SET NULL 把 entry_id 置空）→ 允许重建，
  // 否则这条知识缺口会永久卡在「已排期」，既不出现在待办、也无法再建草稿。
  if (m.state === 'planned' && m.entry_id) {
    const { rows: linked } = await query<{ code: string }>('SELECT code FROM entries WHERE id=$1', [m.entry_id]);
    if (linked[0]) {
      throw new DomainError(`该未命中问题已建过条目 ${linked[0].code}，请直接编辑它。`, 409);
    }
  }
  const { rows: sc } = m.scene_id
    ? await query<{ category_id: string }>('SELECT category_id FROM scenes WHERE id=$1', [m.scene_id])
    : { rows: [] as Array<{ category_id: string }> };

  const entry = await createEntry(user, {
    titleZh: m.question,
    categoryId: sc[0]?.category_id ?? null,
    sceneId: m.scene_id,
    source: `未命中 ${code}`,
    quality: 40,
  });
  await query(`UPDATE misses SET state='planned', entry_id=$2, updated_at=now() WHERE code=$1`, [code, entry.id]);
  await writeAudit(actorOf(user), {
    action: '未命中新建条目',
    objectCode: entry.code,
    objectLabel: `${entry.code} ← ${code}`,
  });
  return findEntry(entry.code);
}
