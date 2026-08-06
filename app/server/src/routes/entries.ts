import type { FastifyInstance } from 'fastify';
import {
  TUNABLES,
  approveSchema,
  batchCodesSchema,
  batchShelfSchema,
  createEntrySchema,
  entryListViewSchema,
  rejectSchema,
  rollbackSchema,
  saveEntrySchema,
} from '@kb/contracts';
import { requirePermission } from '../core/rbac.js';
import { sanitizeRichHtml, toParagraphs } from '../core/content.js';
import { fmtShort, thousands } from '../core/fmt.js';
import {
  DomainError,
  batchDeleteDrafts,
  batchShelf,
  createEntry,
  findEntry,
  listEntries,
  listVersions,
  qualityAdvice,
  restoreEntry,
  saveEntry,
  startRevision,
  submitEntry,
  submitRollback,
  toDto,
} from '../services/entries.js';
import { approve, buildDiff, offlineEntry, precheck, reject } from '../services/review.js';
import { retrySync } from '../services/sync.js';
import { translateEntry, editorSuggestions } from '../services/translation.js';
import { listFeedbacks } from '../services/feedback.js';
import { catalogTree } from '../services/meta.js';
import { dashboard, search } from '../services/dashboard.js';
import { getLlm } from '../integrations/llm.js';

/** 翻译控制台显示的引擎名：真实模式给模型 id，本地模式如实标注 */
function llmLabel(): string {
  const llm = getLlm();
  return llm.mode === 'qwen' ? (process.env.QWEN_MODEL ?? 'qwen3.5-plus') : '本地确定性模式（未配置大模型）';
}

const VIEW_SQL: Record<string, string> = {
  drafts: `WHERE e.status IN ('draft','rejected','fixing') ORDER BY e.updated_at DESC`,
  mine: `WHERE e.status IN ('pending','published') ORDER BY e.updated_at DESC`,
  queue: `WHERE e.status='pending' ORDER BY e.submitted_at`,
  all: `WHERE e.status <> 'offline' ORDER BY e.updated_at DESC`,
  offline: `WHERE e.status='offline' ORDER BY e.updated_at DESC`,
  sync: `WHERE e.status='published' OR e.sync_status <> 'none' ORDER BY e.updated_at DESC`,
};

export async function registerEntryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/bootstrap', async (req) => ({
    user: req.currentUser,
    catalog: await catalogTree(),
    tunables: TUNABLES,
  }));

  app.get('/api/dashboard', async (req) => dashboard(req.currentUser!));

  app.get('/api/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (!q) return { hits: [] };
    return { hits: await search(q) };
  });

  app.get('/api/entries', async (req) => {
    const view = entryListViewSchema.parse((req.query as { view?: string }).view ?? 'all');
    const rows = await listEntries(VIEW_SQL[view]);
    return { view, entries: rows.map(toDto) };
  });

  app.get('/api/entries/:code', async (req) => {
    const { code } = req.params as { code: string };
    const entry = await findEntry(code);
    const dto = toDto(entry);
    const versions = await listVersions(entry);
    const feedbacks = await listFeedbacks(entry.id);
    const advice = qualityAdvice(entry, versions, TUNABLES.rollbackAdvicePp);

    const { rows: syncRows } = await import('../db/pool.js').then((m) =>
      m.query<{ at: Date; object_label: string; result: string; payload_no: string }>(
        `SELECT at, object_label, result, payload_no FROM sync_logs WHERE entry_id=$1 ORDER BY at DESC LIMIT 10`,
        [entry.id],
      ),
    );

    return {
      entry: dto,
      // 富文本原文（详情页按 HTML 渲染，保留标题/列表/图片/表格）。
      // 出口再净化一次：入库前的净化只保护新数据，这层同时挡住升级前存量与库侧直改。
      bodyZh: sanitizeRichHtml(entry.body_zh),
      bodyEn: sanitizeRichHtml(entry.body_en),
      paragraphsZh: toParagraphs(entry.body_zh),
      paragraphsEn: toParagraphs(entry.body_en),
      versions,
      advice,
      feedbacks,
      syncLogs: syncRows.map((r) => ({
        at: fmtShort(r.at),
        label: r.object_label,
        result: r.result,
        payloadNo: r.payload_no,
      })),
      meta: [
        { k: '知识 ID', v: dto.code },
        { k: '一级分类', v: `${dto.categoryZh || '未设置'} / ${dto.categoryEn}` },
        { k: '二级场景', v: `${dto.sceneZh || '未设置'} / ${dto.sceneEn}` },
        { k: '标签', v: dto.tags.join(' / ') || '—' },
        { k: '来源', v: dto.source },
        { k: '累计命中', v: thousands(dto.hits) },
        { k: '最近更新', v: dto.updatedAtFull },
      ],
      healthBars: [
        { label: '命中率', value: dto.confidencePct, pct: dto.confidencePct },
        { label: '采纳率', value: `${dto.adopt}%`, pct: `${dto.adopt}%` },
      ],
    };
  });

  app.post('/api/entries', { preHandler: requirePermission('entry.write') }, async (req) => {
    const body = createEntrySchema.parse(req.body ?? {});
    const entry = await createEntry(req.currentUser!, body);
    return { entry: toDto(entry) };
  });

  app.get('/api/entries/:code/editor', async (req) => {
    const { code } = req.params as { code: string };
    const entry = await findEntry(code);
    return {
      entry: toDto(entry),
      bodyZh: sanitizeRichHtml(entry.body_zh),
      bodyEn: sanitizeRichHtml(entry.body_en),
      categoryId: entry.category_id,
      sceneId: entry.scene_id,
      suggestions: await editorSuggestions(entry),
      catalog: await catalogTree(),
      llmLabel: llmLabel(),
    };
  });

  app.put('/api/entries/:code', { preHandler: requirePermission('entry.write') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = saveEntrySchema.parse(req.body);
    const entry = await saveEntry(req.currentUser!, code, {
      titleZh: body.titleZh,
      titleEn: body.titleEn,
      bodyZh: body.bodyZh,
      bodyEn: body.bodyEn,
      categoryId: body.categoryId ?? null,
      sceneId: body.sceneId ?? null,
      tags: body.tags,
      note: body.note,
      enEdited: body.enEdited,
    });
    return { entry: toDto(entry) };
  });

  app.post('/api/entries/:code/translate', { preHandler: requirePermission('entry.write') }, async (req) => {
    const { code } = req.params as { code: string };
    const out = await translateEntry(req.currentUser!, code);
    return {
      entry: toDto(out.entry),
      bodyEn: out.entry.body_en,
      degraded: out.degraded,
      mode: out.mode,
    };
  });

  app.post('/api/entries/:code/submit', { preHandler: requirePermission('entry.write') }, async (req, reply) => {
    const { code } = req.params as { code: string };
    const out = await submitEntry(req.currentUser!, code);
    if (out.errors.length) {
      return reply.code(422).send({
        error: 'validation',
        message: `有 ${out.errors.length} 项未通过校验，请先修正（含英文翻译）。`,
        errors: out.errors,
        entry: toDto(out.entry),
      });
    }
    return { entry: toDto(out.entry) };
  });

  app.post('/api/entries/:code/revise', { preHandler: requirePermission('entry.write') }, async (req) => {
    const { code } = req.params as { code: string };
    const entry = await startRevision(req.currentUser!, code);
    return { entry: toDto(entry) };
  });

  app.post('/api/entries/:code/restore', { preHandler: requirePermission('kb.offline') }, async (req) => {
    const { code } = req.params as { code: string };
    return { entry: toDto(await restoreEntry(req.currentUser!, code)) };
  });

  app.post('/api/entries/:code/rollback', { preHandler: requirePermission('entry.write') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = rollbackSchema.parse(req.body);
    const entry = await submitRollback(req.currentUser!, code, body.version);
    return { entry: toDto(entry) };
  });

  app.post('/api/entries/:code/offline', { preHandler: requirePermission('kb.offline') }, async (req) => {
    const { code } = req.params as { code: string };
    return { entry: toDto(await offlineEntry(req.currentUser!, code)) };
  });

  app.post('/api/entries/:code/sync', { preHandler: requirePermission('sync.run') }, async (req) => {
    const { code } = req.params as { code: string };
    const out = await retrySync(req.currentUser!, code);
    return { ...out, entry: toDto(await findEntry(code)) };
  });

  /* ══════ 批量操作（用户要求 5） ══════ */

  app.post('/api/entries/batch/delete', { preHandler: requirePermission('entry.write') }, async (req) => {
    const body = batchCodesSchema.parse(req.body);
    return batchDeleteDrafts(req.currentUser!, body.codes);
  });

  app.post('/api/entries/batch/shelf', { preHandler: requirePermission('kb.offline') }, async (req) => {
    const body = batchShelfSchema.parse(req.body);
    return batchShelf(req.currentUser!, body.codes, body.action);
  });

  /* ══════ 审核 ══════ */

  app.get('/api/entries/:code/review', async (req) => {
    const { code } = req.params as { code: string };
    const entry = await findEntry(code);
    if (entry.status !== 'pending') throw new DomainError('该条目不在待审队列。', 409);
    const dto = toDto(entry);
    const queue = await listEntries(VIEW_SQL.queue);
    const index = queue.findIndex((e) => e.code === code) + 1;
    const diff = await buildDiff(entry);
    return {
      entry: dto,
      index: Math.max(1, index),
      total: queue.length,
      diff,
      checks: await precheck(entry),
      meta:
        dto.pendingKind === 'rollback'
          ? `${dto.ownerName} 提交 · ${dto.updatedAt} · 场景 ${dto.sceneZh || '未设置'} · 类型 版本回滚（→ ${dto.pendingVersion}） · AI 置信度 ${dto.confidencePct}`
          : `${dto.ownerName} 提交 · ${dto.updatedAt} · 场景 ${dto.sceneZh || '未设置'} · 英文版本 ${dto.translated ? '已就绪' : '缺失'} · AI 置信度 ${dto.confidencePct}`,
      info: [
        { k: '知识 ID', v: dto.code },
        { k: '提交人', v: dto.ownerName },
        { k: '目标版本', v: dto.pendingKind === 'rollback' ? dto.pendingVersion! : diff.label.split(' ←')[0] },
        { k: '二级场景', v: dto.sceneZh || '未设置' },
        { k: '同步目标', v: 'Zendesk（英文）' },
        { k: '来源', v: dto.source },
      ],
    };
  });

  app.post('/api/entries/:code/approve', { preHandler: requirePermission('review.decide') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = approveSchema.parse(req.body ?? {});
    const entry = await approve(req.currentUser!, code, body.comment);
    return { entry: toDto(entry) };
  });

  app.post('/api/entries/:code/reject', { preHandler: requirePermission('review.decide') }, async (req) => {
    const { code } = req.params as { code: string };
    const body = rejectSchema.parse(req.body ?? {});
    const entry = await reject(req.currentUser!, code, body.comment);
    return { entry: toDto(entry) };
  });
}
