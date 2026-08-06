import type { SessionUser, TagType } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { getLlm } from '../integrations/llm.js';
import { DomainError, actorOf } from './entries.js';
import { assertCategoryPublished } from './gates.js';
import { openRequestFor, submitRequest, unpublishImpact } from './reviews.js';

/* ══════════ 读 ══════════ */

export interface CategoryDto {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  active: boolean;
  /** draft / pending / published / offline —— 与知识条目一样走审核 */
  status: string;
  statusLabel: string;
  /** 有待审请求时置为该请求编号，界面显示「审核中」并禁止重复提交 */
  pendingReview: string | null;
  sceneCount: number;
  entryCount: number;
  zendeskRef: string | null;
}

export const META_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '审核中',
  published: '已上架',
  offline: '已下架',
};

/** 待审请求索引：一次查完，避免列表里 N+1 */
async function pendingIndex(objectType: 'category' | 'scene'): Promise<Map<string, string>> {
  const { rows } = await query<{ object_id: string; code: string }>(
    `SELECT object_id, code FROM review_requests WHERE object_type=$1 AND status='pending'`,
    [objectType],
  );
  return new Map(rows.map((r) => [r.object_id, r.code]));
}

export async function listCategories(): Promise<CategoryDto[]> {
  const { rows } = await query<{
    id: string;
    code: string;
    name_zh: string;
    name_en: string;
    active: boolean;
    status: string;
    zendesk_category_ref: string | null;
    scene_count: string;
    entry_count: string;
  }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM scenes s WHERE s.category_id=c.id)::text AS scene_count,
            (SELECT COUNT(*) FROM entries e WHERE e.category_id=c.id)::text AS entry_count
     FROM categories c ORDER BY c.sort_order, c.created_at`,
  );
  const pending = await pendingIndex('category');
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    active: r.active,
    status: r.status,
    statusLabel: META_STATUS_LABEL[r.status] ?? r.status,
    pendingReview: pending.get(r.id) ?? null,
    sceneCount: Number(r.scene_count),
    entryCount: Number(r.entry_count),
    zendeskRef: r.zendesk_category_ref,
  }));
}

export interface SceneDto {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  active: boolean;
  status: string;
  statusLabel: string;
  pendingReview: string | null;
  categoryId: string;
  categoryZh: string;
  entryCount: number;
  zendeskRef: string | null;
}

export async function listScenes(): Promise<SceneDto[]> {
  const { rows } = await query<{
    id: string;
    code: string;
    name_zh: string;
    name_en: string;
    active: boolean;
    status: string;
    category_id: string;
    category_zh: string;
    zendesk_section_ref: string | null;
    entry_count: string;
  }>(
    `SELECT s.*, c.name_zh AS category_zh,
            (SELECT COUNT(*) FROM entries e WHERE e.scene_id=s.id)::text AS entry_count
     FROM scenes s JOIN categories c ON c.id=s.category_id
     ORDER BY c.sort_order, s.sort_order, s.created_at`,
  );
  const pending = await pendingIndex('scene');
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    active: r.active,
    status: r.status,
    statusLabel: META_STATUS_LABEL[r.status] ?? r.status,
    pendingReview: pending.get(r.id) ?? null,
    categoryId: r.category_id,
    categoryZh: r.category_zh,
    entryCount: Number(r.entry_count),
    zendeskRef: r.zendesk_section_ref,
  }));
}

export interface TagDto {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
  refCount: number;
  createdBy: string;
}

export async function listTags(): Promise<TagDto[]> {
  const { rows } = await query<{
    id: string;
    code: string;
    name: string;
    type: string;
    active: boolean;
    created_by: string;
    ref_count: string;
  }>(
    `SELECT t.*, (SELECT COUNT(*) FROM entry_tags et WHERE et.tag_id=t.id)::text AS ref_count
     FROM tags t WHERE t.merged_into IS NULL ORDER BY t.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    active: r.active,
    refCount: Number(r.ref_count),
    createdBy: r.created_by,
  }));
}

/** 编辑器的分类 → 场景联动树 */
export async function catalogTree(): Promise<Array<{ id: string; zh: string; en: string; scenes: Array<{ id: string; zh: string; en: string }> }>> {
  const cats = await listCategories();
  const scenes = await listScenes();
  // 只暴露已发布的分类/场景：草稿或审核中的一旦被选，提交知识时会被门禁挡住
  return cats
    .filter((c) => c.active && c.status === 'published')
    .map((c) => ({
      id: c.id,
      zh: c.nameZh,
      en: c.nameEn,
      scenes: scenes
        .filter((s) => s.categoryId === c.id && s.active && s.status === 'published')
        .map((s) => ({ id: s.id, zh: s.nameZh, en: s.nameEn })),
    }));
}

/* ══════════ 写：分类 ══════════ */

async function nextCode(table: string, prefix: string, base: number): Promise<string> {
  const { rows } = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return `${prefix}-${base + Number(rows[0].n)}`;
}

export interface MetaSaveResult<T> {
  item: T;
  /** 审核结果：无自动过审权限时 applied=false，内容要等审核通过才生效 */
  review: { code: string; applied: boolean; message: string };
  /** 生效时若触碰了 Zendesk，如实回传 */
  sync?: { ok: boolean; message: string };
}

/**
 * 分类新增 / 更新——统一走审核（用户要求 1a）。
 * 未发布的行可以直接写库（它还不是线上数据）；已发布的行只把变更放进审核请求，
 * 通过后再落库并同步 Zendesk，避免「审核还没过、线上名字先改了」。
 */
export async function upsertCategory(
  user: SessionUser,
  id: string | null,
  nameZh: string,
  nameEn: string,
): Promise<MetaSaveResult<CategoryDto>> {
  let action: 'create' | 'update' = 'update';
  let before: Record<string, unknown> = {};
  if (id) {
    const { rows } = await query<{ name_zh: string; name_en: string; status: string }>(
      'SELECT name_zh, name_en, status FROM categories WHERE id=$1',
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError('分类不存在', 404);
    const open = await openRequestFor('category', id);
    if (open) throw new DomainError(`该分类已有待审请求 ${open.code}，请先等待审核结论。`, 409);
    before = { nameZh: row.name_zh, nameEn: row.name_en, status: row.status };
    if (row.status !== 'published') {
      await query('UPDATE categories SET name_zh=$2, name_en=$3, updated_at=now() WHERE id=$1', [id, nameZh, nameEn]);
    }
  } else {
    action = 'create';
    id = newId('cat');
    const code = await nextCode('categories', 'CAT', 401);
    const { rows: seq } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM categories');
    await query(
      `INSERT INTO categories (id, code, name_zh, name_en, sort_order, status, active)
       VALUES ($1,$2,$3,$4,$5,'pending',TRUE)`,
      [id, code, nameZh, nameEn, Number(seq[0].n)],
    );
    before = { status: 'draft' };
  }
  const { rows: codeRows } = await query<{ code: string }>('SELECT code FROM categories WHERE id=$1', [id]);
  const out = await submitRequest(user, {
    objectType: 'category',
    objectId: id,
    objectCode: codeRows[0].code,
    objectLabel: `${nameZh} / ${nameEn || '未翻译'}`,
    action,
    payload: { nameZh, nameEn, categoryZh: nameZh },
    before,
  });
  return {
    item: (await listCategories()).find((c) => c.id === id)!,
    review: { code: out.request.code, applied: out.applied, message: out.message },
    sync: out.sync,
  };
}

/** 场景新增 / 更新——门禁：所属分类必须已发布（用户要求 4a） */
export async function upsertScene(
  user: SessionUser,
  id: string | null,
  nameZh: string,
  nameEn: string,
  categoryId: string,
): Promise<MetaSaveResult<SceneDto>> {
  await assertCategoryPublished(categoryId);
  const { rows: catRows } = await query<{ name_zh: string }>('SELECT name_zh FROM categories WHERE id=$1', [
    categoryId,
  ]);
  const categoryZh = catRows[0]?.name_zh ?? '';

  let action: 'create' | 'update' = 'update';
  let before: Record<string, unknown> = {};
  if (id) {
    const { rows } = await query<{ name_zh: string; name_en: string; status: string; category_id: string }>(
      'SELECT name_zh, name_en, status, category_id FROM scenes WHERE id=$1',
      [id],
    );
    const row = rows[0];
    if (!row) throw new DomainError('场景不存在', 404);
    const open = await openRequestFor('scene', id);
    if (open) throw new DomainError(`该场景已有待审请求 ${open.code}，请先等待审核结论。`, 409);
    before = { nameZh: row.name_zh, nameEn: row.name_en, status: row.status, categoryId: row.category_id };
    if (row.status !== 'published') {
      await query('UPDATE scenes SET name_zh=$2, name_en=$3, category_id=$4, updated_at=now() WHERE id=$1', [
        id,
        nameZh,
        nameEn,
        categoryId,
      ]);
    }
  } else {
    action = 'create';
    id = newId('scn');
    const code = await nextCode('scenes', 'SCENE', 201);
    const { rows: seq } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM scenes');
    await query(
      `INSERT INTO scenes (id, code, category_id, name_zh, name_en, sort_order, status, active)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',TRUE)`,
      [id, code, categoryId, nameZh, nameEn, Number(seq[0].n)],
    );
    before = { status: 'draft' };
  }
  const { rows: codeRows } = await query<{ code: string }>('SELECT code FROM scenes WHERE id=$1', [id]);
  const out = await submitRequest(user, {
    objectType: 'scene',
    objectId: id,
    objectCode: codeRows[0].code,
    objectLabel: `${nameZh} / ${nameEn || '未翻译'}`,
    action,
    payload: { nameZh, nameEn, categoryId, categoryZh, sceneZh: nameZh },
    before,
  });
  return {
    item: (await listScenes()).find((s) => s.id === id)!,
    review: { code: out.request.code, applied: out.applied, message: out.message },
    sync: out.sync,
  };
}

export async function upsertTag(
  user: SessionUser,
  id: string | null,
  name: string,
  type: TagType,
): Promise<TagDto> {
  if (id) {
    await query('UPDATE tags SET name=$2, type=$3 WHERE id=$1', [id, name, type]);
  } else {
    id = newId('tag');
    const code = await nextCode('tags', 'TAG', 301);
    await query('INSERT INTO tags (id, code, name, type, created_by) VALUES ($1,$2,$3,$4,$5)', [
      id,
      code,
      name,
      type,
      user.name,
    ]);
  }
  await writeAudit(actorOf(user), {
    action: '保存标签',
    objectType: 'tag',
    objectCode: name,
    objectLabel: `${name}（${type}）`,
  });
  return (await listTags()).find((t) => t.id === id)!;
}

/** 标签上下架保持即时生效——标签只影响本地检索，不进 Zendesk 目录 */
export async function toggleTag(user: SessionUser, id: string): Promise<boolean> {
  const { rows } = await query<{ active: boolean; name: string }>(
    `UPDATE tags SET active = NOT active WHERE id=$1 RETURNING active, name`,
    [id],
  );
  if (!rows[0]) throw new DomainError('标签不存在', 404);
  await writeAudit(actorOf(user), {
    action: `${rows[0].active ? '上架' : '下架'}标签`,
    objectType: 'tag',
    objectCode: rows[0].name,
    objectLabel: rows[0].name,
  });
  return rows[0].active;
}

/** 分类 / 场景上下架：提交审核，通过后才生效并同步 Zendesk（用户要求 1a + 5） */
export async function requestMetaToggle(
  user: SessionUser,
  kind: 'category' | 'scene',
  id: string,
  next: 'publish' | 'unpublish',
): Promise<{ review: { code: string; applied: boolean; message: string }; sync?: { ok: boolean; message: string } }> {
  const table = kind === 'category' ? 'categories' : 'scenes';
  const { rows } = await query<{ code: string; name_zh: string; name_en: string; status: string }>(
    `SELECT code, name_zh, name_en, status FROM ${table} WHERE id=$1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new DomainError(`${kind === 'category' ? '分类' : '场景'}不存在`, 404);
  const open = await openRequestFor(kind, id);
  if (open) throw new DomainError(`该对象已有待审请求 ${open.code}，请先等待审核结论。`, 409);
  if (next === 'unpublish' && row.status !== 'published') {
    throw new DomainError('只有已上架的对象可以下架。', 409);
  }
  if (next === 'publish' && row.status === 'published') {
    throw new DomainError('该对象已经是上架状态。', 409);
  }
  // 上架场景同样受门禁约束：父分类没上架，场景挂不上去
  if (next === 'publish' && kind === 'scene') {
    const { rows: parent } = await query<{ category_id: string }>('SELECT category_id FROM scenes WHERE id=$1', [id]);
    await assertCategoryPublished(parent[0]?.category_id ?? null);
  }
  const payload: Record<string, unknown> = { nameZh: row.name_zh, nameEn: row.name_en };
  if (kind === 'category') payload.categoryZh = row.name_zh;
  else payload.sceneZh = row.name_zh;

  const out = await submitRequest(user, {
    objectType: kind,
    objectId: id,
    objectCode: row.code,
    objectLabel: `${row.name_zh}（${next === 'publish' ? '上架' : '下架'}）`,
    action: next,
    payload,
    before: { status: row.status },
  });
  return { review: { code: out.request.code, applied: out.applied, message: out.message }, sync: out.sync };
}

export { unpublishImpact };

/** 标签合并：引用自动改写到目标标签，源标签留 merged_into 痕迹 */
export async function mergeTag(user: SessionUser, sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new DomainError('不能合并到自身。', 400);
  const { rows } = await query<{ name: string }>('SELECT name FROM tags WHERE id=$1', [sourceId]);
  const { rows: tRows } = await query<{ name: string }>('SELECT name FROM tags WHERE id=$1', [targetId]);
  if (!rows[0] || !tRows[0]) throw new DomainError('标签不存在', 404);
  await query(
    `INSERT INTO entry_tags (entry_id, tag_id)
     SELECT entry_id, $2 FROM entry_tags WHERE tag_id=$1
     ON CONFLICT DO NOTHING`,
    [sourceId, targetId],
  );
  await query('DELETE FROM entry_tags WHERE tag_id=$1', [sourceId]);
  await query('UPDATE tags SET merged_into=$2, active=FALSE WHERE id=$1', [sourceId, targetId]);
  await writeAudit(actorOf(user), {
    action: '合并标签',
    objectType: 'tag',
    objectCode: rows[0].name,
    objectLabel: `${rows[0].name} → ${tRows[0].name}`,
  });
}

/** 中文名 → 英文名（大模型翻译，可人工二次编辑） */
export async function translateMetaName(text: string, kind: '分类' | '场景'): Promise<{ en: string; degraded: boolean }> {
  const llm = getLlm();
  const [res] = await llm.translateToEnglish([{ paragraphId: '__meta__', zh: text }]);
  const en = (res?.en ?? '').trim();
  const degraded = llm.mode !== 'qwen';
  return { en: en || `${kind === '场景' ? 'Scene' : 'Category'}`, degraded };
}
