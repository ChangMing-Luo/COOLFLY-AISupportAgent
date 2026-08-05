import { TUNABLES, zhCN, type SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { desensitize } from '../core/content.js';
import { getLlm, literalSimilarity } from '../integrations/llm.js';
import { getZendesk, ZendeskApiError } from '../integrations/zendesk.js';
import { DomainError } from './entries.js';

export async function listBatches(): Promise<
  Array<{ id: string; batchDate: string; emailCount: number; chatCount: number; candidateCount: number; status: string; failReason: string | null }>
> {
  const { rows } = await query<{
    id: string; batch_date: string; email_count: number; chat_count: number; candidate_count: number; status: string; fail_reason: string | null;
  }>(`SELECT id, to_char(batch_date, 'YYYY-MM-DD') AS batch_date, email_count, chat_count, candidate_count, status, fail_reason
      FROM mining_batches ORDER BY batch_date DESC`);
  return rows.map((b) => ({
    id: b.id,
    batchDate: b.batch_date,
    emailCount: b.email_count,
    chatCount: b.chat_count,
    candidateCount: b.candidate_count,
    status: b.status,
    failReason: b.fail_reason,
  }));
}

export async function listCandidates(batchId?: string): Promise<
  Array<{
    id: string; batchId: string; type: string; title: string; sourceSummary: string; frequency: number;
    dedupeScore: number; dedupeReason: string; dedupeDegraded: boolean; gapVerdict: string; aiSummary: string; admissionNote: string;
    targetEntryCode: string | null; disposition: string; canCreateNew: boolean;
  }>
> {
  const { rows } = await query<{
    id: string; batch_id: string; type: string; title: string; source_summary: string; frequency: number;
    dedupe_score: string; dedupe_reason: string; dedupe_degraded: boolean; gap_verdict: string; ai_summary: string; admission_note: string;
    target_entry_code: string | null; disposition: string;
  }>(
    batchId
      ? 'SELECT * FROM mining_candidates WHERE batch_id=$1 ORDER BY frequency DESC'
      : 'SELECT * FROM mining_candidates ORDER BY frequency DESC',
    batchId ? [batchId] : [],
  );
  return rows.map((c) => ({
    id: c.id,
    batchId: c.batch_id,
    type: c.type,
    title: c.title,
    sourceSummary: c.source_summary,
    frequency: c.frequency,
    dedupeScore: Number(c.dedupe_score),
    dedupeReason: c.dedupe_reason,
    dedupeDegraded: c.dedupe_degraded,
    gapVerdict: c.gap_verdict,
    aiSummary: c.ai_summary,
    admissionNote: c.admission_note,
    targetEntryCode: c.target_entry_code,
    disposition: c.disposition,
    // 三重准入②：查重 ≥0.85 不提供「立新条」，仅可挂修订（AC-P-09）
    canCreateNew: Number(c.dedupe_score) < TUNABLES.dedupeThreshold,
  }));
}

/** 每日批次：拉取 → 脱敏 → 聚类计频 → 三重准入 → LLM 起草 → 候选落库 */
export async function runDailyBatch(batchDate: string): Promise<{ batchId: string; status: string }> {
  const zd = getZendesk();
  const batchId = newId('batch');
  try {
    const conv = await zd.fetchConversations(`${batchDate}T00:00:00Z`);
    // 会话正文先脱敏再进 LLM 与落库（NFR-004 数据治理：原文不出本机）
    const corpus = conv.items.map((t) => desensitize(t)).filter((t) => t.trim().length >= 8);
    const topics = await deriveTopics(corpus, conv.email, conv.chat);
    if (topics.length === 0) {
      await query(
        `INSERT INTO mining_batches (id, batch_date, email_count, chat_count, candidate_count, status)
         VALUES ($1,$2,$3,$4,0,'empty')`,
        [batchId, batchDate, conv.email, conv.chat],
      );
      return { batchId, status: 'empty' };
    }
    await query(
      `INSERT INTO mining_batches (id, batch_date, email_count, chat_count, candidate_count, status)
       VALUES ($1,$2,$3,$4,$5,'completed')`,
      [batchId, batchDate, conv.email, conv.chat, topics.length],
    );
    const llm = getLlm();
    for (const t of topics) {
      const draft = await llm.draftCandidate(t.topic, t.sourceSummary);
      await query(
        `INSERT INTO mining_candidates (id, batch_id, type, title, source_summary, frequency, dedupe_score,
           dedupe_reason, dedupe_degraded, gap_verdict, ai_summary, draft_body, admission_note, target_entry_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          newId('cand'),
          batchId,
          t.type,
          t.topic,
          desensitize(t.sourceSummary),
          t.frequency,
          t.dedupe,
          t.dedupeReason,
          t.dedupeDegraded,
          t.gapVerdict,
          desensitize(draft.summary),
          draft.body,
          t.admissionNote,
          t.targetEntryCode,
        ],
      );
    }
    return { batchId, status: 'completed' };
  } catch (err) {
    const e = err as ZendeskApiError;
    const reason = e instanceof ZendeskApiError && e.status === 429
      ? 'Zendesk API 429 限流 · 次日照常拉取'
      : `${e.message ?? '拉取失败'} · 次日照常拉取`;
    await query(
      `INSERT INTO mining_batches (id, batch_date, email_count, chat_count, candidate_count, status, fail_reason)
       VALUES ($1,$2,0,0,0,'failed',$3)`,
      [batchId, batchDate, reason],
    );
    return { batchId, status: 'failed' };
  }
}

interface DerivedTopic {
  topic: string;
  sourceSummary: string;
  frequency: number;
  dedupe: number;
  dedupeReason: string;
  dedupeDegraded: boolean;
  gapVerdict: string;
  type: string;
  admissionNote: string;
  targetEntryCode: string | null;
}

/**
 * 从**真实会话正文**提炼主题（08-05-2026 修复：原实现只取会话计数、主题恒为写死的 3 条，
 * 即使配上 Zendesk 凭据也永远产出同样的假数据——视图④核心功能形同虚设）。
 */
async function deriveTopics(corpus: string[], emailCount: number, chatCount: number): Promise<DerivedTopic[]> {
  const llm0 = getLlm();
  const pool = (await llm0.extractTopics(corpus)).map((t) => ({
    topic: t.topic,
    summary: `${t.count} 会话 · 工单 ${emailCount} / 聊天 ${chatCount}｜${t.summary}`,
    count: t.count,
  }));
  const out: DerivedTopic[] = [];
  const { rows: entries } = await query<{ code: string; title: string; ai_summary: string }>(
    `SELECT code, title, ai_summary FROM entries WHERE status IN ('published','approved')`,
  );
  const llm = getLlm();

  for (const p of pool) {
    // 三重准入①频次：用该主题真实命中的会话数，不再是计数派生的伪随机值
    const frequency = p.count;
    if (frequency < TUNABLES.frequencyThreshold) continue;

    // 三重准入② LLM 语义查重（两段式，技术方案 §6.2）
    // 第一段：字面粗筛 Top-N，把 LLM 调用量与库规模脱钩
    const shortlist = entries
      .map((e) => ({
        code: e.code,
        title: e.title,
        summary: e.ai_summary,
        score: literalSimilarity(p.topic, `${e.title} ${e.ai_summary}`),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TUNABLES.dedupeShortlist);
    // 第二段：LLM 依 AI 摘要判定，输出 {条目标识, 相似度, 理由}；结果一次定分落库不重算
    const verdict = await llm.judgeDuplicate(p.topic, p.summary, shortlist);

    const isDup = verdict.similarity >= TUNABLES.dedupeThreshold && verdict.code !== null;
    out.push({
      topic: p.topic,
      sourceSummary: p.summary,
      frequency,
      dedupe: Number(verdict.similarity.toFixed(2)),
      dedupeReason: verdict.reason,
      dedupeDegraded: verdict.degraded,
      gapVerdict: isDup ? '已覆盖但答不好' : '未覆盖',
      type: isDup ? 'revision' : 'new',
      admissionNote: isDup ? zhCN.mine.dedupeHigh : '三重准入通过 → 建议立新条',
      targetEntryCode: isDup ? verdict.code : null,
    });
  }
  return out;
}

/** 候选处置——无任何直接入库路径：起草/挂修订/合并全部进审核中心 */
export async function disposeCandidate(
  user: SessionUser,
  candidateId: string,
  action: 'draft' | 'attach_revision' | 'merge' | 'discard' | 'suggest',
): Promise<{ disposition: string; entryId?: string }> {
  const { rows } = await query<{
    id: string; title: string; draft_body: string; type: string; dedupe_score: string; target_entry_code: string | null; disposition: string; ai_summary: string;
  }>('SELECT * FROM mining_candidates WHERE id=$1', [candidateId]);
  const c = rows[0];
  if (!c) throw new DomainError('候选不存在', 404);
  if (c.disposition !== 'pending') throw new DomainError('该候选已处置', 409);

  if (action === 'discard') {
    await query(`UPDATE mining_candidates SET disposition='discarded', disposed_by=$2, disposed_at=now() WHERE id=$1`, [candidateId, user.id]);
    await writeAudit(user, {
      objectType: 'candidate', objectId: candidateId, objectLabel: c.title,
      action: '丢弃候选', category: 'content', note: zhCN.mine.discarded,
    });
    return { disposition: 'discarded' };
  }

  if (action === 'draft' && Number(c.dedupe_score) >= TUNABLES.dedupeThreshold) {
    throw new DomainError(`查重 ${c.dedupe_score} ≥ ${TUNABLES.dedupeThreshold}——不新建，请挂为修订建议`, 409);
  }

  const { rows: libs } = await query<{ id: string }>('SELECT id FROM libraries ORDER BY sort_order LIMIT 1');
  const { rows: chaps } = await query<{ id: string }>(
    'SELECT id FROM chapters WHERE parent_id IS NOT NULL ORDER BY sort_order LIMIT 1',
  );
  const entryId = newId('ent');
  const { rows: maxCode } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INT))::text AS max FROM entries WHERE code ~ '^KB-[0-9]+$'`,
  );
  const code = `KB-${String(Number(maxCode[0]?.max ?? '200') + 1).padStart(4, '0')}`;
  const paragraphs = c.draft_body.split('\n').filter((l) => l.trim()).map((text, i) => ({
    id: `p_${i}`, text, internal: false, heading: i === 0,
  }));

  const sourceLabel = action === 'suggest' ? 'feedback' : action === 'attach_revision' ? 'revision' : 'mining';
  await query(
    `INSERT INTO entries (id, code, title, library_id, chapter_id, entry_type, visibility, scene_l1, scene_l2,
       labels, body, status, review_source, submitter_id, submitted_at)
     VALUES ($1,$2,$3,$4,$5,'FAQ 型','public','设备使用','其他',$6::jsonb,$7::jsonb,'pending_review',$8,$9,now())`,
    [
      entryId, code, c.title, libs[0]!.id, chaps[0]!.id,
      JSON.stringify(['AI 挖掘', c.type === 'revision' ? '修订建议' : '新增']),
      JSON.stringify({ paragraphs: paragraphs.length ? paragraphs : [{ id: 'p_0', text: c.ai_summary, html: '', internal: false, heading: false }] }),
      sourceLabel, user.id,
    ],
  );
  const disposition = action === 'draft' ? 'drafted' : action === 'attach_revision' ? 'attached' : action === 'merge' ? 'merged' : 'suggested';
  await query(`UPDATE mining_candidates SET disposition=$2, disposed_by=$3, disposed_at=now() WHERE id=$1`, [candidateId, disposition, user.id]);
  await writeAudit(user, {
    objectType: 'candidate', objectId: candidateId, objectLabel: c.title,
    action: action === 'draft' ? '起草并提交审核' : action === 'attach_revision' ? '挂为修订建议' : action === 'merge' ? '发起合并（进审核）' : '提交优化建议',
    category: 'content',
    field: '处置',
    before: 'pending',
    after: disposition,
    note: `产物进审核中心（来源：${sourceLabel}），无直接入库路径`,
  });
  return { disposition, entryId };
}
