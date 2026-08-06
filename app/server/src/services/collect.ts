import { TUNABLES, type SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { withCodeRetry } from '../core/codes.js';
import { writeAudit, SYSTEM_ACTOR } from '../core/audit.js';
import { desensitize, toPlainText } from '../core/content.js';
import { fmtShort } from '../core/fmt.js';
import { getZendesk } from '../integrations/zendesk.js';
import { getLlm, literalSimilarity } from '../integrations/llm.js';
import { DomainError, actorOf, createEntry, findEntry, listEntries, type EntryRow } from './entries.js';

/** 抽象摘要相似度 ≥ 该值即视为同一个问题（去重 / 自动丢弃的判据） */
const SUMMARY_MATCH = 0.55;

export interface CandidateSourceDto {
  id: string;
  ticketRef: string;
  channel: string;
  excerpt: string;
  at: string;
}

export interface CandidateDto {
  code: string;
  title: string;
  answer: string;
  summary: string;
  categoryZh: string;
  sceneZh: string;
  categoryHint: string;
  sceneHint: string;
  tags: string[];
  confidence: number;
  confidencePct: string;
  state: '高置信' | '需复核' | '低置信';
  tagClass: string;
  mentionCount: number;
  sentiment: 'negative' | 'neutral' | 'positive';
  sentimentLabel: string;
  createdAt: string;
  dup: boolean;
  dupCode: string | null;
  dupTitle: string | null;
  dupScore: string | null;
  /** 垃圾箱用 */
  dropReason: string | null;
  autoDropped: boolean;
  disposedAt: string | null;
}

export interface CollectTaskDto {
  code: string;
  title: string;
  source: string;
  state: string;
  ownerName: string;
  ranAt: string;
  candidateCount: number;
  sourceText: string;
  sourceMeta: string;
  failReason: string | null;
}

const SENTIMENT_LABEL: Record<string, string> = {
  negative: '负面 · 优先',
  neutral: '中性',
  positive: '正面',
};

function candState(conf: number): { state: CandidateDto['state']; tagClass: string } {
  if (conf > 0.8) return { state: '高置信', tagClass: 'tag-accent' };
  if (conf > 0.6) return { state: '需复核', tagClass: 'tag-outline' };
  return { state: '低置信', tagClass: 'tag-neutral' };
}

const CAND_SELECT = `
  SELECT c.*, s.name_zh AS scene_zh, cat.name_zh AS category_zh,
         d.code AS dup_code, d.title_zh AS dup_title
  FROM extract_candidates c
  LEFT JOIN scenes s      ON s.id = c.scene_id
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN entries d     ON d.id = c.dup_entry_id`;

interface CandRow {
  id: string;
  code: string;
  title: string;
  answer: string;
  summary: string;
  tags: string[];
  confidence: string;
  mention_count: number;
  sentiment: string;
  created_at: Date;
  disposed_at: Date | null;
  drop_reason: string | null;
  auto_dropped: boolean;
  category_hint: string;
  scene_hint: string;
  dup_score: number | null;
  scene_zh: string | null;
  category_zh: string | null;
  dup_code: string | null;
  dup_title: string | null;
}

function toCandDto(c: CandRow): CandidateDto {
  const conf = Number(c.confidence);
  const st = candState(conf);
  return {
    code: c.code,
    title: c.title,
    answer: c.answer,
    summary: c.summary,
    categoryZh: c.category_zh ?? '',
    sceneZh: c.scene_zh ?? '',
    categoryHint: c.category_hint,
    sceneHint: c.scene_hint,
    tags: c.tags ?? [],
    confidence: conf,
    confidencePct: `${Math.round(conf * 100)}%`,
    state: st.state,
    tagClass: st.tagClass,
    mentionCount: c.mention_count,
    sentiment: (c.sentiment as CandidateDto['sentiment']) ?? 'neutral',
    sentimentLabel: SENTIMENT_LABEL[c.sentiment] ?? '中性',
    createdAt: fmtShort(c.created_at),
    dup: Boolean(c.dup_code),
    dupCode: c.dup_code,
    dupTitle: c.dup_code ? `${c.dup_code} ${c.dup_title}` : null,
    dupScore: c.dup_score ? `${c.dup_score}%` : null,
    dropReason: c.drop_reason,
    autoDropped: c.auto_dropped,
    disposedAt: c.disposed_at ? fmtShort(c.disposed_at) : null,
  };
}

/** 抽取工作台：最近一个有待确认候选的任务，没有则取最新任务 */
export async function currentTask(): Promise<{ task: CollectTaskDto | null; candidates: CandidateDto[] }> {
  const { rows } = await query<{
    id: string;
    code: string;
    title: string;
    source: string;
    state: string;
    owner_name: string;
    ran_at: Date | null;
    candidate_count: number;
    source_text: string;
    source_meta: string;
    fail_reason: string | null;
  }>(
    `SELECT t.* FROM collect_tasks t
     ORDER BY (SELECT COUNT(*) FROM extract_candidates c WHERE c.task_id=t.id AND c.disposition='pending') DESC,
              t.created_at DESC
     LIMIT 1`,
  );
  const t = rows[0];
  if (!t) return { task: null, candidates: [] };

  const { rows: cands } = await query<CandRow>(
    `${CAND_SELECT} WHERE c.task_id=$1 AND c.disposition='pending'
     ORDER BY c.mention_count DESC, c.confidence DESC, c.created_at`,
    [t.id],
  );

  return {
    task: {
      code: t.code,
      title: t.title,
      source: t.source,
      state: t.state,
      ownerName: t.owner_name,
      ranAt: fmtShort(t.ran_at),
      candidateCount: t.candidate_count,
      sourceText: t.source_text,
      sourceMeta: t.source_meta,
      failReason: t.fail_reason,
    },
    candidates: cands.map(toCandDto),
  };
}

/** 某条候选下挂的全部会话原文 */
export async function candidateSources(code: string): Promise<{ candidate: CandidateDto; sources: CandidateSourceDto[] }> {
  const { rows } = await query<CandRow>(`${CAND_SELECT} WHERE c.code=$1`, [code]);
  const c = rows[0];
  if (!c) throw new DomainError(`候选不存在：${code}`, 404);
  const { rows: src } = await query<{
    id: string;
    ticket_ref: string;
    channel: string;
    excerpt: string;
    occurred_at: Date | null;
  }>(`SELECT * FROM candidate_sources WHERE candidate_id=$1 ORDER BY occurred_at DESC NULLS LAST, created_at`, [c.id]);
  return {
    candidate: toCandDto(c),
    sources: src.map((s) => ({
      id: s.id,
      ticketRef: s.ticket_ref,
      channel: s.channel,
      excerpt: s.excerpt,
      at: s.occurred_at ? fmtShort(s.occurred_at) : '—',
    })),
  };
}

/** 垃圾箱：人工丢弃 + 自动丢弃的候选 */
export async function trashCandidates(): Promise<CandidateDto[]> {
  const { rows } = await query<CandRow>(
    `${CAND_SELECT} WHERE c.disposition='dropped' ORDER BY c.disposed_at DESC NULLS LAST, c.created_at DESC LIMIT 200`,
  );
  return rows.map(toCandDto);
}

async function nextTaskCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'CT-([0-9]+)') AS INT))::text AS max FROM collect_tasks`,
  );
  return `CT-${Number(rows[0]?.max ?? 3000) + 1}`;
}

/** 用最大编号 +1，不能用 COUNT——清空后计数回落会和残留的已采纳候选撞唯一键 */
async function nextCandidateCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'EX-([0-9]+)') AS INT))::text AS max
     FROM extract_candidates WHERE code ~ '^EX-[0-9]+$'`,
  );
  return `EX-${String(Number(rows[0]?.max ?? 0) + 1).padStart(2, '0')}`;
}

/** 把模型给的中文名映射到真实分类/场景；映射不上返回 null，让人工在编辑器里选 */
async function resolveTaxonomy(
  categoryHint: string,
  sceneHint: string,
): Promise<{ categoryId: string | null; sceneId: string | null }> {
  const { rows: scenes } = await query<{ id: string; name_zh: string; category_id: string; cat_zh: string }>(
    `SELECT s.id, s.name_zh, s.category_id, c.name_zh AS cat_zh
     FROM scenes s JOIN categories c ON c.id=s.category_id WHERE s.active AND c.active`,
  );
  if (scenes.length === 0) return { categoryId: null, sceneId: null };

  const exact = scenes.find((s) => s.name_zh === sceneHint);
  if (exact) return { categoryId: exact.category_id, sceneId: exact.id };

  const ranked = scenes
    .map((s) => ({ s, score: literalSimilarity(`${categoryHint} ${sceneHint}`, `${s.cat_zh} ${s.name_zh}`) }))
    .sort((a, b) => b.score - a.score);
  if (ranked[0] && ranked[0].score >= 0.25) {
    return { categoryId: ranked[0].s.category_id, sceneId: ranked[0].s.id };
  }
  // 场景对不上，至少把一级分类挂上
  const { rows: cats } = await query<{ id: string; name_zh: string }>(
    'SELECT id, name_zh FROM categories WHERE active',
  );
  const cat = cats.find((c) => c.name_zh === categoryHint);
  return { categoryId: cat?.id ?? null, sceneId: null };
}

/**
 * 候选适配的唯一判据：分类 + 场景 + 正文三维（用户要求 2a）。
 * 只看 AI 摘要会把「同一场景不同问题」误判成同一条；三维加权后，
 * 场景不同的问题即使措辞相似也不会被吃掉。
 */
export interface Dimensions {
  category: string;
  scene: string;
  body: string;
}

function dimScore(a: Dimensions, b: Dimensions): number {
  return (
    0.25 * literalSimilarity(a.category, b.category) +
    0.35 * literalSimilarity(a.scene, b.scene) +
    0.4 * literalSimilarity(a.body, b.body)
  );
}

interface DimRow {
  code: string;
  category_hint: string;
  scene_hint: string;
  summary: string;
  answer: string;
  cat_zh: string | null;
  scene_zh: string | null;
}

function rowDims(r: DimRow): Dimensions {
  return {
    category: r.cat_zh || r.category_hint || '',
    scene: r.scene_zh || r.scene_hint || '',
    body: `${r.summary} ${toPlainText(r.answer).slice(0, 300)}`,
  };
}

async function loadDims(dropped: boolean): Promise<DimRow[]> {
  const { rows } = await query<DimRow>(
    `SELECT c.code, c.category_hint, c.scene_hint, c.summary, c.answer,
            cat.name_zh AS cat_zh, s.name_zh AS scene_zh
     FROM extract_candidates c
     LEFT JOIN categories cat ON cat.id=c.category_id
     LEFT JOIN scenes s ON s.id=c.scene_id
     WHERE c.disposition ${dropped ? '=' : '<>'} 'dropped'
     ORDER BY c.created_at DESC LIMIT 500`,
  );
  return rows;
}

/** 垃圾箱三维指纹：新候选命中即自动丢弃 */
async function matchTrash(dims: Dimensions): Promise<{ hit: boolean; against: string }> {
  if (!dims.body.trim() && !dims.scene.trim()) return { hit: false, against: '' };
  for (const r of await loadDims(true)) {
    if (dimScore(dims, rowDims(r)) >= SUMMARY_MATCH) return { hit: true, against: r.code };
  }
  return { hit: false, against: '' };
}

/** 已入库候选的三维去重（同一批或历史批次里已经有同一个问题就不再重复产出） */
async function matchExisting(dims: Dimensions): Promise<string> {
  if (!dims.body.trim() && !dims.scene.trim()) return '';
  for (const r of await loadDims(false)) {
    if (dimScore(dims, rowDims(r)) >= SUMMARY_MATCH) return r.code;
  }
  return '';
}

/**
 * 跑一次抽取：拉 Zendesk 会话 → 大模型**按场景聚合**主题（含抽象摘要、分类场景建议、情绪、命中会话）
 * → 摘要去重与垃圾箱自动丢弃 → 起草候选并把命中的每条会话挂到候选下。
 * 失败如实落 failed + 原因，不假装成功。
 */
export async function runCollect(ownerName = '系统', ownerId: string | null = null): Promise<CollectTaskDto | null> {
  const id = newId('tsk');
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const code = await withCodeRetry(async () => {
    const next = await nextTaskCode();
    await query(
      `INSERT INTO collect_tasks (id, code, title, source, state, owner_id, owner_name, ran_at)
       VALUES ($1,$2,$3,'Zendesk 客服会话','running',$4,$5,now())`,
      [id, next, '近 7 日 Zendesk 客诉聚类', ownerId, ownerName],
    );
    return next;
  });

  try {
    const conv = await getZendesk().fetchConversations(since);
    const items = conv.items.map(desensitize).filter(Boolean);
    if (items.length === 0) {
      await query(
        `UPDATE collect_tasks SET state='done', candidate_count=0, source_meta=$2, fail_reason=$3 WHERE id=$1`,
        [
          id,
          `来自 Zendesk · 工单 ${conv.email} 封 / 会话 ${conv.chat} 段 · 共 0 段可用语料`,
          'Zendesk 近 7 日没有可用的会话正文（工单为空或正文被过滤），本批次未产出候选',
        ],
      );
      await writeAudit(SYSTEM_ACTOR, {
        action: 'AI 抽取',
        objectType: 'collect',
        objectCode: code,
        objectLabel: `${code} 无可用语料，未产出候选`,
      });
      return (await currentTask()).task;
    }

    const llm = getLlm();
    const topics = await llm.extractTopics(items);
    const published = await listEntries(`WHERE e.status='published'`);

    let n = 0;
    let dropped = 0;
    let deduped = 0;
    let autoTrashed = 0;
    let draftFailed = 0;
    for (const topic of topics) {
      // 置信度 = 起评 0.62 + 频次加成。起评必须高于阈值：低频场景是真实常态，
      // 起评 0.55 会让单条主题（0.59）永远被静默丢弃。
      const conf = Math.min(0.99, 0.62 + Math.min(topic.count, 10) * 0.035);
      if (conf < TUNABLES.confidenceThreshold) {
        dropped += 1;
        continue;
      }

      const topicDims: Dimensions = {
        category: topic.categoryHint,
        scene: topic.sceneHint,
        body: `${topic.abstract} ${topic.summary}`,
      };
      const dupCode = await matchExisting(topicDims);
      if (dupCode) {
        deduped += 1;
        continue;
      }

      // 单条起草失败不能拖垮整批：退回用主题与概括当草稿，人工在编辑器里补
      let draft: { title: string; body: string };
      try {
        draft = await llm.draftCandidate(topic.topic, topic.summary);
      } catch (e) {
        draftFailed += 1;
        draft = {
          title: topic.topic,
          body: `${topic.summary}\n\n（本条草稿正文自动生成失败：${e instanceof Error ? e.message : '未知错误'}，请人工补全）`,
        };
      }
      const trash = await matchTrash(topicDims);
      const { categoryId, sceneId } = await resolveTaxonomy(topic.categoryHint, topic.sceneHint);

      let best = { id: null as string | null, score: 0 };
      for (const p of published) {
        const s = literalSimilarity(topic.topic, `${p.title_zh} ${toPlainText(p.body_zh).slice(0, 200)}`);
        if (s > best.score) best = { id: p.id, score: s };
      }
      const dupHit = best.score >= TUNABLES.dedupeThreshold * 0.6;

      const candId = newId('cnd');
      // cron（每日 07:00）与运营手点「立即拉取」可能同时在跑，取号必须能重试，
      // 否则后到的一批会整个落进 catch，任务标 failed、fail_reason 是一句裸的 duplicate key
      await withCodeRetry(async () =>
        query(
        `INSERT INTO extract_candidates
           (id, code, task_id, title, answer, summary, category_id, scene_id, category_hint, scene_hint,
            tags, confidence, mention_count, sentiment, dup_entry_id, dup_score,
            disposition, drop_reason, auto_dropped, disposed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          candId,
          await nextCandidateCode(),
          id,
          draft.title || topic.topic,
          draft.body,
          topic.abstract,
          categoryId,
          sceneId,
          topic.categoryHint,
          topic.sceneHint,
          JSON.stringify([]),
          Number(conf.toFixed(3)),
          topic.count,
          topic.sentiment,
          dupHit ? best.id : null,
          dupHit ? Math.round(best.score * 100) : null,
          trash.hit ? 'dropped' : 'pending',
          trash.hit ? `自动丢弃：与垃圾箱中 ${trash.against} 的摘要高度相似` : null,
          trash.hit,
          trash.hit ? new Date() : null,
        ],
        ),
      );

      // 把命中的每一条会话挂到候选下，界面可点开逐条查看。
      // 模型没给 refs 时按字面相似度兜底——否则「N 个会话提及」点开是空的。
      let refs = topic.refs;
      if (refs.length === 0) {
        refs = items
          .map((text, i) => ({ i: i + 1, score: literalSimilarity(`${topic.topic} ${topic.abstract}`, text) }))
          .filter((x) => x.score >= 0.05)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map((x) => x.i);
      }
      for (const ref of refs) {
        const text = items[ref - 1];
        if (!text) continue;
        await query(
          `INSERT INTO candidate_sources (id, candidate_id, ticket_ref, channel, excerpt, occurred_at)
           VALUES ($1,$2,$3,$4,$5,now())`,
          [newId('csrc'), candId, `#${ref}`, 'Zendesk', text.slice(0, 1200)],
        );
      }
      // 会话数以真正挂上的条数为准，不用模型自报的数字
      if (refs.length) {
        await query('UPDATE extract_candidates SET mention_count=$2 WHERE id=$1', [candId, refs.length]);
      }

      if (trash.hit) autoTrashed += 1;
      else n += 1;
    }

    const notes: string[] = [];
    if (dropped) notes.push(`${dropped} 条低于置信度阈值 ${TUNABLES.confidenceThreshold}`);
    if (deduped) notes.push(`${deduped} 条与已有候选摘要重复`);
    if (autoTrashed) notes.push(`${autoTrashed} 条命中垃圾箱被自动丢弃`);
    if (draftFailed) notes.push(`${draftFailed} 条草稿正文自动生成失败，已退回主题概括待人工补全`);

    await query(
      `UPDATE collect_tasks SET state='done', candidate_count=$2, source_text=$3, source_meta=$4, fail_reason=$5 WHERE id=$1`,
      [
        id,
        n,
        items.slice(0, 3).join('\n\n'),
        `来自 Zendesk · 工单 ${conv.email} 封 / 会话 ${conv.chat} 段 · 共 ${items.length} 段 · 聚合主题 ${topics.length} 个`,
        notes.length ? `${n === 0 ? '本批次未产出待确认候选' : '本批次提示'}：${notes.join('；')}` : null,
      ],
    );
    await writeAudit(SYSTEM_ACTOR, {
      action: 'AI 抽取',
      objectType: 'collect',
      objectCode: code,
      objectLabel: `${code} 解析 ${items.length} 段会话，聚合 ${topics.length} 个主题，产出 ${n} 条候选${notes.length ? `（${notes.join('；')}）` : ''}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await query(`UPDATE collect_tasks SET state='failed', fail_reason=$2 WHERE id=$1`, [id, message]);
    await writeAudit(SYSTEM_ACTOR, {
      action: 'AI 抽取',
      objectType: 'collect',
      objectCode: code,
      objectLabel: `${code} 抽取失败`,
      result: '失败',
      detail: message,
    });
  }
  return (await currentTask()).task;
}

/* ══════════ 候选处置 ══════════ */

/* ══════════ 采纳向导（用户要求 2b~2e） ══════════ */

export interface AdoptNode {
  key: 'category' | 'scene' | 'body' | 'overview';
  title: string;
  hint: string;
}

export interface AdoptPlan {
  code: string;
  /** 节点数动态：已具备的信息直接跳过 */
  nodes: AdoptNode[];
  category: { id: string | null; nameZh: string; nameEn: string; fromLibrary: boolean };
  scene: { id: string | null; nameZh: string; nameEn: string; categoryId: string | null; fromLibrary: boolean };
  body: { titleZh: string; titleEn: string; bodyZh: string; bodyEn: string };
  mentionCount: number;
  summary: string;
}

interface CandRow {
  id: string;
  code: string;
  title: string;
  answer: string;
  summary: string;
  category_id: string | null;
  scene_id: string | null;
  category_hint: string;
  scene_hint: string;
  tags: string[];
  confidence: string;
  mention_count: number;
  task_code: string;
  disposition: string;
  cat_zh: string | null;
  cat_en: string | null;
  scene_zh: string | null;
  scene_en: string | null;
  scene_category_id: string | null;
}

async function loadCandidate(code: string): Promise<CandRow> {
  const { rows } = await query<CandRow>(
    `SELECT c.*, t.code AS task_code,
            cat.name_zh AS cat_zh, cat.name_en AS cat_en,
            s.name_zh AS scene_zh, s.name_en AS scene_en, s.category_id AS scene_category_id
     FROM extract_candidates c
     JOIN collect_tasks t ON t.id=c.task_id
     LEFT JOIN categories cat ON cat.id=c.category_id
     LEFT JOIN scenes s ON s.id=c.scene_id
     WHERE c.code=$1`,
    [code],
  );
  const c = rows[0];
  if (!c) throw new DomainError(`候选不存在：${code}`, 404);
  return c;
}

/** 采纳前的向导计划：库里已匹配上的维度直接跳过，其余带上 AI 建议值 */
export async function adoptPlan(code: string): Promise<AdoptPlan> {
  const c = await loadCandidate(code);
  if (c.disposition !== 'pending') throw new DomainError('该候选已处置。', 409);

  const categoryId = c.category_id ?? c.scene_category_id ?? null;
  let catZh = c.cat_zh ?? '';
  let catEn = c.cat_en ?? '';
  if (!c.cat_zh && categoryId) {
    const { rows } = await query<{ name_zh: string; name_en: string }>(
      'SELECT name_zh, name_en FROM categories WHERE id=$1',
      [categoryId],
    );
    catZh = rows[0]?.name_zh ?? '';
    catEn = rows[0]?.name_en ?? '';
  }
  const nodes: AdoptNode[] = [];
  if (!categoryId) {
    nodes.push({ key: 'category', title: '确认分类', hint: '库内没有匹配的一级分类，请确认 AI 的建议或改选已有分类' });
  }
  if (!c.scene_id) {
    nodes.push({ key: 'scene', title: '确认场景', hint: '库内没有匹配的二级场景，请确认 AI 的建议或改选已有场景' });
  }
  nodes.push({ key: 'body', title: '确认知识正文', hint: 'AI 起草的标题与正文，可直接编辑；英文用于写入 Zendesk' });
  nodes.push({ key: 'overview', title: '总览与提交', hint: '确认三个维度后提交，将生成分类、场景、正文三条审核记录' });

  return {
    code: c.code,
    nodes,
    category: {
      id: categoryId,
      nameZh: catZh || c.category_hint || '',
      nameEn: catEn,
      fromLibrary: Boolean(categoryId),
    },
    scene: {
      id: c.scene_id,
      nameZh: c.scene_zh ?? c.scene_hint ?? '',
      nameEn: c.scene_en ?? '',
      categoryId,
      fromLibrary: Boolean(c.scene_id),
    },
    body: { titleZh: c.title, titleEn: '', bodyZh: c.answer, bodyEn: '' },
    mentionCount: c.mention_count ?? 1,
    summary: c.summary ?? '',
  };
}

/** 按中文名找已存在的分类/场景（场景需限定在父分类下），用于向导重试时复用而不是再建一个 */
async function findTaxonomyByName(
  table: 'categories' | 'scenes',
  nameZh: string,
  categoryId: string | null,
): Promise<{ id: string; status: string } | null> {
  const { rows } = await query<{ id: string; status: string }>(
    table === 'scenes'
      ? `SELECT id, status FROM scenes WHERE name_zh=$1 AND category_id=$2 ORDER BY created_at LIMIT 1`
      : `SELECT id, status FROM categories WHERE name_zh=$1 ORDER BY created_at LIMIT 1`,
    table === 'scenes' ? [nameZh.trim(), categoryId] : [nameZh.trim()],
  );
  return rows[0] ?? null;
}

export interface AdoptInput {
  category: { id: string | null; nameZh: string; nameEn: string };
  scene: { id: string | null; nameZh: string; nameEn: string };
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
}

export interface AdoptResult {
  entryCode: string;
  reviews: Array<{ code: string; dimension: string; status: string; note: string }>;
  message: string;
}

/**
 * 采纳：按分类 → 场景 → 正文的顺序落地，每一步都落一条审核记录。
 * 新建的分类/场景若没有自动过审权限，就停在这里——门禁要求父级已发布才能往下走，
 * 与其半截落地，不如明确告诉用户在等哪一条审核。
 */
export async function adoptCandidate(user: SessionUser, code: string, input: AdoptInput): Promise<AdoptResult> {
  const c = await loadCandidate(code);
  if (c.disposition !== 'pending') throw new DomainError('该候选已处置。', 409);

  const { recordReuse } = await import('./reviews.js');
  const { upsertCategory, upsertScene } = await import('./meta.js');
  const { assertCategoryPublished, assertScenePublished } = await import('./gates.js');
  const reviews: AdoptResult['reviews'] = [];

  // ① 分类
  let categoryId = input.category.id;
  if (categoryId) {
    await assertCategoryPublished(categoryId);
    const { rows } = await query<{ code: string; name_zh: string }>(
      'SELECT code, name_zh FROM categories WHERE id=$1',
      [categoryId],
    );
    const rec = await recordReuse(user, {
      objectType: 'category',
      objectId: categoryId,
      objectCode: rows[0].code,
      objectLabel: rows[0].name_zh,
      payload: { nameZh: rows[0].name_zh, categoryZh: rows[0].name_zh },
      note: `采纳 ${code}：沿用已发布分类`,
    });
    reviews.push({ code: rec.code, dimension: '知识分类', status: rec.statusLabel, note: '沿用已发布分类' });
  } else {
    if (!input.category.nameZh.trim()) throw new DomainError('请确认一级分类。', 400);
    // 同名复用：向导在等审核时会提前返回，用户过后重进会再走一遍这里。
    // 不查同名的话，每中断-重试一轮就多一行同名分类和一条审核请求，
    // 全批过审后 Zendesk 上会出现重名 Category。
    const existing = await findTaxonomyByName('categories', input.category.nameZh, null);
    if (existing) {
      categoryId = existing.id;
      if (existing.status !== 'published') {
        return {
          entryCode: '',
          reviews,
          message: `分类「${input.category.nameZh}」已提交过审核（${existing.status === 'pending' ? '审核中' : '尚未上架'}），请等它通过后再回到本页采纳，不必重复新建。`,
        };
      }
    } else {
      const r = await upsertCategory(user, null, input.category.nameZh, input.category.nameEn);
      categoryId = r.item.id;
      reviews.push({
        code: r.review.code,
        dimension: '知识分类',
        status: r.review.applied ? '通过' : '待审核',
        note: r.review.message,
      });
      if (!r.review.applied) {
        return {
          entryCode: '',
          reviews,
          message: `新分类「${input.category.nameZh}」已提交审核（${r.review.code}）。分类通过后才能在其下创建场景与知识，请审核通过后回到本页重新采纳。`,
        };
      }
    }
  }

  // ② 场景
  let sceneId = input.scene.id;
  if (sceneId) {
    await assertScenePublished(sceneId);
    const { rows } = await query<{ code: string; name_zh: string }>('SELECT code, name_zh FROM scenes WHERE id=$1', [
      sceneId,
    ]);
    const rec = await recordReuse(user, {
      objectType: 'scene',
      objectId: sceneId,
      objectCode: rows[0].code,
      objectLabel: rows[0].name_zh,
      payload: { nameZh: rows[0].name_zh, sceneZh: rows[0].name_zh },
      note: `采纳 ${code}：沿用已发布场景`,
    });
    reviews.push({ code: rec.code, dimension: '问题场景', status: rec.statusLabel, note: '沿用已发布场景' });
  } else {
    if (!input.scene.nameZh.trim()) throw new DomainError('请确认二级场景。', 400);
    const existing = await findTaxonomyByName('scenes', input.scene.nameZh, categoryId!);
    if (existing) {
      sceneId = existing.id;
      if (existing.status !== 'published') {
        return {
          entryCode: '',
          reviews,
          message: `场景「${input.scene.nameZh}」已提交过审核（${existing.status === 'pending' ? '审核中' : '尚未上架'}），请等它通过后再回到本页采纳，不必重复新建。`,
        };
      }
    } else {
      const r = await upsertScene(user, null, input.scene.nameZh, input.scene.nameEn, categoryId!);
      sceneId = r.item.id;
      reviews.push({
        code: r.review.code,
        dimension: '问题场景',
        status: r.review.applied ? '通过' : '待审核',
        note: r.review.message,
      });
      if (!r.review.applied) {
        return {
          entryCode: '',
          reviews,
          message: `新场景「${input.scene.nameZh}」已提交审核（${r.review.code}）。场景通过后才能在其下创建知识，请审核通过后回到本页重新采纳。`,
        };
      }
    }
  }

  // ③ 正文
  const entry = await createEntry(user, {
    titleZh: input.titleZh,
    bodyZh: input.bodyZh,
    categoryId,
    sceneId,
    tags: c.tags ?? [],
    source: `AI 抽取 · ${c.task_code} / ${c.code}`,
    confidence: Number(c.confidence),
    quality: 60,
  });
  const { saveEntry, submitEntry } = await import('./entries.js');
  await saveEntry(user, entry.code, {
    titleZh: input.titleZh,
    titleEn: input.titleEn,
    bodyZh: input.bodyZh,
    bodyEn: input.bodyEn,
    categoryId,
    sceneId,
    tags: c.tags ?? [],
    note: `由抽取候选 ${code} 采纳生成`,
    enEdited: Boolean(input.bodyEn.trim()),
  });
  if (input.titleEn.trim() && input.bodyEn.trim()) {
    await query('UPDATE entries SET translated=TRUE WHERE code=$1', [entry.code]);
  }
  await query(
    `UPDATE extract_candidates SET disposition='accepted', disposed_by=$2, disposed_at=now(), entry_id=$3 WHERE code=$1`,
    [code, user.id, entry.id],
  );
  await writeAudit(actorOf(user), {
    action: 'AI 抽取候选采纳',
    objectCode: entry.code,
    objectLabel: `${entry.code} ${input.titleZh}（来自 ${code}）`,
  });

  const submitted = await submitEntry(user, entry.code);
  if (submitted.errors.length) {
    reviews.push({
      code: '—',
      dimension: '知识正文',
      status: '草稿',
      note: `未能自动提交审核：${submitted.errors.join('；')}`,
    });
    return {
      entryCode: entry.code,
      reviews,
      message: `已生成 ${entry.code}，但还差：${submitted.errors.join('；')}。请在编辑器补全后提交审核。`,
    };
  }
  const { openRequestFor, listRecords } = await import('./reviews.js');
  const open = await openRequestFor('entry', entry.id);
  if (open) {
    reviews.push({ code: open.code, dimension: '知识正文', status: '待审核', note: '等待审核通过后发布并同步 Zendesk' });
  } else {
    const done = (await listRecords(20)).find((r) => r.objectType === 'entry' && r.objectId === entry.id);
    reviews.push({
      code: done?.code ?? '—',
      dimension: '知识正文',
      status: '通过',
      note: '自动过审并已发布，Zendesk 同步结果见发布与同步',
    });
  }
  return {
    entryCode: entry.code,
    reviews,
    message: `已采纳并生成 ${entry.code}，共留下 ${reviews.length} 条审核记录。`,
  };
}

/** 旧的一键生成草稿：保留给未走向导的调用方（反馈转草稿等） */
export async function acceptCandidate(user: SessionUser, code: string): Promise<EntryRow> {
  const c = await loadCandidate(code);
  if (c.disposition !== 'pending') throw new DomainError('该候选已处置。', 409);
  const categoryId = c.category_id ?? c.scene_category_id ?? null;
  const entry = await createEntry(user, {
    titleZh: c.title,
    bodyZh: c.answer,
    categoryId,
    sceneId: c.scene_id,
    tags: c.tags ?? [],
    source: `AI 抽取 · ${c.task_code} / ${c.code}`,
    confidence: Number(c.confidence),
    quality: 60,
  });
  await query(
    `UPDATE extract_candidates SET disposition='accepted', disposed_by=$2, disposed_at=now(), entry_id=$3 WHERE code=$1`,
    [code, user.id, entry.id],
  );
  await writeAudit(actorOf(user), {
    action: 'AI 抽取生成草稿',
    objectCode: entry.code,
    objectLabel: `${entry.code} ${c.title}`,
  });
  return findEntry(entry.code);
}

export async function dropCandidate(user: SessionUser, code: string, reason = ''): Promise<void> {
  const { rows } = await query<{ title: string }>(
    `UPDATE extract_candidates SET disposition='dropped', drop_reason=$3, auto_dropped=FALSE,
            disposed_by=$2, disposed_at=now()
     WHERE code=$1 AND disposition='pending' RETURNING title`,
    [code, user.id, reason || '人工丢弃'],
  );
  if (!rows[0]) throw new DomainError(`候选不存在或已处置：${code}`, 404);
  await writeAudit(actorOf(user), {
    action: '丢弃抽取候选',
    objectType: 'candidate',
    objectCode: code,
    objectLabel: `${code} ${rows[0].title}`,
  });
}

/** 从垃圾箱恢复：回到待确认，同时清掉自动丢弃标记（否则下次抽取又会被它匹配掉） */
export async function restoreCandidate(user: SessionUser, code: string): Promise<void> {
  const { rows } = await query<{ title: string }>(
    `UPDATE extract_candidates SET disposition='pending', drop_reason=NULL, auto_dropped=FALSE,
            disposed_by=NULL, disposed_at=NULL
     WHERE code=$1 AND disposition='dropped' RETURNING title`,
    [code],
  );
  if (!rows[0]) throw new DomainError(`候选不在垃圾箱：${code}`, 404);
  await writeAudit(actorOf(user), {
    action: '从垃圾箱恢复候选',
    objectType: 'candidate',
    objectCode: code,
    objectLabel: `${code} ${rows[0].title}`,
  });
}

/**
 * 清空抽取工作台。
 * `mode='discard'`（默认）把待确认候选移进垃圾箱——它们的摘要会成为自动丢弃指纹，
 * 下次抽到同类问题直接进垃圾箱，不再反复冒出来；
 * `mode='purge'` 则连同垃圾箱一起物理删除（连带 candidate_sources 级联）。
 */
export async function clearWorkbench(
  user: SessionUser,
  mode: 'discard' | 'purge' = 'discard',
): Promise<{ moved: number; purged: number }> {
  if (mode === 'purge') {
    const { rowCount } = await query(`DELETE FROM extract_candidates WHERE disposition <> 'accepted'`);
    await query(`DELETE FROM collect_tasks WHERE NOT EXISTS (
      SELECT 1 FROM extract_candidates c WHERE c.task_id = collect_tasks.id)`);
    await writeAudit(actorOf(user), {
      action: '清空抽取工作台',
      objectType: 'collect',
      objectCode: null,
      objectLabel: `物理删除 ${rowCount ?? 0} 条候选与其空任务`,
    });
    return { moved: 0, purged: rowCount ?? 0 };
  }
  const { rowCount } = await query(
    `UPDATE extract_candidates SET disposition='dropped', drop_reason='清空工作台', auto_dropped=FALSE,
            disposed_by=$1, disposed_at=now()
     WHERE disposition='pending'`,
    [user.id],
  );
  await writeAudit(actorOf(user), {
    action: '清空抽取工作台',
    objectType: 'collect',
    objectCode: null,
    objectLabel: `${rowCount ?? 0} 条待确认候选移入垃圾箱`,
  });
  return { moved: rowCount ?? 0, purged: 0 };
}
