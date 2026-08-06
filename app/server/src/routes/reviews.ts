import type { FastifyInstance } from 'fastify';
import { approveSchema, rejectSchema } from '@kb/contracts';
import { requirePermission } from '../core/rbac.js';
import { canAutoApprove, decide, findRequest, listPending, listRecords } from '../services/reviews.js';

/**
 * 统一审核队列：分类、场景、知识正文三类对象共用（用户要求 1a / 1b）。
 * 知识正文的详细 diff 与预检仍在 /api/entries/:code/review，这里给的是队列与结论。
 */
export async function registerReviewRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/reviews/pending', async (req) => ({
    requests: await listPending(),
    autoApprove: req.currentUser ? await canAutoApprove(req.currentUser) : false,
  }));

  app.get('/api/reviews/records', async () => ({ requests: await listRecords() }));

  app.get('/api/reviews/:code', async (req) => {
    const { code } = req.params as { code: string };
    return { request: await findRequest(code) };
  });

  app.post('/api/reviews/:code/approve', { preHandler: requirePermission('review.decide') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = approveSchema.parse(req.body ?? {});
    const out = await decide(req.currentUser!, code, 'approved', body.comment);
    return { request: out.request, sync: out.sync };
  });

  app.post('/api/reviews/:code/reject', { preHandler: requirePermission('review.decide') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = rejectSchema.parse(req.body ?? {});
    const out = await decide(req.currentUser!, code, 'rejected', body.comment);
    return { request: out.request };
  });
}
