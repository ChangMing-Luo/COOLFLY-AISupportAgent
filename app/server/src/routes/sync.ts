import type { FastifyInstance } from 'fastify';
import { driftResolveSchema, zhCN } from '@kb/contracts';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { listDrift, listMappings, listSyncTasks, resolveDrift, retryTask, scanDrift, syncStats } from '../services/sync.js';

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sync/tasks', { preHandler: requireLogin }, async () => ({
    tasks: await listSyncTasks(),
    stats: await syncStats(),
    stateMachineNote: zhCN.sync.stateMachine,
  }));

  /** 手动重试仅审核员（publish 权限点） */
  app.post('/api/sync/tasks/:id/retry', { preHandler: [requireLogin, requirePermission('publish')] }, async (req) => {
    const { id } = req.params as { id: string };
    return retryTask(req.currentUser!, id);
  });

  app.get('/api/sync/drift', { preHandler: requireLogin }, async () => ({
    records: await listDrift(),
    governanceNote: zhCN.sync.driftGovernance,
  }));

  app.post('/api/sync/drift/scan', { preHandler: [requireLogin, requirePermission('publish')] }, async () => scanDrift());

  app.post('/api/sync/drift/:id/resolve', { preHandler: [requireLogin, requirePermission('publish')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { action } = driftResolveSchema.parse(req.body);
    return resolveDrift(req.currentUser!, id, action);
  });

  app.get('/api/sync/mapping', { preHandler: requireLogin }, async () => ({
    rows: await listMappings(),
    note: zhCN.sync.mappingNote,
  }));
}
