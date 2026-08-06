import type { FastifyInstance } from 'fastify';
import {
  mergeTagSchema,
  translateMetaSchema,
  upsertCategorySchema,
  upsertSceneSchema,
  upsertTagSchema,
} from '@kb/contracts';
import { requirePermission } from '../core/rbac.js';
import {
  listCategories,
  listScenes,
  listTags,
  mergeTag,
  requestMetaToggle,
  toggleTag,
  unpublishImpact,
  translateMetaName,
  upsertCategory,
  upsertScene,
  upsertTag,
} from '../services/meta.js';

export async function registerMetaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/meta/categories', async () => ({ categories: await listCategories() }));
  app.get('/api/meta/scenes', async () => ({ scenes: await listScenes() }));
  app.get('/api/meta/tags', async () => ({ tags: await listTags() }));

  app.post('/api/meta/categories', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const body = upsertCategorySchema.parse(req.body);
    const r = await upsertCategory(req.currentUser!, null, body.nameZh, body.nameEn);
    return { category: r.item, review: r.review, sync: r.sync };
  });

  app.put('/api/meta/categories/:id', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = upsertCategorySchema.parse(req.body);
    const r = await upsertCategory(req.currentUser!, id, body.nameZh, body.nameEn);
    return { category: r.item, review: r.review, sync: r.sync };
  });

  app.post('/api/meta/scenes', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const body = upsertSceneSchema.parse(req.body);
    const r = await upsertScene(req.currentUser!, null, body.nameZh, body.nameEn, body.categoryId);
    return { scene: r.item, review: r.review, sync: r.sync };
  });

  app.put('/api/meta/scenes/:id', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = upsertSceneSchema.parse(req.body);
    const r = await upsertScene(req.currentUser!, id, body.nameZh, body.nameEn, body.categoryId);
    return { scene: r.item, review: r.review, sync: r.sync };
  });

  app.post('/api/meta/tags', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const body = upsertTagSchema.parse(req.body);
    return { tag: await upsertTag(req.currentUser!, null, body.name, body.type) };
  });

  app.put('/api/meta/tags/:id', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = upsertTagSchema.parse(req.body);
    return { tag: await upsertTag(req.currentUser!, id, body.name, body.type) };
  });

  /** 下架影响面：前端二次确认弹窗按这个如实列后果（用户要求 5） */
  app.get('/api/meta/:kind/:id/impact', async (req) => {
    const { kind, id } = req.params as { kind: 'categories' | 'scenes'; id: string };
    return unpublishImpact(kind === 'categories' ? 'category' : 'scene', id);
  });

  app.post('/api/meta/:kind/:id/toggle', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { kind, id } = req.params as { kind: 'categories' | 'scenes' | 'tags'; id: string };
    if (kind === 'tags') return { active: await toggleTag(req.currentUser!, id) };
    const objectType = kind === 'categories' ? 'category' : 'scene';
    const table = kind === 'categories' ? 'categories' : 'scenes';
    const { query } = await import('../db/pool.js');
    const { rows } = await query<{ status: string }>(`SELECT status FROM ${table} WHERE id=$1`, [id]);
    const next = rows[0]?.status === 'published' ? 'unpublish' : 'publish';
    const out = await requestMetaToggle(req.currentUser!, objectType, id, next);
    return { ...out, next };
  });

  app.post('/api/meta/tags/:id/merge', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = mergeTagSchema.parse(req.body);
    await mergeTag(req.currentUser!, id, body.targetId);
    return { tags: await listTags() };
  });

  app.post('/api/meta/translate', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const body = translateMetaSchema.parse(req.body);
    return translateMetaName(body.text, body.kind);
  });
}
