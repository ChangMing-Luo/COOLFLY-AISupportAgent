import type { SessionUser, TagType } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { getZendesk } from '../integrations/zendesk.js';
import { getLlm } from '../integrations/llm.js';
import { DomainError, actorOf } from './entries.js';

/* ══════════ 读 ══════════ */

export interface CategoryDto {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  active: boolean;
  sceneCount: number;
  entryCount: number;
  zendeskRef: string | null;
}

export async function listCategories(): Promise<CategoryDto[]> {
  const { rows } = await query<{
    id: string;
    code: string;
    name_zh: string;
    name_en: string;
    active: boolean;
    zendesk_category_ref: string | null;
    scene_count: string;
    entry_count: string;
  }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM scenes s WHERE s.category_id=c.id)::text AS scene_count,
            (SELECT COUNT(*) FROM entries e WHERE e.category_id=c.id)::text AS entry_count
     FROM categories c ORDER BY c.sort_order, c.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    active: r.active,
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
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nameZh: r.name_zh,
    nameEn: r.name_en,
    active: r.active,
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
  return cats
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      zh: c.nameZh,
      en: c.nameEn,
      scenes: scenes.filter((s) => s.categoryId === c.id && s.active).map((s) => ({ id: s.id, zh: s.nameZh, en: s.nameEn })),
    }));
}

/* ══════════ 写：分类 ══════════ */

async function nextCode(table: string, prefix: string, base: number): Promise<string> {
  const { rows } = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return `${prefix}-${base + Number(rows[0].n)}`;
}

export async function upsertCategory(
  user: SessionUser,
  id: string | null,
  nameZh: string,
  nameEn: string,
): Promise<CategoryDto> {
  const zd = getZendesk();
  if (id) {
    const { rows } = await query<{ zendesk_category_ref: string | null; name_en: string }>(
      'SELECT zendesk_category_ref, name_en FROM categories WHERE id=$1',
      [id],
    );
    if (!rows[0]) throw new DomainError('分类不存在', 404);
    await query('UPDATE categories SET name_zh=$2, name_en=$3, updated_at=now() WHERE id=$1', [id, nameZh, nameEn]);
    // 结构由本台维护并同步：英文名变了就改 Zendesk Category
    if (rows[0].zendesk_category_ref && nameEn && nameEn !== rows[0].name_en) {
      await zd.renameCategory(rows[0].zendesk_category_ref, nameEn);
    }
  } else {
    id = newId('cat');
    const code = await nextCode('categories', 'CAT', 401);
    const { rows: seq } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM categories');
    await query(
      'INSERT INTO categories (id, code, name_zh, name_en, sort_order) VALUES ($1,$2,$3,$4,$5)',
      [id, code, nameZh, nameEn, Number(seq[0].n)],
    );
  }
  await writeAudit(actorOf(user), {
    action: '保存分类',
    objectType: 'category',
    objectCode: nameZh,
    objectLabel: `${nameZh} / ${nameEn || '未翻译'}`,
  });
  return (await listCategories()).find((c) => c.id === id)!;
}

export async function upsertScene(
  user: SessionUser,
  id: string | null,
  nameZh: string,
  nameEn: string,
  categoryId: string,
): Promise<SceneDto> {
  const zd = getZendesk();
  if (id) {
    const { rows } = await query<{ zendesk_section_ref: string | null; name_en: string }>(
      'SELECT zendesk_section_ref, name_en FROM scenes WHERE id=$1',
      [id],
    );
    if (!rows[0]) throw new DomainError('场景不存在', 404);
    await query('UPDATE scenes SET name_zh=$2, name_en=$3, category_id=$4, updated_at=now() WHERE id=$1', [
      id,
      nameZh,
      nameEn,
      categoryId,
    ]);
    if (rows[0].zendesk_section_ref && nameEn && nameEn !== rows[0].name_en) {
      await zd.renameSection(rows[0].zendesk_section_ref, nameEn);
    }
  } else {
    id = newId('scn');
    const code = await nextCode('scenes', 'SCENE', 201);
    const { rows: seq } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM scenes');
    await query(
      'INSERT INTO scenes (id, code, category_id, name_zh, name_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, code, categoryId, nameZh, nameEn, Number(seq[0].n)],
    );
  }
  await writeAudit(actorOf(user), {
    action: '保存场景',
    objectType: 'scene',
    objectCode: nameZh,
    objectLabel: `${nameZh} / ${nameEn || '未翻译'}`,
  });
  return (await listScenes()).find((s) => s.id === id)!;
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

/** 上下架：下架的分类 / 场景不再对客展示，也不出现在编辑器可选项里 */
export async function toggleMeta(
  user: SessionUser,
  kind: 'category' | 'scene' | 'tag',
  id: string,
): Promise<boolean> {
  const table = kind === 'category' ? 'categories' : kind === 'scene' ? 'scenes' : 'tags';
  const nameCol = kind === 'tag' ? 'name' : 'name_zh';
  const { rows } = await query<{ active: boolean; name: string }>(
    `UPDATE ${table} SET active = NOT active WHERE id=$1 RETURNING active, ${nameCol} AS name`,
    [id],
  );
  if (!rows[0]) throw new DomainError('对象不存在', 404);
  const label = kind === 'category' ? '分类' : kind === 'scene' ? '场景' : '标签';
  await writeAudit(actorOf(user), {
    action: `${rows[0].active ? '上架' : '下架'}${label}`,
    objectType: kind,
    objectCode: rows[0].name,
    objectLabel: rows[0].name,
  });
  return rows[0].active;
}

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
