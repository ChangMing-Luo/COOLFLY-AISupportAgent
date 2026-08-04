import type { PoolClient } from 'pg';
import {
  canTransitionEntry,
  entryUpsertSchema,
  type EntryBody,
  type EntryStatus,
  type EntryRow,
  type SessionUser,
  TUNABLES,
  zhCN,
} from '@kb/contracts';
import { query, withTransaction, newId } from '../db/pool.js';
import { writeAudit, fieldDiff } from '../core/audit.js';
import { toPlainText } from '../core/content.js';
import { embed, toPgVector } from '../integrations/embedding.js';

export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface EntryDbRow {
  id: string;
  code: string;
  title: string;
  library_id: string;
  chapter_id: string;
  entry_type: string;
  visibility: string;
  scene_l1: string;
  scene_l2: string;
  labels: string[];
  device_models: string[];
  body: EntryBody;
  status: EntryStatus;
  en_status: string;
  sync_status: string;
  vector_status: string;
  review_source: string;
  submitter_id: string | null;
  reviewer_id: string | null;
  reject_reason: string | null;
  owner_id: string | null;
  review_cycle_days: number;
  review_due_at: Date | null;
  current_version: number;
  lock_version: number;
  blocked_reason: string | null;
  updated_at: Date;
  chapter_name?: string;
  library_name?: string;
  parent_name?: string | null;
  solve_rate?: string | null;
  bot_refs?: number | null;
}

const ENTRY_SELECT = `
  SELECT e.*, c.name AS chapter_name, pc.name AS parent_name, l.name AS library_name,
         m.solve_rate, m.bot_refs
  FROM entries e
  JOIN chapters c ON c.id = e.chapter_id
  LEFT JOIN chapters pc ON pc.id = c.parent_id
  JOIN libraries l ON l.id = e.library_id
  LEFT JOIN entry_effect_metrics m ON m.entry_id = e.id
`;

function dueLevel(due: Date | null): 'ok' | 'warn' | 'bad' {
  if (!due) return 'ok';
  const days = Math.floor((due.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'bad';
  if (days <= TUNABLES.reviewDueSoonDays) return 'warn';
  return 'ok';
}

export function toEntryRow(r: EntryDbRow): EntryRow {
  const solve = r.solve_rate === null || r.solve_rate === undefined ? null : Number(r.solve_rate);
  const refs = r.bot_refs ?? 0;
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    path: `${r.library_name} / ${r.parent_name ? `${r.parent_name} / ` : ''}${r.chapter_name}`,
    entryType: r.entry_type,
    visibility: r.visibility as EntryRow['visibility'],
    versionLabel: r.current_version > 0 ? `v${r.current_version}` : '—',
    status: r.status,
    enStatus: r.en_status as EntryRow['enStatus'],
    syncStatus: r.sync_status as EntryRow['syncStatus'],
    vectorStatus: r.vector_status as EntryRow['vectorStatus'],
    solveRate: refs < TUNABLES.sampleFloor ? null : solve,
    sampleShort: refs < TUNABLES.sampleFloor,
    reviewDueAt: r.review_due_at ? r.review_due_at.toISOString() : null,
    reviewDueLevel: dueLevel(r.review_due_at),
    updatedAt: r.updated_at.toISOString(),
    libraryId: r.library_id,
    chapterId: r.chapter_id,
    sceneL1: r.scene_l1,
    sceneL2: r.scene_l2,
    labels: r.labels ?? [],
    lockVersion: r.lock_version,
  };
}

export async function listEntries(filter: {
  libraryId?: string;
  status?: string;
  visibility?: string;
  due?: 'all' | 'overdue' | 'soon';
  q?: string;
}): Promise<EntryRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.libraryId) {
    params.push(filter.libraryId);
    where.push(`e.library_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`e.status = $${params.length}`);
  }
  if (filter.visibility) {
    params.push(filter.visibility);
    where.push(`e.visibility = $${params.length}`);
  }
  if (filter.due === 'overdue') where.push(`e.review_due_at IS NOT NULL AND e.review_due_at < now()`);
  if (filter.due === 'soon')
    where.push(
      `e.review_due_at IS NOT NULL AND e.review_due_at >= now() AND e.review_due_at < now() + interval '${TUNABLES.reviewDueSoonDays} days'`,
    );
  if (filter.q) {
    params.push(`%${filter.q}%`);
    where.push(`(e.title ILIKE $${params.length} OR e.code ILIKE $${params.length} OR e.labels::text ILIKE $${params.length})`);
  }
  const sql = `${ENTRY_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.updated_at DESC`;
  const { rows } = await query<EntryDbRow>(sql, params);
  return rows.map(toEntryRow);
}

export async function getEntry(id: string): Promise<(EntryRow & { body: EntryBody; deviceModels: string[]; ownerId: string | null; rejectReason: string | null; blockedReason: string | null; submitterId: string | null; reviewSource: string }) | null> {
  const { rows } = await query<EntryDbRow>(`${ENTRY_SELECT} WHERE e.id = $1 OR e.code = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    ...toEntryRow(r),
    body: r.body,
    // 适用型号与负责人不在列表行里，但条目工作台保存时需原样回传，否则每次保存都会被清空
    deviceModels: r.device_models ?? [],
    ownerId: r.owner_id,
    rejectReason: r.reject_reason,
    blockedReason: r.blocked_reason,
    submitterId: r.submitter_id,
    reviewSource: r.review_source,
  };
}

async function nextCode(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INT))::text AS max FROM entries WHERE code ~ '^KB-[0-9]+$'`,
  );
  const next = Number(rows[0]?.max ?? '200') + 1;
  return `KB-${String(next).padStart(4, '0')}`;
}

/** 新建/保存草稿：中文保存联动——英文置 stale + 同步阻断，向量置 stale（AC-P-04） */
export async function saveEntry(
  user: SessionUser,
  entryId: string | null,
  payload: unknown,
): Promise<EntryRow> {
  const input = entryUpsertSchema.parse(payload);
  return withTransaction(async (client) => {
    let id = entryId;
    let before: EntryDbRow | null = null;

    if (id) {
      const { rows } = await client.query<EntryDbRow>('SELECT * FROM entries WHERE id = $1 FOR UPDATE', [id]);
      before = rows[0] ?? null;
      if (!before) throw new DomainError('条目不存在', 404);
      if (input.expectedVersion !== undefined && input.expectedVersion !== before.lock_version) {
        throw new DomainError(
          '该条目已被他人更新（并发编辑冲突）——请基于最新版本重做，你的改动未覆盖线上内容',
          409,
          { currentLockVersion: before.lock_version },
        );
      }
      const nextStatus: EntryStatus =
        before.status === 'published' || before.status === 'approved' ? 'editing' : before.status === 'rejected' ? 'rejected' : before.status;
      if (!canTransitionEntry(before.status, nextStatus === before.status ? before.status : nextStatus)) {
        throw new DomainError(`非法状态流转：${before.status} → ${nextStatus}`, 409);
      }
      await client.query(
        `UPDATE entries SET title=$2, library_id=$3, chapter_id=$4, entry_type=$5, visibility=$6,
           scene_l1=$7, scene_l2=$8, labels=$9::jsonb, device_models=$10::jsonb, body=$11::jsonb,
           status=$12, en_status = CASE WHEN en_status IN ('none','translating') THEN en_status ELSE 'stale' END,
           sync_status = CASE WHEN sync_status IN ('synced','failed','queued','running') THEN 'blocked' ELSE sync_status END,
           blocked_reason = CASE WHEN sync_status IN ('synced','failed','queued','running') THEN $13 ELSE blocked_reason END,
           vector_status='stale', review_cycle_days=$14, owner_id=$15,
           lock_version = lock_version + 1, updated_at = now()
         WHERE id=$1`,
        [
          id,
          input.title,
          input.libraryId,
          input.chapterId,
          input.entryType,
          input.visibility,
          input.sceneL1,
          input.sceneL2,
          JSON.stringify(input.labels),
          JSON.stringify(input.deviceModels),
          JSON.stringify(input.body),
          nextStatus,
          zhCN.translation.staleHint,
          input.reviewCycleDays,
          input.ownerId,
        ],
      );
    } else {
      id = newId('ent');
      const code = await nextCode(client);
      await client.query(
        `INSERT INTO entries (id, code, title, library_id, chapter_id, entry_type, visibility, scene_l1, scene_l2,
           labels, device_models, body, status, review_source, owner_id, review_cycle_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,'draft','manual',$13,$14)`,
        [
          id,
          code,
          input.title,
          input.libraryId,
          input.chapterId,
          input.entryType,
          input.visibility,
          input.sceneL1,
          input.sceneL2,
          JSON.stringify(input.labels),
          JSON.stringify(input.deviceModels),
          JSON.stringify(input.body),
          input.ownerId,
          input.reviewCycleDays,
        ],
      );
    }

    const { rows: after } = await client.query<EntryDbRow>(`${ENTRY_SELECT} WHERE e.id = $1`, [id]);
    const row = after[0]!;

    if (before) {
      const diffs = fieldDiff(
        { 标题: before.title, 可见性: before.visibility, 正文: toPlainText(before.body), 标签: before.labels },
        { 标题: input.title, 可见性: input.visibility, 正文: toPlainText(input.body), 标签: input.labels },
        ['标题', '可见性', '正文', '标签'],
      );
      for (const d of diffs) {
        await writeAudit(
          user,
          {
            objectType: 'entry',
            objectId: id,
            objectLabel: `${row.code} ${row.title}`,
            action: '保存中文草稿',
            category: 'content',
            field: d.field,
            before: d.before.slice(0, 400),
            after: d.after.slice(0, 400),
            note: '中文变更联动：英文置待重新校验、同步阻断、向量置待重建',
          },
          client,
        );
      }
      if (diffs.length === 0) {
        await writeAudit(
          user,
          { objectType: 'entry', objectId: id, objectLabel: `${row.code} ${row.title}`, action: '保存中文草稿', category: 'content', note: '无字段变更' },
          client,
        );
      }
    } else {
      await writeAudit(
        user,
        { objectType: 'entry', objectId: id, objectLabel: `${row.code} ${row.title}`, action: '创建条目', category: 'content', field: '条目', before: '—', after: row.title },
        client,
      );
    }

    return toEntryRow(row);
  });
}

/** 提交审核：统一过审入口（人工/导入/挖掘/修订/反馈共用） */
export async function submitForReview(
  user: SessionUser,
  entryId: string,
  source: string,
  note?: string,
): Promise<EntryRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<EntryDbRow>('SELECT * FROM entries WHERE id=$1 FOR UPDATE', [entryId]);
    const e = rows[0];
    if (!e) throw new DomainError('条目不存在', 404);
    if (!canTransitionEntry(e.status, 'pending_review')) {
      throw new DomainError(`当前状态「${e.status}」不可提交审核`, 409);
    }
    await client.query(
      `UPDATE entries SET status='pending_review', review_source=$2, submitter_id=$3, submitted_at=now(),
         reject_reason=NULL, updated_at=now() WHERE id=$1`,
      [entryId, source, user.id],
    );
    const { rows: after } = await client.query<EntryDbRow>(`${ENTRY_SELECT} WHERE e.id=$1`, [entryId]);
    await writeAudit(
      user,
      {
        objectType: 'entry',
        objectId: entryId,
        objectLabel: `${e.code} ${e.title}`,
        action: '提交审核',
        category: 'review',
        field: '状态',
        before: e.status,
        after: 'pending_review',
        note: note ?? `来源：${source}`,
      },
      client,
    );
    return toEntryRow(after[0]!);
  });
}

/** 向量重建（内部工具：查重 / 缺口聚类 / 代理评测） */
export async function rebuildVector(user: SessionUser, entryId: string): Promise<{ status: string }> {
  const { rows } = await query<EntryDbRow>('SELECT * FROM entries WHERE id=$1', [entryId]);
  const e = rows[0];
  if (!e) throw new DomainError('条目不存在', 404);
  const text = `${e.title}\n${toPlainText(e.body)}\n${(e.labels ?? []).join(' ')}`;
  const vec = embed(text);
  await query(
    `INSERT INTO entry_vectors (entry_id, embedding, source_text, built_at)
     VALUES ($1, $2::vector, $3, now())
     ON CONFLICT (entry_id) DO UPDATE SET embedding=EXCLUDED.embedding, source_text=EXCLUDED.source_text, built_at=now()`,
    [entryId, toPgVector(vec), text],
  );
  await query(`UPDATE entries SET vector_status='ready', updated_at=now() WHERE id=$1`, [entryId]);
  await writeAudit(user, {
    objectType: 'entry',
    objectId: entryId,
    objectLabel: `${e.code} ${e.title}`,
    action: '重建向量',
    category: 'content',
    field: '向量状态',
    before: e.vector_status,
    after: 'ready',
  });
  return { status: 'ready' };
}

/** 代理评测：以标题为问法对本台索引做召回验证（结果固定标注代理性质） */
export async function proxyRecall(entryId: string): Promise<number | null> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM entry_vectors v
     JOIN entries e ON e.id = v.entry_id
     WHERE v.entry_id = $1`,
    [entryId],
  );
  const has = Number(rows[0]?.count ?? '0') > 0;
  return has ? 1 : null;
}
