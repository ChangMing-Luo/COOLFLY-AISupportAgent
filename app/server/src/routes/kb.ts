import type { FastifyInstance } from 'fastify';
import { chapterMoveSchema, chapterUpsertSchema, submitReviewSchema, TUNABLES, zhCN } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { DomainError, getEntry, getSummary, listEntries, saveEntry, submitForReview, updateSummary } from '../services/entries.js';
import { confirmTranslation, editEnTitle, editPair, listPairs, translate } from '../services/translation.js';

export async function registerKbRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/kb/libraries', { preHandler: requireLogin }, async () => {
    const { rows } = await query<{ id: string; name: string; note: string; internal_only: boolean; n: string }>(
      `SELECT l.id, l.name, l.note, l.internal_only,
              (SELECT COUNT(*)::text FROM entries e WHERE e.library_id = l.id) AS n
       FROM libraries l ORDER BY l.sort_order`,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, note: r.note, internalOnly: r.internal_only, count: Number(r.n) }));
  });

  app.get('/api/kb/tree', { preHandler: requireLogin }, async (req) => {
    const libraryId = (req.query as { libraryId?: string }).libraryId;
    const { rows } = await query<{
      id: string; name: string; parent_id: string | null; zendesk_section_ref: string | null; library_id: string; n: string;
    }>(
      `SELECT c.id, c.name, c.parent_id, c.zendesk_section_ref, c.library_id,
              (SELECT COUNT(*)::text FROM entries e WHERE e.chapter_id = c.id) AS n
       FROM chapters c ${libraryId ? 'WHERE c.library_id = $1' : ''} ORDER BY c.sort_order`,
      libraryId ? [libraryId] : [],
    );
    // 第三层：树内只呈现已发布条目（页面 MD §5.2「仅已发布」徽章的数据依据）
    const { rows: leaves } = await query<{ id: string; code: string; title: string; chapter_id: string }>(
      `SELECT id, code, title, chapter_id FROM entries WHERE status='published' ORDER BY code`,
    );
    const roots = rows.filter((r) => !r.parent_id);
    return roots.map((root) => ({
      id: root.id,
      name: root.name,
      count: rows.filter((r) => r.parent_id === root.id).reduce((s, r) => s + Number(r.n), 0),
      children: rows
        .filter((r) => r.parent_id === root.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sectionRef: c.zendesk_section_ref,
          count: Number(c.n),
          entries: leaves
            .filter((e) => e.chapter_id === c.id)
            .map((e) => ({ id: e.id, code: e.code, title: e.title })),
        })),
    }));
  });

  app.get('/api/kb/entries', { preHandler: requireLogin }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return listEntries({
      libraryId: q.libraryId,
      status: q.status,
      visibility: q.visibility,
      due: q.due as 'all' | 'overdue' | 'soon' | undefined,
      q: q.q,
    });
  });

  app.get('/api/kb/entries/:id', { preHandler: requireLogin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const entry = await getEntry(id);
    if (!entry) return reply.code(404).send({ error: 'not_found', message: '条目不存在' });
    const pairs = await listPairs(entry.id);
    const { rows: versions } = await query<{
      id: string; version_no: number; label: string; status: string; author_name: string;
      effective_from: Date | null; effective_to: Date | null; calls: number | null;
      hit_rate: string | null; solve_rate: string | null; adopt_rate: string | null; body_snapshot: unknown;
    }>(
      `SELECT v.*, m.calls, m.hit_rate, m.solve_rate, m.adopt_rate
       FROM entry_versions v LEFT JOIN version_metrics m ON m.entry_id=v.entry_id AND m.version_no=v.version_no
       WHERE v.entry_id=$1 ORDER BY v.version_no DESC`,
      [entry.id],
    );
    const { rows: logs } = await query<{
      id: string; at: Date; actor_name: string; actor_role: string; action: string; field: string | null;
      before_value: string | null; after_value: string | null; note: string | null;
    }>('SELECT * FROM audit_logs WHERE object_id=$1 ORDER BY at DESC LIMIT 100', [entry.id]);
    const { rows: signals } = await query<{ channel: string; signal_type: string; excerpt: string | null; certainty: string }>(
      'SELECT channel, signal_type, excerpt, certainty FROM signal_events WHERE entry_id=$1 ORDER BY occurred_at DESC LIMIT 20',
      [entry.id],
    );
    const { rows: effect } = await query<{ bot_refs: number; agent_refs: number; downvotes: number; flags: number; solve_rate: string | null }>(
      'SELECT * FROM entry_effect_metrics WHERE entry_id=$1',
      [entry.id],
    );
    return {
      entry,
      pairs,
      versions: versions.map((v) => ({
        id: v.id,
        versionNo: v.version_no,
        label: v.label,
        status: v.status,
        authorName: v.author_name,
        effectiveFrom: v.effective_from?.toISOString() ?? null,
        effectiveTo: v.effective_to?.toISOString() ?? null,
        calls: v.calls,
        hitRate: v.hit_rate ? Number(v.hit_rate) : null,
        solveRate: v.solve_rate ? Number(v.solve_rate) : null,
        adoptRate: v.adopt_rate ? Number(v.adopt_rate) : null,
        bodySnapshot: v.body_snapshot,
      })),
      logs: logs.map((l) => ({
        id: l.id, at: l.at.toISOString(), actorName: l.actor_name, actorRole: l.actor_role,
        action: l.action, field: l.field, before: l.before_value, after: l.after_value, note: l.note,
      })),
      signals,
      effect: effect[0]
        ? {
            botRefs: effect[0].bot_refs, agentRefs: effect[0].agent_refs, downvotes: effect[0].downvotes,
            flags: effect[0].flags, solveRate: effect[0].solve_rate ? Number(effect[0].solve_rate) : null,
            sampleShort: effect[0].bot_refs < TUNABLES.sampleFloor,
          }
        : null,
    };
  });

  app.post('/api/kb/entries', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) =>
    saveEntry(req.currentUser!, null, req.body),
  );

  app.put('/api/kb/entries/:id', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id } = req.params as { id: string };
    return saveEntry(req.currentUser!, id, req.body);
  });

  app.post('/api/kb/entries/:id/submit', { preHandler: [requireLogin, requirePermission('entry.submit')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { source, note } = submitReviewSchema.parse(req.body ?? {});
    return submitForReview(req.currentUser!, id, source, note);
  });

  app.get('/api/kb/entries/:id/summary', { preHandler: requireLogin }, async (req) => {
    const { id } = req.params as { id: string };
    return getSummary(id);
  });

  app.put('/api/kb/entries/:id/summary', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id } = req.params as { id: string };
    return updateSummary(req.currentUser!, id, req.body);
  });

  app.post('/api/kb/entries/:id/translate', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id } = req.params as { id: string };
    return translate(req.currentUser!, id);
  });

  // 注意：须在 /translation/:pairId 之前注册，否则 'title' 会被当作 pairId 匹配
  app.put('/api/kb/entries/:id/translation/title', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { enTitle, note } = req.body as { enTitle: string; note?: string };
    return editEnTitle(req.currentUser!, id, enTitle, note?.trim() || '人工修订英文标题（不改政策口径）');
  });

  app.put('/api/kb/entries/:id/translation/:pairId', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id, pairId } = req.params as { id: string; pairId: string };
    const { en, note } = req.body as { en: string; note: string };
    await editPair(req.currentUser!, id, pairId, en, note);
    return { ok: true };
  });

  app.post('/api/kb/entries/:id/translation/confirm', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { id } = req.params as { id: string };
    return confirmTranslation(req.currentUser!, id);
  });

  // 章节管理：含条目或子章节的章节禁止删除（先移空）
  app.post('/api/kb/chapters', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const input = chapterUpsertSchema.parse(req.body);
    const id = newId('chap');
    await query(
      'INSERT INTO chapters (id, library_id, parent_id, name, zendesk_section_ref) VALUES ($1,$2,$3,$4,$5)',
      [id, input.libraryId, input.parentId, input.name, input.zendeskSectionRef],
    );
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: input.name,
      action: '新建章节', category: 'content', field: '章节', before: '—', after: input.name,
    });
    return { id };
  });

  app.put('/api/kb/chapters/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    const { rows } = await query<{ name: string }>('SELECT name FROM chapters WHERE id=$1', [id]);
    if (!rows[0]) throw new DomainError('章节不存在', 404);
    await query('UPDATE chapters SET name=$2 WHERE id=$1', [id, name]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: name,
      action: '重命名章节', category: 'content', field: '名称', before: rows[0].name, after: name,
    });
    return { ok: true };
  });

  /**
   * 调整层级（v3 原型结构树工具条第三个按钮）：把章节移到另一个顶级目录下。
   * 结构深度恒为 2——目标必须是顶级目录，且不可自指；不支持目录与章节互转。
   */
  app.patch('/api/kb/chapters/:id/parent', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { parentId } = chapterMoveSchema.parse(req.body);
    if (parentId === id) throw new DomainError('不能把章节移到它自己下面', 409);
    const { rows } = await query<{ name: string; parent_id: string | null; library_id: string }>(
      'SELECT name, parent_id, library_id FROM chapters WHERE id=$1',
      [id],
    );
    const me = rows[0];
    if (!me) throw new DomainError('章节不存在', 404);
    if (!me.parent_id) throw new DomainError('顶级目录不可调整层级——结构深度恒为 2', 409);
    const { rows: targetRows } = await query<{ name: string; parent_id: string | null; library_id: string }>(
      'SELECT name, parent_id, library_id FROM chapters WHERE id=$1',
      [parentId],
    );
    const target = targetRows[0];
    if (!target) throw new DomainError('目标目录不存在', 404);
    if (target.parent_id) throw new DomainError('目标必须是顶级目录——结构深度恒为 2', 409);
    if (target.library_id !== me.library_id) throw new DomainError('不能跨知识库移动章节', 409);
    const { rows: oldRows } = await query<{ name: string }>('SELECT name FROM chapters WHERE id=$1', [me.parent_id]);
    await query('UPDATE chapters SET parent_id=$2 WHERE id=$1', [id, parentId]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: me.name,
      action: '调整章节层级', category: 'content', field: '所属目录',
      before: oldRows[0]?.name ?? me.parent_id, after: target.name,
    });
    return { ok: true };
  });

  app.delete('/api/kb/chapters/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { rows: entryCount } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM entries WHERE chapter_id=$1', [id]);
    const { rows: childCount } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM chapters WHERE parent_id=$1', [id]);
    if (Number(entryCount[0]!.n) > 0 || Number(childCount[0]!.n) > 0) {
      throw new DomainError(
        `该章节下仍有 ${entryCount[0]!.n} 个条目、${childCount[0]!.n} 个子章节——请先移空后再删除（防孤儿条目）`,
        409,
      );
    }
    const { rows } = await query<{ name: string }>('SELECT name FROM chapters WHERE id=$1', [id]);
    await query('DELETE FROM chapters WHERE id=$1', [id]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: rows[0]?.name ?? id,
      action: '删除章节', category: 'content', field: '章节', before: rows[0]?.name ?? '', after: '—',
    });
    return { ok: true };
  });

  /** 批量导入（飞书 120+ 篇一次性迁移）——全部进审核队列，失败逐条报告 */
  app.post('/api/kb/import', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { rows: payloadRows, libraryId } = req.body as { rows: string[]; libraryId: string };
    if (!Array.isArray(payloadRows)) throw new DomainError('导入内容为空', 400);
    if (payloadRows.length > TUNABLES.importMaxRows) {
      throw new DomainError(`单文件最多 ${TUNABLES.importMaxRows} 条`, 400);
    }
    const { rows: chapters } = await query<{ id: string; name: string }>(
      'SELECT id, name FROM chapters WHERE library_id=$1 AND parent_id IS NOT NULL',
      [libraryId],
    );
    const ok: string[] = [];
    const failed: Array<{ line: number; reason: string; raw: string }> = [];
    let lineNo = 0;
    for (const raw of payloadRows) {
      lineNo += 1;
      const parts = raw.split('|').map((s) => s.trim());
      if (parts.length < 4) {
        failed.push({ line: lineNo, reason: '字段不全（需 标题|章节|可见性|正文）', raw });
        continue;
      }
      const [title, chapterName, visibility, ...bodyParts] = parts;
      const chapter = chapters.find((c) => c.name === chapterName);
      if (!chapter) {
        failed.push({ line: lineNo, reason: `章节「${chapterName}」不存在`, raw });
        continue;
      }
      if (!['public', 'internal', 'mixed'].includes(visibility!)) {
        failed.push({ line: lineNo, reason: `可见性「${visibility}」非法（public/internal/mixed）`, raw });
        continue;
      }
      const id = newId('ent');
      const { rows: maxCode } = await query<{ max: string | null }>(
        `SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INT))::text AS max FROM entries WHERE code ~ '^KB-[0-9]+$'`,
      );
      const code = `KB-${String(Number(maxCode[0]?.max ?? '200') + 1).padStart(4, '0')}`;
      const paragraphs = bodyParts.join('|').split('\n').map((t) => t.trim()).filter(Boolean).map((text, i) => ({
        id: `p_${i}`, text, html: '', internal: /^(内部[：:]|【内部】)/.test(text), heading: false,
      }));
      await query(
        `INSERT INTO entries (id, code, title, library_id, chapter_id, visibility, scene_l1, scene_l2, labels, body,
           status, review_source, submitter_id, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,'售后与退款','导入',$7::jsonb,$8::jsonb,'pending_review','import',$9,now())`,
        [
          id, code, title, libraryId, chapter.id, visibility,
          JSON.stringify(['批量导入']),
          JSON.stringify({ paragraphs: paragraphs.length ? paragraphs : [{ id: 'p_0', text: bodyParts.join('|'), html: '', internal: false, heading: false }] }),
          req.currentUser!.id,
        ],
      );
      ok.push(code);
    }
    await writeAudit(req.currentUser!, {
      objectType: 'import', objectId: null, objectLabel: `批量导入 ${payloadRows.length} 行`,
      action: '批量导入', category: 'content',
      field: '结果', before: `${payloadRows.length} 行`, after: `成功 ${ok.length}，失败 ${failed.length}`,
      note: '全部成功条目进审核队列（来源：批量导入），无直接入库路径',
    });
    return { total: payloadRows.length, succeeded: ok, failed, note: zhCN.ironLaw.publishBlocked };
  });
}
