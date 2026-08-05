import { TUNABLES, type SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit, SYSTEM_ACTOR } from '../core/audit.js';
import { desensitize, toPlainText } from '../core/content.js';
import { fmtShort } from '../core/fmt.js';
import { getZendesk } from '../integrations/zendesk.js';
import { getLlm, literalSimilarity } from '../integrations/llm.js';
import { DomainError, actorOf, createEntry, findEntry, listEntries, type EntryRow } from './entries.js';

export interface CandidateDto {
  code: string;
  title: string;
  answer: string;
  sceneZh: string;
  tags: string[];
  confidence: number;
  confidencePct: string;
  state: '高置信' | '需复核' | '低置信';
  tagClass: string;
  dup: boolean;
  dupCode: string | null;
  dupTitle: string | null;
  dupScore: string | null;
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

function candState(conf: number): { state: CandidateDto['state']; tagClass: string } {
  if (conf > 0.8) return { state: '高置信', tagClass: 'tag-accent' };
  if (conf > 0.6) return { state: '需复核', tagClass: 'tag-outline' };
  return { state: '低置信', tagClass: 'tag-neutral' };
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

  const { rows: cands } = await query<{
    code: string;
    title: string;
    answer: string;
    tags: string[];
    confidence: string;
    dup_score: number | null;
    scene_zh: string | null;
    dup_code: string | null;
    dup_title: string | null;
  }>(
    `SELECT c.code, c.title, c.answer, c.tags, c.confidence, c.dup_score,
            s.name_zh AS scene_zh, d.code AS dup_code, d.title_zh AS dup_title
     FROM extract_candidates c
     LEFT JOIN scenes s  ON s.id = c.scene_id
     LEFT JOIN entries d ON d.id = c.dup_entry_id
     WHERE c.task_id=$1 AND c.disposition='pending'
     ORDER BY c.confidence DESC, c.created_at`,
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
    candidates: cands.map((c) => {
      const conf = Number(c.confidence);
      const st = candState(conf);
      return {
        code: c.code,
        title: c.title,
        answer: c.answer,
        sceneZh: c.scene_zh ?? '未设置',
        tags: c.tags ?? [],
        confidence: conf,
        confidencePct: `${Math.round(conf * 100)}%`,
        state: st.state,
        tagClass: st.tagClass,
        dup: Boolean(c.dup_code),
        dupCode: c.dup_code,
        dupTitle: c.dup_code ? `${c.dup_code} ${c.dup_title}` : null,
        dupScore: c.dup_score ? `${c.dup_score}%` : null,
      };
    }),
  };
}

async function nextTaskCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'CT-([0-9]+)') AS INT))::text AS max FROM collect_tasks`,
  );
  return `CT-${Number(rows[0]?.max ?? 3000) + 1}`;
}

async function nextCandidateCode(): Promise<string> {
  const { rows } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM extract_candidates');
  return `EX-${String(Number(rows[0].n) + 1).padStart(2, '0')}`;
}

/**
 * 跑一次抽取：拉 Zendesk 会话 → 大模型提炼主题 → 起草候选 → 字面查重。
 * 由后台定时任务与「立即运行」共用；失败如实落 failed + 原因，不假装成功。
 */
export async function runCollect(ownerName = '系统', ownerId: string | null = null): Promise<CollectTaskDto> {
  const id = newId('tsk');
  const code = await nextTaskCode();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  await query(
    `INSERT INTO collect_tasks (id, code, title, source, state, owner_id, owner_name, ran_at)
     VALUES ($1,$2,$3,'Zendesk 客服会话','running',$4,$5,now())`,
    [id, code, '近 7 日 Zendesk 客诉聚类', ownerId, ownerName],
  );

  try {
    const conv = await getZendesk().fetchConversations(since);
    const items = conv.items.map(desensitize).filter(Boolean);
    if (items.length === 0) {
      await query(
        `UPDATE collect_tasks SET state='done', candidate_count=0, source_meta=$2 WHERE id=$1`,
        [id, `来自 Zendesk · 客服会话 · 共 0 段 · 已解析 0 段`],
      );
      await writeAudit(SYSTEM_ACTOR, {
        action: 'AI 抽取',
        objectType: 'collect',
        objectCode: code,
        objectLabel: `${code} 无新会话，未产出候选`,
      });
      return (await currentTask()).task!;
    }

    const llm = getLlm();
    const topics = await llm.extractTopics(items);
    const published = await listEntries(`WHERE e.status='published'`);
    const scenes = await query<{ id: string; name_zh: string }>('SELECT id, name_zh FROM scenes WHERE active');

    let n = 0;
    for (const topic of topics) {
      const draft = await llm.draftCandidate(topic.topic, topic.summary);
      const conf = Math.min(0.99, 0.55 + Math.min(topic.count, 10) * 0.04);
      if (conf < TUNABLES.confidenceThreshold) continue;

      let best = { id: null as string | null, score: 0 };
      for (const p of published) {
        const s = literalSimilarity(topic.topic, `${p.title_zh} ${toPlainText(p.body_zh).slice(0, 200)}`);
        if (s > best.score) best = { id: p.id, score: s };
      }
      const dupHit = best.score >= TUNABLES.dedupeThreshold * 0.6;
      const scene = scenes.rows.find((s) => topic.topic.includes(s.name_zh.slice(0, 2)));

      await query(
        `INSERT INTO extract_candidates (id, code, task_id, title, answer, scene_id, tags, confidence, dup_entry_id, dup_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
        [
          newId('cnd'),
          await nextCandidateCode(),
          id,
          draft.title || topic.topic,
          draft.body,
          scene?.id ?? null,
          JSON.stringify([]),
          Number(conf.toFixed(3)),
          dupHit ? best.id : null,
          dupHit ? Math.round(best.score * 100) : null,
        ],
      );
      n += 1;
    }

    await query(
      `UPDATE collect_tasks SET state='done', candidate_count=$2, source_text=$3, source_meta=$4 WHERE id=$1`,
      [
        id,
        n,
        items.slice(0, 3).join('\n\n'),
        `来自 Zendesk · 客服会话 · 共 ${items.length} 段 · 已解析 ${items.length} 段`,
      ],
    );
    await writeAudit(SYSTEM_ACTOR, {
      action: 'AI 抽取',
      objectType: 'collect',
      objectCode: code,
      objectLabel: `${code} 产出 ${n} 条候选`,
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
  return (await currentTask()).task!;
}

/* ══════════ 候选处置 ══════════ */

export async function acceptCandidate(user: SessionUser, code: string): Promise<EntryRow> {
  const { rows } = await query<{
    id: string;
    code: string;
    title: string;
    answer: string;
    scene_id: string | null;
    tags: string[];
    confidence: string;
    task_code: string;
    disposition: string;
  }>(
    `SELECT c.*, t.code AS task_code FROM extract_candidates c
     JOIN collect_tasks t ON t.id=c.task_id WHERE c.code=$1`,
    [code],
  );
  const c = rows[0];
  if (!c) throw new DomainError(`候选不存在：${code}`, 404);
  if (c.disposition !== 'pending') throw new DomainError('该候选已处置。', 409);

  const { rows: sc } = c.scene_id
    ? await query<{ category_id: string }>('SELECT category_id FROM scenes WHERE id=$1', [c.scene_id])
    : { rows: [] as Array<{ category_id: string }> };

  const entry = await createEntry(user, {
    titleZh: c.title,
    bodyZh: c.answer,
    categoryId: sc[0]?.category_id ?? null,
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

export async function dropCandidate(user: SessionUser, code: string): Promise<void> {
  const { rows } = await query<{ title: string }>(
    `UPDATE extract_candidates SET disposition='dropped', disposed_by=$2, disposed_at=now()
     WHERE code=$1 AND disposition='pending' RETURNING title`,
    [code, user.id],
  );
  if (!rows[0]) throw new DomainError(`候选不存在或已处置：${code}`, 404);
  await writeAudit(actorOf(user), {
    action: '丢弃抽取候选',
    objectType: 'candidate',
    objectCode: code,
    objectLabel: `${code} ${rows[0].title}`,
  });
}
