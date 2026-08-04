import {
  canTransitionEntry,
  rejectSchema,
  zhCN,
  type GateResult,
  type SessionUser,
  type EntryBody,
  type Visibility,
  type EnStatus,
  type VectorStatus,
} from '@kb/contracts';
import { withTransaction, query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { runPublishGate } from '../core/gate.js';
import { toPlainText } from '../core/content.js';
import { DomainError, proxyRecall } from './entries.js';

interface ReviewRow {
  id: string;
  code: string;
  title: string;
  status: string;
  visibility: Visibility;
  labels: string[];
  chapter_id: string;
  en_status: EnStatus;
  vector_status: VectorStatus;
  body: EntryBody;
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
    changeSummary: Array<{ field: string; before: string; after: string }>;
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
    changeSummary: buildChangeSummary(r.prev_body, r.body),
  }));
}

function buildChangeSummary(
  prev: EntryBody | null,
  next: EntryBody,
): Array<{ field: string; before: string; after: string }> {
  if (!prev) return [{ field: '新建条目', before: '—', after: `${next.paragraphs.length} 个段落` }];
  const before = toPlainText(prev).split('\n');
  const after = toPlainText(next).split('\n');
  const out: Array<{ field: string; before: string; after: string }> = [];
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i += 1) {
    const b = before[i] ?? '（无）';
    const a = after[i] ?? '（已删除）';
    if (b !== a) out.push({ field: `第 ${i + 1} 段`, before: b, after: a });
  }
  return out.slice(0, 8);
}

async function loadForReview(client: import('pg').PoolClient, entryId: string): Promise<ReviewRow> {
  const { rows } = await client.query<ReviewRow>('SELECT * FROM entries WHERE id=$1 FOR UPDATE', [entryId]);
  const e = rows[0];
  if (!e) throw new DomainError('条目不存在', 404);
  return e;
}

/** 审核通过——四眼原则：提交人 = 当前审核员则拒绝（RULE-02 / AC-P-23） */
export async function approveEntry(user: SessionUser, entryId: string): Promise<{ status: string }> {
  return withTransaction(async (client) => {
    const e = await loadForReview(client, entryId);
    if (e.submitter_id && e.submitter_id === user.id) {
      throw new DomainError(zhCN.ironLaw.fourEyes, 403, { rule: 'four_eyes' });
    }
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
        note: '四眼原则校验通过（提交人 ≠ 审核人）',
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
    vectorStatus: e.vector_status,
    proxyRecall: await proxyRecall(entryId),
  });
}

/**
 * 发布——同步队列的唯一写入源（RULE-02）。
 * 门禁四查全过才置「已发布」并写同步任务，同事务收口。
 */
export async function publishEntry(
  user: SessionUser,
  entryId: string,
): Promise<{ status: string; gate: GateResult; taskId?: string }> {
  const recall = await proxyRecall(entryId);
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
      vectorStatus: e.vector_status,
      proxyRecall: recall,
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
