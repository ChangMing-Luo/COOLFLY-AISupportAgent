import type { FastifyInstance } from 'fastify';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { approveEntry, claimReview, entryDiff, offlineEntry, previewGate, publishEntry, rejectEntry, reviewQueue, rollbackEntry } from '../services/review.js';
import { drainQueue } from '../services/sync.js';

export async function registerReviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/review/queue', { preHandler: requireLogin }, async () => reviewQueue());

  /** 变更对照详情层：审核中心「查看具体变更」按需拉取 git diff 数据（AC-F09-23 rev6） */
  app.get('/api/review/:id/diff', { preHandler: requireLogin }, async (req) => {
    const { id } = req.params as { id: string };
    return entryDiff(id);
  });

  app.get('/api/review/:id/gate', { preHandler: requireLogin }, async (req) => {
    const { id } = req.params as { id: string };
    return previewGate(id);
  });

  app.post('/api/review/:id/approve', { preHandler: [requireLogin, requirePermission('review.decide')] }, async (req) => {
    const { id } = req.params as { id: string };
    return approveEntry(req.currentUser!, id);
  });

  app.post('/api/review/:id/reject', { preHandler: [requireLogin, requirePermission('review.decide')] }, async (req) => {
    const { id } = req.params as { id: string };
    return rejectEntry(req.currentUser!, id, req.body);
  });

  /** 发布——同步队列唯一写入源；门禁四查在服务层强制 */
  app.post('/api/review/:id/publish', { preHandler: [requireLogin, requirePermission('publish')] }, async (req) => {
    const { id } = req.params as { id: string };
    const result = await publishEntry(req.currentUser!, id);
    if (result.status === 'published') await drainQueue();
    return result;
  });

  /** 认领审核：打开待审详情即 pending_review → reviewing（缺口 1，让「审核中」态真正可达） */
  app.post('/api/review/:id/claim', { preHandler: [requireLogin, requirePermission('review.decide')] }, async (req) => {
    const { id } = req.params as { id: string };
    return claimReview(req.currentUser!, id);
  });

  /** 条目下线：published → offline + Zendesk 归档（不物理删除；仅知识审核员） */
  app.post('/api/review/:id/offline', { preHandler: [requireLogin, requirePermission('publish')] }, async (req) => {
    const { id } = req.params as { id: string };
    const result = await offlineEntry(req.currentUser!, id);
    await drainQueue();
    return result;
  });

  app.post('/api/review/:id/rollback', { preHandler: [requireLogin, requirePermission('version.rollback')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { targetVersionNo } = req.body as { targetVersionNo: number };
    const result = await rollbackEntry(req.currentUser!, id, targetVersionNo);
    await drainQueue();
    return result;
  });
}
