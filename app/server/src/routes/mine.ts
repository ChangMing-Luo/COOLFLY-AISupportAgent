import type { FastifyInstance } from 'fastify';
import { candidateActionSchema, zhCN } from '@kb/contracts';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { disposeCandidate, listBatches, listCandidates, runDailyBatch } from '../services/mining.js';

export async function registerMineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/mine/batches', { preHandler: requireLogin }, async () => ({
    batches: await listBatches(),
    admissionNote: zhCN.mine.admission,
  }));

  app.get('/api/mine/candidates', { preHandler: requireLogin }, async (req) => {
    const { batchId } = req.query as { batchId?: string };
    return listCandidates(batchId);
  });

  app.post('/api/mine/batches/run', { preHandler: [requireLogin, requirePermission('entry.submit')] }, async (req) => {
    const { batchDate } = (req.body ?? {}) as { batchDate?: string };
    return runDailyBatch(batchDate ?? new Date().toISOString().slice(0, 10));
  });

  /** 候选处置——起草/挂修订/合并进审核中心；无提交权限降级为提交建议 */
  app.post('/api/mine/candidates/:id/dispose', { preHandler: requireLogin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { action } = candidateActionSchema.parse(req.body);
    const user = req.currentUser!;
    const needsSubmit = action !== 'suggest' && action !== 'discard';
    if (needsSubmit && !user.permissions.includes('entry.submit')) {
      return reply.code(403).send({
        error: 'forbidden',
        message: '当前角色不可提交审核，可改为「提交优化建议」',
      });
    }
    if (action === 'suggest' && !user.permissions.includes('suggestion.submit')) {
      return reply.code(403).send({ error: 'forbidden', message: '当前角色不可提交优化建议' });
    }
    return disposeCandidate(user, id, action);
  });
}
