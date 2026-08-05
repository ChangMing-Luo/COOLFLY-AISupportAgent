import {
  ENTRY_STATUS_META,
  SYNC_STATUS_META,
  bumpVersion,
  canTransition,
  type EntryStatus,
  type SyncStatus,
  type SessionUser,
} from '@kb/contracts';
import { query, newId, withTransaction } from '../db/pool.js';
import { writeAudit, type AuditActor } from '../core/audit.js';
import { toHtml, toParagraphs, toPlainText } from '../core/content.js';
import { fmtShort, fmtFull, thousands } from '../core/fmt.js';

export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function actorOf(user: SessionUser): AuditActor {
  return { id: user.id, name: user.name, roleLabel: user.roleLabel };
}

export interface EntryRow {
  id: string;
  code: string;
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
  category_id: string | null;
  scene_id: string | null;
  category_zh: string | null;
  category_en: string | null;
  scene_zh: string | null;
  scene_en: string | null;
  status: EntryStatus;
  version: string;
  sync_status: SyncStatus;
  sync_fail_reason: string | null;
  translated: boolean;
  en_edited: boolean;
  owner_name: string;
  owner_id: string | null;
  note: string;
  reject_reason: string | null;
  pending_kind: string | null;
  pending_version: string | null;
  source: string;
  confidence: string;
  quality: number;
  updated_at: Date;
  created_at: Date;
  published_at: Date | null;
  submitted_at: Date | null;
  hits: number;
  views: number;
  adopt_rate: number;
  tags: string[];
}

const SELECT_ENTRY = `
  SELECT e.*,
         c.name_zh AS category_zh, c.name_en AS category_en,
         s.name_zh AS scene_zh,    s.name_en AS scene_en,
         COALESCE(m.hits, 0) AS hits, COALESCE(m.views, 0) AS views, COALESCE(m.adopt_rate, 0) AS adopt_rate,
         COALESCE(ARRAY(SELECT t.name FROM entry_tags et JOIN tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id ORDER BY t.created_at), '{}') AS tags
  FROM entries e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN scenes s     ON s.id = e.scene_id
  LEFT JOIN entry_metrics m ON m.entry_id = e.id`;

export async function findEntry(code: string): Promise<EntryRow> {
  const { rows } = await query<EntryRow>(`${SELECT_ENTRY} WHERE e.code = $1`, [code]);
  const row = rows[0];
  if (!row) throw new DomainError(`条目不存在：${code}`, 404);
  return row;
}

export async function listEntries(where: string, params: unknown[] = []): Promise<EntryRow[]> {
  const { rows } = await query<EntryRow>(`${SELECT_ENTRY} ${where}`, params);
  return rows;
}

/* ══════════ 视图模型 ══════════ */

export interface EntryDto {
  code: string;
  titleZh: string;
  titleEn: string;
  categoryZh: string;
  categoryEn: string;
  sceneZh: string;
  sceneEn: string;
  status: EntryStatus;
  statusLabel: string;
  statusReadable: string;
  statusTagClass: string;
  version: string;
  syncStatus: SyncStatus;
  syncLabel: string;
  syncTagClass: string;
  ownerName: string;
  updatedAt: string;
  updatedAtFull: string;
  quality: number;
  confidence: number;
  confidencePct: string;
  adopt: number;
  hits: number;
  views: number;
  translated: boolean;
  enEdited: boolean;
  tags: string[];
  source: string;
  note: string;
  rejectReason: string | null;
  pendingKind: string | null;
  pendingVersion: string | null;
  syncFailReason: string | null;
}

export function toDto(r: EntryRow): EntryDto {
  const meta = ENTRY_STATUS_META[r.status];
  const sync = SYNC_STATUS_META[r.sync_status];
  const conf = Number(r.confidence ?? 0);
  return {
    code: r.code,
    titleZh: r.title_zh,
    titleEn: r.title_en,
    categoryZh: r.category_zh ?? '',
    categoryEn: r.category_en ?? '—',
    sceneZh: r.scene_zh ?? '',
    sceneEn: r.scene_en ?? '—',
    status: r.status,
    statusLabel: meta.label,
    statusReadable: meta.readable,
    statusTagClass: meta.tagClass,
    version: r.version,
    syncStatus: r.sync_status,
    syncLabel: sync.label,
    syncTagClass: sync.tagClass,
    ownerName: r.owner_name,
    updatedAt: fmtShort(r.updated_at),
    updatedAtFull: fmtFull(r.updated_at),
    quality: r.quality,
    confidence: conf,
    confidencePct: `${Math.round(conf * 100)}%`,
    adopt: Number(r.adopt_rate ?? 0),
    hits: Number(r.hits ?? 0),
    views: Number(r.views ?? 0),
    translated: r.translated,
    enEdited: r.en_edited,
    tags: r.tags ?? [],
    source: r.source,
    note: r.note,
    rejectReason: r.reject_reason,
    pendingKind: r.pending_kind,
    pendingVersion: r.pending_version,
    syncFailReason: r.sync_fail_reason,
  };
}

/* ══════════ 编号 ══════════ */

export async function nextEntryCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'KB-([0-9]+)') AS INT))::text AS max FROM entries WHERE code ~ '^KB-[0-9]+$'`,
  );
  const next = Number(rows[0]?.max ?? 20000) + 1;
  return `KB-${next}`;
}

/* ══════════ 标签 ══════════ */

export async function syncTags(entryId: string, tagNames: string[], actorName: string): Promise<void> {
  await query('DELETE FROM entry_tags WHERE entry_id = $1', [entryId]);
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const { rows } = await query<{ id: string }>('SELECT id FROM tags WHERE name = $1', [name]);
    let tagId = rows[0]?.id;
    if (!tagId) {
      tagId = newId('tag');
      const { rows: seq } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM tags');
      await query('INSERT INTO tags (id, code, name, type, created_by) VALUES ($1,$2,$3,$4,$5)', [
        tagId,
        `TAG-${301 + Number(seq[0].n)}`,
        name,
        '业务',
        actorName,
      ]);
    }
    await query('INSERT INTO entry_tags (entry_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [
      entryId,
      tagId,
    ]);
  }
}

/* ══════════ 创建 / 保存 ══════════ */

export interface CreateArgs {
  titleZh: string;
  bodyZh?: string;
  categoryId?: string | null;
  sceneId?: string | null;
  tags?: string[];
  source?: string;
  confidence?: number;
  quality?: number;
}

export async function createEntry(user: SessionUser, args: CreateArgs): Promise<EntryRow> {
  const code = await nextEntryCode();
  const id = newId('ent');
  await query(
    `INSERT INTO entries (id, code, title_zh, body_zh, category_id, scene_id, status, version,
                          owner_id, owner_name, source, confidence, quality)
     VALUES ($1,$2,$3,$4,$5,$6,'draft','v0.1',$7,$8,$9,$10,$11)`,
    [
      id,
      code,
      args.titleZh,
      toHtml(args.bodyZh ?? ''),
      args.categoryId ?? null,
      args.sceneId ?? null,
      user.id,
      user.name,
      args.source ?? '人工撰写',
      args.confidence ?? 0,
      args.quality ?? 20,
    ],
  );
  await query('INSERT INTO entry_metrics (entry_id) VALUES ($1)', [id]);
  await syncTags(id, args.tags ?? [], user.name);
  await query(
    `INSERT INTO entry_versions (id, entry_id, version, act, note, author_id, author_name)
     VALUES ($1,$2,'v0.1','创建','新建条目',$3,$4)`,
    [newId('ver'), id, user.id, user.name],
  );
  return findEntry(code);
}

export interface SaveArgs {
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  categoryId: string | null;
  sceneId: string | null;
  tags: string[];
  note: string;
  enEdited?: boolean;
}

export async function saveEntry(user: SessionUser, code: string, args: SaveArgs): Promise<EntryRow> {
  const before = await findEntry(code);
  if (before.status === 'pending') {
    throw new DomainError('待审核的条目不可编辑，请先撤回或等待审核结论。', 409);
  }
  // 已发布 / 已下线的条目直接保存会改动线上内容 —— 必须先走「创建修订」
  if (before.status === 'published' || before.status === 'offline') {
    throw new DomainError('已发布或已下线的知识不能直接保存，请先「创建修订」生成新版本草稿。', 409);
  }
  const enEdited =
    args.enEdited ?? (before.translated && toPlainText(args.bodyEn) !== toPlainText(before.body_en));
  await query(
    `UPDATE entries SET title_zh=$2, title_en=$3, body_zh=$4, body_en=$5, category_id=$6, scene_id=$7,
            note=$8, en_edited=$9, owner_id=$10, owner_name=$11, updated_at=now()
     WHERE code=$1`,
    [
      code,
      args.titleZh,
      args.titleEn,
      toHtml(args.bodyZh),
      toHtml(args.bodyEn),
      args.categoryId,
      args.sceneId,
      args.note,
      enEdited,
      user.id,
      user.name,
    ],
  );
  await syncTags(before.id, args.tags, user.name);
  await writeAudit(actorOf(user), {
    action: '保存草稿',
    objectCode: code,
    objectLabel: `${code} ${args.titleZh}`,
    version: before.version,
  });
  return findEntry(code);
}

/* ══════════ 提交审核 ══════════ */

export interface SubmitCheck {
  ok: boolean;
  errors: string[];
}

export function validateForSubmit(r: EntryRow): SubmitCheck {
  const errors: string[] = [];
  if (!r.scene_id) errors.push('未选择问题场景（必填）');
  if (!r.title_zh || r.title_zh === '未命名知识') errors.push('中文标题为空或仍为默认值');
  if (!r.translated || !r.body_en.trim() || !r.title_en.trim()) {
    errors.push('尚未翻译为英文（Zendesk 同步需要英文版本）');
  }
  return { ok: errors.length === 0, errors };
}

export async function submitEntry(user: SessionUser, code: string): Promise<{ entry: EntryRow; errors: string[] }> {
  const r = await findEntry(code);
  const check = validateForSubmit(r);
  if (!check.ok) return { entry: r, errors: check.errors };
  if (!canTransition(r.status, 'pending')) {
    throw new DomainError(`当前状态「${ENTRY_STATUS_META[r.status].label}」不可提交审核。`, 409);
  }
  await query(
    `UPDATE entries SET status='pending', pending_kind=NULL, pending_version=NULL,
            submitter_id=$2, submitted_at=now(), owner_id=$2, owner_name=$3, updated_at=now()
     WHERE code=$1`,
    [code, user.id, user.name],
  );
  await writeAudit(actorOf(user), {
    action: '提交审核',
    objectCode: code,
    objectLabel: `${code} ${r.title_zh}`,
    version: r.version,
  });
  return { entry: await findEntry(code), errors: [] };
}

/* ══════════ 修订 / 反馈转修复 / 恢复 ══════════ */

export async function startRevision(user: SessionUser, code: string, note = ''): Promise<EntryRow> {
  const r = await findEntry(code);
  if (r.status === 'pending') throw new DomainError('待审核的条目不能创建修订。', 409);
  const next = bumpVersion(r.version, false);
  await query(
    `UPDATE entries SET status='draft', version=$2, note=$3, owner_id=$4, owner_name=$5, updated_at=now()
     WHERE code=$1`,
    [code, next, note, user.id, user.name],
  );
  await writeAudit(actorOf(user), {
    action: '创建修订版本',
    objectCode: code,
    objectLabel: `${code} ${next}`,
    version: next,
  });
  return findEntry(code);
}

export async function restoreEntry(user: SessionUser, code: string): Promise<EntryRow> {
  const r = await findEntry(code);
  if (r.status !== 'offline') throw new DomainError('只有已下线的知识可以恢复。', 409);
  await query(`UPDATE entries SET status='draft', owner_id=$2, owner_name=$3, updated_at=now() WHERE code=$1`, [
    code,
    user.id,
    user.name,
  ]);
  await writeAudit(actorOf(user), {
    action: '恢复下线知识',
    objectCode: code,
    objectLabel: `${code} ${r.title_zh}`,
    version: r.version,
  });
  return findEntry(code);
}

/* ══════════ 回滚提交 ══════════ */

export async function submitRollback(user: SessionUser, code: string, version: string): Promise<EntryRow> {
  const r = await findEntry(code);
  if (r.status !== 'published') throw new DomainError('只有已发布的知识可以回滚。', 409);
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM entry_versions WHERE entry_id=$1 AND version=$2 LIMIT 1',
    [r.id, version],
  );
  if (!rows[0]) throw new DomainError(`版本不存在：${version}`, 404);
  await query(
    `UPDATE entries SET status='pending', pending_kind='rollback', pending_version=$2,
            submitter_id=$3, submitted_at=now(), owner_id=$3, owner_name=$4, updated_at=now()
     WHERE code=$1`,
    [code, version, user.id, user.name],
  );
  await writeAudit(actorOf(user), {
    action: '提交回滚审核',
    objectCode: code,
    objectLabel: `${code} → ${version}`,
    version,
  });
  return findEntry(code);
}

/* ══════════ 版本 ══════════ */

export interface VersionDto {
  version: string;
  note: string;
  by: string;
  at: string;
  act: string;
  isCurrent: boolean;
  adopt: number;
  hits: number;
  adoptN: string;
}

export async function listVersions(entry: EntryRow): Promise<VersionDto[]> {
  const { rows } = await query<{
    version: string;
    note: string;
    author_name: string;
    created_at: Date;
    act: string;
    adopt_rate: number;
    hits: number;
  }>(
    `SELECT version, note, author_name, created_at, act, adopt_rate, hits
     FROM entry_versions WHERE entry_id=$1 ORDER BY created_at DESC`,
    [entry.id],
  );
  let currentSeen = false;
  return rows.map((v) => {
    const isCurrent = !currentSeen && v.version === entry.version;
    if (isCurrent) currentSeen = true;
    return {
      version: v.version,
      note: v.note,
      by: v.author_name,
      at: fmtFull(v.created_at),
      act: v.act,
      isCurrent,
      adopt: Number(v.adopt_rate ?? 0),
      hits: Number(v.hits ?? 0),
      adoptN: thousands(Math.round((Number(v.hits ?? 0) * Number(v.adopt_rate ?? 0)) / 100)),
    };
  });
}

export async function addVersion(
  entryId: string,
  version: string,
  act: '发布' | '回滚' | '创建',
  note: string,
  user: SessionUser,
  snapshot: { titleZh: string; titleEn: string; bodyZh: string; bodyEn: string },
  metrics: { adopt: number; hits: number } = { adopt: 0, hits: 0 },
): Promise<void> {
  await query(
    `INSERT INTO entry_versions (id, entry_id, version, act, note, author_id, author_name,
                                 title_zh, title_en, body_zh, body_en, adopt_rate, hits)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      newId('ver'),
      entryId,
      version,
      act,
      note,
      user.id,
      user.name,
      snapshot.titleZh,
      snapshot.titleEn,
      snapshot.bodyZh,
      snapshot.bodyEn,
      metrics.adopt,
      metrics.hits,
    ],
  );
}

/** 质量告警：历史最佳版本采纳率比当前高 ≥ pp 时建议回滚 */
export function qualityAdvice(
  entry: EntryRow,
  versions: VersionDto[],
  pp: number,
): { warn: boolean; target: string; text: string } {
  if (entry.status !== 'published') return { warn: false, target: '', text: '' };
  const prior = versions.filter((v) => !v.isCurrent);
  if (!prior.length) return { warn: false, target: '', text: '' };
  const best = prior.reduce((a, v) => (v.adopt > (a?.adopt ?? -1) ? v : a), prior[0]);
  const current = Number(entry.adopt_rate ?? 0);
  if (best.adopt - current < pp) return { warn: false, target: '', text: '' };
  return {
    warn: true,
    target: best.version,
    text: `当前版本 ${entry.version} 采纳率仅 ${current}%，较历史最佳版本 ${best.version}（${best.adopt}%）下降 ${best.adopt - current} 个百分点，命中虽高但采纳明显走低。建议回滚至 ${best.version}，或基于其重做修订。`,
  };
}

export { toParagraphs, withTransaction };
