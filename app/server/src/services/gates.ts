import { query } from '../db/pool.js';
import { DomainError } from './entries.js';

/**
 * 关键节点门禁（SPEC-v4 §2.6）。
 * 三层结构是有依赖的：分类 → 场景 → 知识。上层没发布，下层在 Zendesk 侧就无处可挂，
 * 与其等同步时报一句看不懂的 404，不如在提交/审核前就挡住并告诉用户去哪修。
 */

export interface TaxonomyState {
  id: string;
  code: string;
  name: string;
  status: string;
  active: boolean;
}

async function loadCategory(id: string): Promise<TaxonomyState | null> {
  const { rows } = await query<TaxonomyState>(
    `SELECT id, code, name_zh AS name, status, active FROM categories WHERE id=$1`,
    [id],
  );
  return rows[0] ?? null;
}

async function loadScene(id: string): Promise<(TaxonomyState & { category_id: string }) | null> {
  const { rows } = await query<TaxonomyState & { category_id: string }>(
    `SELECT id, code, name_zh AS name, status, active, category_id FROM scenes WHERE id=$1`,
    [id],
  );
  return rows[0] ?? null;
}

function guidance(kind: '分类' | '场景', name: string, status: string | null): string {
  if (!status) {
    return `所属${kind}不存在或已被删除，请先在元数据中心创建并发布${kind}后再操作。`;
  }
  const label = status === 'offline' ? '已下架' : status === 'pending' ? '审核中' : '尚未发布';
  return `所属${kind}「${name}」${label}，无法继续。请先到元数据中心${
    status === 'offline' ? '重新上架' : '提交并通过审核'
  }该${kind}。`;
}

/** 操作场景：其所属分类必须已发布 */
export async function assertCategoryPublished(categoryId: string | null): Promise<void> {
  if (!categoryId) throw new DomainError('未选择上级分类，无法继续。请先选择一个已发布的知识分类。', 409);
  const c = await loadCategory(categoryId);
  if (!c) throw new DomainError(guidance('分类', '', null), 409);
  if (c.status !== 'published' || !c.active) throw new DomainError(guidance('分类', c.name, c.status), 409);
}

/** 操作知识：其场景与场景所属分类都必须已发布 */
export async function assertScenePublished(sceneId: string | null): Promise<void> {
  if (!sceneId) throw new DomainError('未选择问题场景，无法继续。请先选择一个已发布的问题场景。', 409);
  const s = await loadScene(sceneId);
  if (!s) throw new DomainError(guidance('场景', '', null), 409);
  if (s.status !== 'published' || !s.active) throw new DomainError(guidance('场景', s.name, s.status), 409);
  await assertCategoryPublished(s.category_id);
}

/** 提交 / 审核知识前的完整门禁 */
export async function assertEntryTaxonomyReady(entry: {
  scene_id: string | null;
  category_id: string | null;
}): Promise<void> {
  await assertScenePublished(entry.scene_id);
  if (entry.category_id) await assertCategoryPublished(entry.category_id);
}

/** 非抛错版本，用于列表页给出提示而不阻断渲染 */
export async function taxonomyBlockReason(entry: {
  scene_id: string | null;
  category_id: string | null;
}): Promise<string | null> {
  try {
    await assertEntryTaxonomyReady(entry);
    return null;
  } catch (err) {
    return err instanceof DomainError ? err.message : '门禁校验失败';
  }
}
