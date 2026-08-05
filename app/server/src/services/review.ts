import {
  canTransitionEntry,
  rejectSchema,
  type GateResult,
  type ReviewDiff,
  type SessionUser,
  type EntryBody,
  type Visibility,
  type EnStatus,
} from '@kb/contracts';
import { withTransaction, query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { runPublishGate } from '../core/gate.js';
import { toPlainText } from '../core/content.js';
import { getLlm } from '../integrations/llm.js';
import { DomainError } from './entries.js';

interface ReviewRow {
  id: string;
  code: string;
  title: string;
  status: string;
  visibility: Visibility;
  labels: string[];
  chapter_id: string;
  en_status: EnStatus;
  body: EntryBody;
  ai_summary: string;
  summary_source: string;
  submitter_id: string | null;
  current_version: number;
  review_source: string;
  review_cycle_days: number;
}

export async function reviewQueue(): Promise<
  Array<{
    id: string;
    code: string;
    title: string;
    source: string;
    submitterName: string | null;
    submittedAt: string | null;
    chapterPath: string;
    visibility: string;
    versionLabel: string;
    status: string;
    /** 摘要层：一行总览 + 逐项一句话概述（详情层走 GET /review/:id/diff） */
    diffTotal: string;
    changeSummary: Array<{ kind: 'add' | 'del' | 'mod'; text: string }>;
  }>
> {
  const { rows } = await query<{
    id: string;
    code: string;
    title: string;
    review_source: string;
    submitter_name: string | null;
    submitted_at: Date | null;
    chapter_name: string;
    library_name: string;
    visibility: string;
    current_version: number;
    status: string;
    body: EntryBody;
    prev_body: EntryBody | null;
  }>(
    `SELECT e.id, e.code, e.title, e.review_source, u.name AS submitter_name, e.submitted_at,
            c.name AS chapter_name, l.name AS library_name, e.visibility, e.current_version, e.status, e.body,
            (SELECT v.body_snapshot FROM entry_versions v WHERE v.entry_id = e.id AND v.status='current' ORDER BY v.version_no DESC LIMIT 1) AS prev_body
     FROM entries e
     JOIN chapters c ON c.id = e.chapter_id
     JOIN libraries l ON l.id = e.library_id
     LEFT JOIN users u ON u.id = e.submitter_id
     WHERE e.status IN ('pending_review','reviewing')
     ORDER BY e.submitted_at ASC NULLS LAST`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    source: r.review_source,
    submitterName: r.submitter_name,
    submittedAt: r.submitted_at ? r.submitted_at.toISOString() : null,
    chapterPath: `${r.library_name} / ${r.chapter_name}`,
    visibility: r.visibility,
    versionLabel: r.current_version > 0 ? `v${r.current_version + 1}（修订 v${r.current_version}）` : 'v1（新建）',
    status: r.status,
    diffTotal: buildDiff(r.prev_body, r.body).total,
    changeSummary: buildDiff(r.prev_body, r.body).summary,
  }));
}

/**
 * 变更对照两层（REQ-F09-15 rev6）：
 * total/summary = 摘要层（大概摘要），lines = 详情层（git diff 风格逐行）。
 * 按段落做最长公共子序列对齐——同一次请求算出两层，避免两处口径漂移。
 */
export function buildDiff(prev: EntryBody | null, next: EntryBody): ReviewDiff {
  const after = next.paragraphs;
  if (!prev) {
    return {
      total: `新建条目 · ${after.length} 个段落`,
      summary: after.slice(0, 6).map((p) => ({ kind: 'add' as const, text: `新增段落：${clip(p.text)}` })),
      lines: after.map((p, i) => ({
        kind: 'add' as const,
        beforeLine: null,
        afterLine: i + 1,
        text: p.text,
        internal: p.internal,
      })),
      isNew: true,
    };
  }
  const before = prev.paragraphs;
  const lcs = longestCommon(before.map((p) => p.text), after.map((p) => p.text));
  const lines: ReviewDiff['lines'] = [];
  const summary: ReviewDiff['summary'] = [];
  let bi = 0;
  let ai = 0;
  const emitDel = (idx: number): void => {
    lines.push({ kind: 'del', beforeLine: idx + 1, afterLine: null, text: before[idx]!.text, internal: before[idx]!.internal });
  };
  const emitAdd = (idx: number): void => {
    lines.push({ kind: 'add', beforeLine: null, afterLine: idx + 1, text: after[idx]!.text, internal: after[idx]!.internal });
  };
  for (const common of [...lcs, null]) {
    const delStart = bi;
    const addStart = ai;
    while (bi < before.length && before[bi]!.text !== common) { emitDel(bi); bi += 1; }
    while (ai < after.length && after[ai]!.text !== common) { emitAdd(ai); ai += 1; }
    const dels = bi - delStart;
    const adds = ai - addStart;
    if (dels > 0 && adds > 0) {
      summary.push({ kind: 'mod', text: `${clip(before[delStart]!.text)} → ${clip(after[addStart]!.text)}` });
    } else if (dels > 0) {
      summary.push({ kind: 'del', text: `删除段落：${clip(before[delStart]!.text)}` });
    } else if (adds > 0) {
      summary.push({ kind: 'add', text: `新增段落：${clip(after[addStart]!.text)}` });
    }
    if (common !== null) {
      lines.push({ kind: 'ctx', beforeLine: bi + 1, afterLine: ai + 1, text: common, internal: after[ai]!.internal });
      bi += 1;
      ai += 1;
    }
  }
  const changed = lines.filter((l) => l.kind !== 'ctx').length;
  return {
    total: changed === 0 ? '正文无改动' : `正文 ${summary.length} 处改动 · ${changed} 行增删`,
    summary: summary.slice(0, 8),
    lines,
    isNew: false,
  };
}

function clip(text: string): string {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/** 最长公共子序列（段落粒度），用于 diff 对齐 */
function longestCommon(a: string[], b: string[]): string[] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]!); i += 1; j += 1; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return out;
}

/** 详情层：审核中心「查看具体变更」按需拉取 */
export async function entryDiff(entryId: string): Promise<ReviewDiff> {
  const { rows } = await query<{ body: EntryBody; prev_body: EntryBody | null }>(
    `SELECT e.body,
            (SELECT v.body_snapshot FROM entry_versions v WHERE v.entry_id = e.id AND v.status='current' ORDER BY v.version_no DESC LIMIT 1) AS prev_body
     FROM entries e WHERE e.id=$1`,
    [entryId],
  );
  const r = rows[0];
  if (!r) throw new DomainError('条目不存在', 404);
  return buildDiff(r.prev_body, r.body);
}

async function loadForReview(client: import('pg').PoolClient, entryId: string): Promise<ReviewRow> {
  const { rows } = await client.query<ReviewRow>('SELECT * FROM entries WHERE id=$1 FOR UPDATE', [entryId]);
  const e = rows[0];
  if (!e) throw new DomainError('条目不存在', 404);
  return e;
}

/**
 * 审核通过（RULE-02 / AC-P-23 rev6）。
 * 08-05-2026：四眼原则已取消——审核员可审核自己提交的条目，接口不再拒绝。
 * 制衡改为事后审计：自审事实写进审计日志备注，操作日志里可查。
 */
export async function approveEntry(user: SessionUser, entryId: string): Promise<{ status: string }> {
  return withTransaction(async (client) => {
    const e = await loadForReview(client, entryId);
    const selfReview = !!e.submitter_id && e.submitter_id === user.id;
    if (!canTransitionEntry(e.status as never, 'approved')) {
      throw new DomainError(`当前状态「${e.status}」不可审核通过`, 409);
    }
    await client.query(
      `UPDATE entries SET status='approved', reviewer_id=$2, reviewed_at=now(), reject_reason=NULL, updated_at=now() WHERE id=$1`,
      [entryId, user.id],
    );
    await writeAudit(
      user,
      {
        objectType: 'entry',
        objectId: entryId,
        objectLabel: `${e.code} ${e.title}`,
        action: '审核通过',
        category: 'review',
        field: '状态',
        before: e.status,
        after: 'approved',
        note: selfReview ? '自审通过（提交人 = 审核人，四眼原则已于 08-05-2026 取消）' : '提交人 ≠ 审核人',
      },
      client,
    );
    return { status: 'approved' };
  });
}

/** 驳回——理由必填（AC-P-11） */
export async function rejectEntry(user: SessionUser, entryId: string, payload: unknown): Promise<{ status: string }> {
  const { reason } = rejectSchema.parse(payload);
  return withTransaction(async (client) => {
    const e = await loadForReview(client, entryId);
    if (!canTransitionEntry(e.status as never, 'rejected')) {
      throw new DomainError(`当前状态「${e.status}」不可驳回`, 409);
    }
    await client.query(
      `UPDATE entries SET status='rejected', reviewer_id=$2, reviewed_at=now(), reject_reason=$3, updated_at=now() WHERE id=$1`,
      [entryId, user.id, reason],
    );
    await writeAudit(
      user,
      {
        objectType: 'entry',
        objectId: entryId,
        objectLabel: `${e.code} ${e.title}`,
        action: '审核驳回',
        category: 'review',
        field: '状态',
        before: e.status,
        after: 'rejected',
        note: `驳回理由：${reason}`,
      },
      client,
    );
    return { status: 'rejected' };
  });
}

export async function previewGate(entryId: string): Promise<GateResult> {
  const { rows } = await query<ReviewRow>('SELECT * FROM entries WHERE id=$1', [entryId]);
  const e = rows[0];
  if (!e) throw new DomainError('条目不存在', 404);
  return runPublishGate({
    title: e.title,
    chapterId: e.chapter_id,
    visibility: e.visibility,
    labels: e.labels ?? [],
    body: e.body,
    enStatus: e.en_status,
  });
}

/**
 * 发布——同步队列的唯一写入源（RULE-02）。
 * 门禁三查全过才置「已发布」并写同步任务，同事务收口。
 * 发布同时生成条目 AI 摘要（人工校正过的不覆盖，技术方案 §6.2）。
 */
export async function publishEntry(
  user: SessionUser,
  entryId: string,
): Promise<{ status: string; gate: GateResult; taskId?: string }> {
  return withTransaction(async (client) => {
    const e = await loadForReview(client, entryId);
    if (e.status !== 'approved') {
      throw new DomainError(`只有「审核通过」的条目才能发布，当前状态「${e.status}」`, 409);
    }
    const gate = runPublishGate({
      title: e.title,
      chapterId: e.chapter_id,
      visibility: e.visibility,
      labels: e.labels ?? [],
      body: e.body,
      enStatus: e.en_status,
    });

    if (!gate.passed) {
      const reason = gate.checks.filter((c) => c.hard && !c.passed).map((c) => c.detail).join('；');
      await client.query(`UPDATE entries SET blocked_reason=$2, updated_at=now() WHERE id=$1`, [entryId, reason]);
      await writeAudit(
        client === undefined ? user : user,
        {
          objectType: 'entry',
          objectId: entryId,
          objectLabel: `${e.code} ${e.title}`,
          action: '发布门禁阻断',
          category: 'review',
          note: reason,
        },
        client,
      );
      return { status: 'blocked', gate };
    }

    const nextVersion = e.current_version + 1;
    await client.query(`UPDATE entry_versions SET status='history', effective_to=now() WHERE entry_id=$1 AND status='current'`, [entryId]);
    await client.query(
      `INSERT INTO entry_versions (id, entry_id, version_no, label, body_snapshot, plain_text, status, author_id, author_name, effective_from)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,'current',$7,$8,now())`,
      [newId('ver'), entryId, nextVersion, `v${nextVersion}`, JSON.stringify(e.body), toPlainText(e.body), user.id, user.name],
    );
    await client.query(
      `UPDATE entries SET status='published', current_version=$2, sync_status='queued', blocked_reason=NULL,
         review_due_at = now() + (review_cycle_days || ' days')::interval, updated_at=now() WHERE id=$1`,
      [entryId, nextVersion],
    );

    // AI 摘要：发布时生成（人工校正过的不覆盖）。LLM 失败不阻塞发布——只留痕，摘要保持原样。
    if (e.summary_source !== 'human') {
      try {
        const text = await getLlm().summarizeEntry(e.title, toPlainText(e.body));
        await client.query(
          `UPDATE entries SET ai_summary=$2, summary_source='ai', summary_at=now() WHERE id=$1`,
          [entryId, text],
        );
      } catch (err) {
        await writeAudit(
          user,
          {
            objectType: 'entry',
            objectId: entryId,
            objectLabel: `${e.code} ${e.title}`,
            action: 'AI 摘要生成失败',
            category: 'content',
            note: `${(err as Error).message}——保留上一次摘要，不阻塞发布`,
          },
          client,
        );
      }
    }

    const target = e.visibility === 'internal' ? '内部知识 · 仅客服 segment' : '帮助中心 · 对外文章';
    const taskId = newId('sync');
    await client.query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ($1,$2,$3,$4,$5,'queued',$6)`,
      [taskId, entryId, nextVersion, nextVersion === 1 ? '创建文章' : '更新正文 + labels', target, e.en_status === 'confirmed' || e.en_status === 'synced' ? '中 / 英' : '中'],
    );

    await writeAudit(
      user,
      {
        objectType: 'entry',
        objectId: entryId,
        objectLabel: `${e.code} ${e.title}`,
        action: '发布并同步',
        category: 'review',
        field: '版本',
        before: `v${e.current_version}`,
        after: `v${nextVersion}`,
        note: '门禁四查全过，已写入同步队列（唯一写入源）',
      },
      client,
    );
    return { status: 'published', gate, taskId };
  });
}

/** 回滚（仅审核员）——以旧版内容建新修订并直接生效，历史与指标永不删除（AC-P-06） */
export async function rollbackEntry(
  user: SessionUser,
  entryId: string,
  targetVersionNo: number,
): Promise<{ status: string; newVersion: number }> {
  return withTransaction(async (client) => {
    const e = await loadForReview(client, entryId);
    const { rows: vs } = await client.query<{ id: string; version_no: number; body_snapshot: EntryBody; label: string }>(
      'SELECT id, version_no, body_snapshot, label FROM entry_versions WHERE entry_id=$1 AND version_no=$2',
      [entryId, targetVersionNo],
    );
    const target = vs[0];
    if (!target) throw new DomainError('目标版本不存在', 404);

    await client.query(`UPDATE entry_versions SET status='rolled_back', effective_to=now() WHERE entry_id=$1 AND status='current'`, [entryId]);
    const newNo = e.current_version + 1;
    await client.query(
      `INSERT INTO entry_versions (id, entry_id, version_no, label, body_snapshot, plain_text, status, author_id, author_name, effective_from)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,'current',$7,$8,now())`,
      [
        newId('ver'),
        entryId,
        newNo,
        `v${newNo}（回滚自 v${targetVersionNo}）`,
        JSON.stringify(target.body_snapshot),
        toPlainText(target.body_snapshot),
        user.id,
        user.name,
      ],
    );
    await client.query(
      `UPDATE entries SET body=$2::jsonb, current_version=$3, status='published', sync_status='queued', updated_at=now() WHERE id=$1`,
      [entryId, JSON.stringify(target.body_snapshot), newNo],
    );
    const taskId = newId('sync');
    await client.query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ($1,$2,$3,'回滚后更新正文',$4,'queued','中')`,
      [taskId, entryId, newNo, e.visibility === 'internal' ? '内部知识 · 仅客服 segment' : '帮助中心 · 对外文章'],
    );
    await writeAudit(
      user,
      {
        objectType: 'entry',
        objectId: entryId,
        objectLabel: `${e.code} ${e.title}`,
        action: '版本回滚',
        category: 'review',
        field: '生效版本',
        before: `v${e.current_version}`,
        after: `v${targetVersionNo}（以 v${newNo} 重新生效）`,
        note: '历史版本与指标保留，已自动写入同步队列',
      },
      client,
    );
    return { status: 'rolled_back', newVersion: newNo };
  });
}
