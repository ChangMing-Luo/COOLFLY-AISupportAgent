import type { FastifyInstance } from 'fastify';
import { chapterMoveSchema, chapterUpsertSchema, submitReviewSchema, TUNABLES, zhCN } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { DomainError, getEntry, getSummary, listEntries, saveEntry, submitForReview, updateSummary } from '../services/entries.js';
import { confirmTranslation, editEnTitle, editPair, listPairs, translate } from '../services/translation.js';
import { getZendesk, ZendeskApiError } from '../integrations/zendesk.js';

/** Zendesk 结构调用失败 → 上游错误如实回传（本台不留半截结构，调用方看到原因后重试） */
function rethrowStructure(err: unknown): never {
  if (err instanceof ZendeskApiError) {
    throw new DomainError(`Zendesk 结构同步失败：${err.message}`, 502);
  }
  throw err;
}
import { getLlm } from '../integrations/llm.js';

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

  /**
   * 结构维护四接口（08-05-2026 拍板）：结构只在本台维护并**实时同步 Zendesk**——
   * 目录→Category、章节→Section；Zendesk 侧不再手工维护结构。
   * 顺序统一为「先 Zendesk 后本地」：Zendesk 失败则本地不落（502 回传原因）；
   * 本地写失败留下的 Zendesk 空结构无害且可见，重试即复用（挂接字段填 id）。
   */

  /** 父目录无 Category 映射时懒创建（存量目录首次挂新章节时补齐） */
  async function ensureCategoryRef(dir: { id: string; name: string; ref: string | null }): Promise<string> {
    if (dir.ref) return dir.ref;
    const created = await getZendesk().createCategory(dir.name).catch(rethrowStructure);
    await query('UPDATE chapters SET zendesk_section_ref=$2 WHERE id=$1', [dir.id, created.id]);
    return created.id;
  }

  // 章节管理：含条目或子章节的章节禁止删除（先移空）
  app.post('/api/kb/chapters', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const input = chapterUpsertSchema.parse(req.body);
    const id = newId('chap');
    // 挂接语义：zendeskSectionRef 填了 = 挂接 Zendesk 既有结构；留空 = 由本台创建
    let ref = input.zendeskSectionRef?.trim() || null;
    if (input.parentId === null) {
      if (!ref) ref = (await getZendesk().createCategory(input.name).catch(rethrowStructure)).id;
    } else {
      const { rows: parentRows } = await query<{ id: string; name: string; parent_id: string | null; zendesk_section_ref: string | null }>(
        'SELECT id, name, parent_id, zendesk_section_ref FROM chapters WHERE id=$1',
        [input.parentId],
      );
      const parent = parentRows[0];
      if (!parent) throw new DomainError('父目录不存在', 404);
      if (parent.parent_id) throw new DomainError('父级必须是顶级目录——结构深度恒为 2', 409);
      if (!ref) {
        const catRef = await ensureCategoryRef({ id: parent.id, name: parent.name, ref: parent.zendesk_section_ref });
        ref = (await getZendesk().createSection(catRef, input.name).catch(rethrowStructure)).id;
      }
    }
    await query(
      'INSERT INTO chapters (id, library_id, parent_id, name, zendesk_section_ref) VALUES ($1,$2,$3,$4,$5)',
      [id, input.libraryId, input.parentId, input.name, ref],
    );
    const kind = input.parentId === null ? '目录' : '章节';
    const zdKind = input.parentId === null ? 'Category' : 'Section';
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: input.name,
      action: `新建${kind}`, category: 'content', field: kind, before: '—', after: input.name,
      note: input.zendeskSectionRef?.trim()
        ? `挂接 Zendesk 既有 ${zdKind} ${ref}`
        : `已在 Zendesk 创建 ${zdKind} ${ref}（结构由本台维护并同步）`,
    });
    return { id, zendeskRef: ref };
  });

  app.put('/api/kb/chapters/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    const { rows } = await query<{ name: string; parent_id: string | null; zendesk_section_ref: string | null }>(
      'SELECT name, parent_id, zendesk_section_ref FROM chapters WHERE id=$1',
      [id],
    );
    if (!rows[0]) throw new DomainError('章节不存在', 404);
    const r = rows[0];
    if (r.zendesk_section_ref) {
      const zd = getZendesk();
      await (r.parent_id === null
        ? zd.renameCategory(r.zendesk_section_ref, name)
        : zd.renameSection(r.zendesk_section_ref, name)
      ).catch(rethrowStructure);
    }
    await query('UPDATE chapters SET name=$2 WHERE id=$1', [id, name]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: name,
      action: '重命名章节', category: 'content', field: '名称', before: r.name, after: name,
      note: r.zendesk_section_ref
        ? `Zendesk ${r.parent_id === null ? 'Category' : 'Section'} ${r.zendesk_section_ref} 已同步改名`
        : '未挂接 Zendesk 结构，仅本台改名',
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
    const { rows: targetRows } = await query<{ name: string; parent_id: string | null; library_id: string; zendesk_section_ref: string | null }>(
      'SELECT name, parent_id, library_id, zendesk_section_ref FROM chapters WHERE id=$1',
      [parentId],
    );
    const target = targetRows[0];
    if (!target) throw new DomainError('目标目录不存在', 404);
    if (target.parent_id) throw new DomainError('目标必须是顶级目录——结构深度恒为 2', 409);
    if (target.library_id !== me.library_id) throw new DomainError('不能跨知识库移动章节', 409);
    const { rows: meRefRows } = await query<{ zendesk_section_ref: string | null }>(
      'SELECT zendesk_section_ref FROM chapters WHERE id=$1',
      [id],
    );
    const meRef = meRefRows[0]?.zendesk_section_ref ?? null;
    if (meRef) {
      // Zendesk 侧同步移动：目标目录无 Category 时懒创建
      const catRef = await ensureCategoryRef({ id: parentId, name: target.name, ref: target.zendesk_section_ref });
      await getZendesk().moveSection(meRef, catRef).catch(rethrowStructure);
    }
    const { rows: oldRows } = await query<{ name: string }>('SELECT name FROM chapters WHERE id=$1', [me.parent_id]);
    await query('UPDATE chapters SET parent_id=$2 WHERE id=$1', [id, parentId]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: me.name,
      action: '调整章节层级', category: 'content', field: '所属目录',
      before: oldRows[0]?.name ?? me.parent_id, after: target.name,
      note: meRef ? `Zendesk Section ${meRef} 已同步移动到目标目录 Category` : '未挂接 Zendesk 结构，仅本台移动',
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
    const { rows } = await query<{ name: string; parent_id: string | null; zendesk_section_ref: string | null }>(
      'SELECT name, parent_id, zendesk_section_ref FROM chapters WHERE id=$1',
      [id],
    );
    if (!rows[0]) throw new DomainError('章节不存在', 404);
    const r = rows[0];
    let zdNote = '未挂接 Zendesk 结构，仅本台删除';
    if (r.zendesk_section_ref) {
      const zd = getZendesk();
      if (r.parent_id === null) {
        // 目录 → Category：Zendesk 端该 Category 仍有 Section（可能含本台未挂接的存量）则拒删，防连带删掉线上文章
        const n = await zd.categorySectionCount(r.zendesk_section_ref).catch(rethrowStructure);
        if (n > 0) {
          throw new DomainError(
            `Zendesk 端该 Category 仍有 ${n} 个 Section——删除会连带删除其中全部文章，已拒绝。请先移空 Zendesk 端结构`,
            409,
          );
        }
        await zd.deleteCategory(r.zendesk_section_ref).catch(rethrowStructure);
        zdNote = `Zendesk Category ${r.zendesk_section_ref} 已同步删除`;
      } else {
        // 章节 → Section：本地条目已清空，但 Zendesk 端可能有非本台文章（如原有英文文章）
        const n = await zd.sectionArticleCount(r.zendesk_section_ref).catch(rethrowStructure);
        if (n > 0) {
          throw new DomainError(
            `Zendesk 端该 Section 仍有 ${n} 篇文章——删除会连带删除线上文章，已拒绝。请先在 Zendesk 迁移或归档这些文章`,
            409,
          );
        }
        await zd.deleteSection(r.zendesk_section_ref).catch(rethrowStructure);
        zdNote = `Zendesk Section ${r.zendesk_section_ref} 已同步删除`;
      }
    }
    await query('DELETE FROM chapters WHERE id=$1', [id]);
    await writeAudit(req.currentUser!, {
      objectType: 'chapter', objectId: id, objectLabel: r.name,
      action: '删除章节', category: 'content', field: '章节', before: r.name, after: '—', note: zdNote,
    });
    return { ok: true };
  });

  /** 批量导入（飞书 120+ 篇一次性迁移）——全部进审核队列，失败逐条报告 */
  /**
   * AI 整理建议（建议态，技术方案 §6.4）——标签 / 两级问题场景 / 章节归类。
   * 只回建议不写正文，运营在导入预览或录入侧逐项采纳/修改/拒绝；
   * LLM 不可用时 degraded=true，界面须如实标注「AI 建议未生效」。
   */
  app.post('/api/kb/organize-suggest', { preHandler: [requireLogin, requirePermission('entry.write')] }, async (req) => {
    const { libraryId, items } = req.body as { libraryId: string; items: Array<{ key: string; title: string; body: string }> };
    if (!Array.isArray(items) || items.length === 0) throw new DomainError('没有待整理的条目', 400);
    if (items.length > TUNABLES.importMaxRows) throw new DomainError(`单次最多 ${TUNABLES.importMaxRows} 条`, 400);
    const { rows: chapters } = await query<{ name: string }>(
      'SELECT name FROM chapters WHERE library_id=$1 AND parent_id IS NOT NULL ORDER BY sort_order',
      [libraryId],
    );
    const chapterNames = chapters.map((c) => c.name);
    const { rows: sceneRows } = await query<{ scene_l1: string }>(
      `SELECT DISTINCT scene_l1 FROM entries WHERE scene_l1 <> '' ORDER BY scene_l1`,
    );
    const scenes = sceneRows.map((r) => r.scene_l1);
    const llm = getLlm();
    const out: Array<{ key: string; labels: string[]; sceneL1: string; sceneL2: string; chapterName: string; reason: string; degraded: boolean }> = [];
    for (const it of items) {
      try {
        const sug = await llm.suggestOrganize(it.title, it.body, chapterNames, scenes);
        out.push({ key: it.key, ...sug });
      } catch (err) {
        // 单条失败不拖垮整批：如实标 degraded，运营照常人工填
        out.push({
          key: it.key, labels: [], sceneL1: scenes[0] ?? '', sceneL2: '',
          chapterName: chapterNames[0] ?? '', reason: `AI 建议失败：${(err as Error).message}`, degraded: true,
        });
      }
    }
    await writeAudit(req.currentUser!, {
      objectType: 'import', objectId: null, objectLabel: `AI 整理建议 ${items.length} 条`,
      action: 'AI 整理建议', category: 'content',
      field: '结果', before: `${items.length} 条`, after: `建议 ${out.filter((o) => !o.degraded).length} 条 / 降级 ${out.filter((o) => o.degraded).length} 条`,
      note: '建议态：不写正文，运营逐项采纳或拒绝',
    });
    return { suggestions: out, provider: llm.mode };
  });

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
