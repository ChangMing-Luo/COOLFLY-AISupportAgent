import type { FastifyInstance } from 'fastify';
import { EXTRACT_CONFIG_LABELS, TUNABLES } from '@kb/contracts';
import { requirePermission } from '../core/rbac.js';
import { getLlm } from '../integrations/llm.js';
import { toDto } from '../services/entries.js';
import { acceptCandidate, currentTask, dropCandidate, runCollect } from '../services/collect.js';
import {
  createDraftFromMiss,
  fixFeedback,
  ignoreFeedback,
  listFeedbacks,
  listMisses,
  pullFromZendesk,
  refreshMisses,
} from '../services/feedback.js';
import { listSyncLogs } from '../services/sync.js';
import { healthReport } from '../services/analytics.js';
import { commitImport, parseAndOrganize, type CommitItem } from '../services/importer.js';
import { DomainError } from '../services/entries.js';

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  /* ══════ 采集 ══════ */
  app.get('/api/collect/task', async () => {
    const { task, candidates } = await currentTask();
    const llm = getLlm();
    return {
      task,
      candidates,
      config: [
        { k: EXTRACT_CONFIG_LABELS.source, v: 'Zendesk（固定）' },
        { k: EXTRACT_CONFIG_LABELS.model, v: llm.mode === 'qwen' ? (process.env.QWEN_MODEL ?? 'qwen3.5-plus') : '本地确定性模式' },
        { k: EXTRACT_CONFIG_LABELS.threshold, v: TUNABLES.confidenceThreshold.toFixed(2) },
        { k: EXTRACT_CONFIG_LABELS.dedupe, v: `≥ ${Math.round(TUNABLES.dedupeThreshold * 100)}% 提示` },
      ],
    };
  });

  app.post('/api/collect/run', { preHandler: requirePermission('collect.manage') }, async (req) => {
    await runCollect(req.currentUser!.name, req.currentUser!.id);
    return currentTask();
  });

  app.post('/api/collect/candidates/:code/accept', { preHandler: requirePermission('collect.manage') }, async (req) => {
    const { code } = req.params as { code: string };
    const entry = await acceptCandidate(req.currentUser!, code);
    return { entry: toDto(entry) };
  });

  app.post('/api/collect/candidates/:code/drop', { preHandler: requirePermission('collect.manage') }, async (req) => {
    const { code } = req.params as { code: string };
    await dropCandidate(req.currentUser!, code);
    return { ok: true };
  });

  /* ══════ 反馈 ══════ */
  app.get('/api/feedback', async () => ({ feedbacks: await listFeedbacks() }));

  app.post('/api/feedback/pull', { preHandler: requirePermission('feedback.handle') }, async (req) => {
    const out = await pullFromZendesk(req.currentUser!);
    return { ...out, feedbacks: await listFeedbacks() };
  });

  app.post('/api/feedback/:code/ignore', { preHandler: requirePermission('feedback.handle') }, async (req) => {
    const { code } = req.params as { code: string };
    await ignoreFeedback(req.currentUser!, code);
    return { feedbacks: await listFeedbacks() };
  });

  app.post('/api/feedback/:code/fix', { preHandler: requirePermission('feedback.handle') }, async (req) => {
    const { code } = req.params as { code: string };
    const entry = await fixFeedback(req.currentUser!, code);
    return { entry: toDto(entry) };
  });

  /* ══════ 未命中 ══════ */
  app.get('/api/misses', async () => ({ misses: await listMisses() }));

  app.post('/api/misses/refresh', { preHandler: requirePermission('feedback.handle') }, async () => {
    const created = await refreshMisses();
    return { created, misses: await listMisses() };
  });

  app.post('/api/misses/:code/draft', { preHandler: requirePermission('feedback.handle') }, async (req) => {
    const { code } = req.params as { code: string };
    const entry = await createDraftFromMiss(req.currentUser!, code);
    return { entry: toDto(entry) };
  });

  /* ══════ 一键导入 + AI 整理 ══════ */
  app.post('/api/import/parse', { preHandler: requirePermission('entry.write') }, async (req) => {
    const file = await req.file({ limits: { fileSize: 20 * 1024 * 1024 } });
    if (!file) throw new DomainError('请选择要导入的文件（支持 md / txt / csv / tsv / xlsx / docx）', 400);
    const buf = await file.toBuffer();
    return parseAndOrganize(file.filename, buf);
  });

  app.post('/api/import/commit', { preHandler: requirePermission('entry.write') }, async (req) => {
    const body = req.body as { fileName?: string; items?: CommitItem[] };
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      throw new DomainError('没有可导入的条目', 400);
    }
    return commitImport(req.currentUser!, body.fileName ?? '导入文件', body.items);
  });

  /* ══════ 同步日志 / 数据分析 ══════ */
  app.get('/api/sync/logs', async () => ({ logs: await listSyncLogs() }));
  app.get('/api/analytics/health', { preHandler: requirePermission('analytics.view') }, async () => healthReport());
}
