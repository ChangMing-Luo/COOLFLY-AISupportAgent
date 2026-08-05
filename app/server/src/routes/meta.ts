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
  toggleMeta,
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
    return { category: await upsertCategory(req.currentUser!, null, body.nameZh, body.nameEn) };
  });

  app.put('/api/meta/categories/:id', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = upsertCategorySchema.parse(req.body);
    return { category: await upsertCategory(req.currentUser!, id, body.nameZh, body.nameEn) };
  });

  app.post('/api/meta/scenes', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const body = upsertSceneSchema.parse(req.body);
    return { scene: await upsertScene(req.currentUser!, null, body.nameZh, body.nameEn, body.categoryId) };
  });

  app.put('/api/meta/scenes/:id', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = upsertSceneSchema.parse(req.body);
    return { scene: await upsertScene(req.currentUser!, id, body.nameZh, body.nameEn, body.categoryId) };
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

  app.post('/api/meta/:kind/:id/toggle', { preHandler: requirePermission('meta.manage') }, async (req) => {
    const { kind, id } = req.params as { kind: 'categories' | 'scenes' | 'tags'; id: string };
    const map = { categories: 'category', scenes: 'scene', tags: 'tag' } as const;
    const active = await toggleMeta(req.currentUser!, map[kind], id);
    return { active };
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
