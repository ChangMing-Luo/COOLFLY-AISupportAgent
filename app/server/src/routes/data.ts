import type { FastifyInstance } from 'fastify';
import { TUNABLES, zhCN } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { DomainError } from '../services/entries.js';
import { collectSignals } from '../services/signals.js';

export async function registerDataRoutes(app: FastifyInstance): Promise<void> {
  /** 手动触发一轮信号采集（cron 之外的补采入口）；degraded 项如实回传给界面标注 */
  app.post('/api/data/signals/collect', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async (req) => {
    const r = await collectSignals();
    await writeAudit(req.currentUser!, {
      objectType: 'signal', objectId: null, objectLabel: '信号采集',
      action: '采集反馈信号', category: 'content',
      field: '结果', before: '—',
      after: `条目 ${r.articles} / 信号 ${r.signals} / 缺口 ${r.gaps} / 关键词 ${r.keywords} / 场景 ${r.scenes}`,
      note: r.degraded.length ? `降级项：${r.degraded.join('；')}` : '全部渠道采集成功',
    });
    return r;
  });

  /** 视图⑦ 数据看板：知识库效果 */
  app.get('/api/metrics/coverage', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{ id: string; name: string; entry_count: number; coverage_pct: number }>(
      'SELECT * FROM coverage_scenes ORDER BY sort_order',
    );
    return rows.map((r) => ({
      name: r.name,
      entryCount: r.entry_count,
      coveragePct: r.coverage_pct,
      low: r.coverage_pct < 40,
    }));
  });

  app.get('/api/metrics/entries', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{
      entry_id: string; title: string; code: string; version: number; chapter: string; parent: string | null;
      bot_refs: number; agent_refs: number; downvotes: number; flags: number; solve_rate: string | null;
    }>(
      `SELECT m.entry_id, e.title, e.code, e.current_version AS version, c.name AS chapter, pc.name AS parent,
              m.bot_refs, m.agent_refs, m.downvotes, m.flags, m.solve_rate
       FROM entry_effect_metrics m
       JOIN entries e ON e.id = m.entry_id
       JOIN chapters c ON c.id = e.chapter_id
       LEFT JOIN chapters pc ON pc.id = c.parent_id
       ORDER BY (m.solve_rate IS NULL), m.solve_rate ASC`,
    );
    return rows.map((r) => {
      const sampleShort = r.bot_refs < TUNABLES.sampleFloor;
      const solve = r.solve_rate === null ? null : Number(r.solve_rate);
      return {
        entryId: r.entry_id,
        code: r.code,
        title: r.title,
        versionLabel: `v${r.version}`,
        chapter: `${r.parent ? `${r.parent} / ` : ''}${r.chapter}`,
        botRefs: r.bot_refs,
        agentRefs: r.agent_refs,
        downvotes: r.downvotes,
        flags: r.flags,
        solveRate: sampleShort ? null : solve,
        sampleShort,
        sampleLabel: sampleShort ? zhCN.dash.sampleShort : null,
        low: !sampleShort && solve !== null && solve < TUNABLES.lowSolveRatePct,
      };
    });
  });

  app.get('/api/metrics/gaps', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{ id: string; topic: string; weekly_count: string; source_split: string; coverage_verdict: string; action: string; disposition: string }>(
      'SELECT * FROM knowledge_gaps ORDER BY id',
    );
    return rows.map((r) => ({
      id: r.id, topic: r.topic, weeklyCount: r.weekly_count, sourceSplit: r.source_split,
      coverageVerdict: r.coverage_verdict, action: r.action, disposition: r.disposition,
    }));
  });

  app.get('/api/metrics/no-results', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{ id: string; keyword: string; weekly_count: number; verdict: string; level: string }>(
      'SELECT * FROM no_result_keywords ORDER BY weekly_count DESC',
    );
    return rows.map((r) => ({ id: r.id, keyword: r.keyword, weeklyCount: r.weekly_count, verdict: r.verdict, level: r.level }));
  });

  app.get('/api/metrics/explore-note', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => ({
    note: zhCN.dash.exploreNote,
  }));

  /** 视图⑧ 反馈回流 */
  app.get('/api/feedback/signals', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{ id: string; scene: string; channel: string; hit_signal: string; solve_signal: string; certainty: string }>(
      'SELECT * FROM signal_matrix ORDER BY sort_order',
    );
    return rows.map((r) => ({
      id: r.id, scene: r.scene, channel: r.channel, hitSignal: r.hit_signal, solveSignal: r.solve_signal, certainty: r.certainty,
    }));
  });

  app.get('/api/feedback/candidates', { preHandler: [requireLogin, requirePermission('metrics.view')] }, async () => {
    const { rows } = await query<{
      id: string; source: string; topic: string; signal_note: string; count_label: string; disposition: string; code: string | null; entry_id: string | null;
    }>(
      `SELECT r.*, e.code FROM revision_candidates r LEFT JOIN entries e ON e.id = r.entry_id ORDER BY r.created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id, source: r.source, topic: r.topic, signalNote: r.signal_note,
      countLabel: r.count_label, disposition: r.disposition, entryCode: r.code, entryId: r.entry_id,
    }));
  });

  /** 修订候选转建议——进审核队列（来源「反馈修订」） */
  app.post('/api/feedback/candidates/:id/suggest', { preHandler: [requireLogin, requirePermission('suggestion.submit')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await query<{ id: string; topic: string; entry_id: string | null; disposition: string; signal_note: string }>(
      'SELECT * FROM revision_candidates WHERE id=$1',
      [id],
    );
    const c = rows[0];
    if (!c) throw new DomainError('修订候选不存在', 404);
    if (c.disposition !== 'pending') throw new DomainError('该候选已处置', 409);

    if (c.entry_id) {
      const { rows: entryRows } = await query<{ status: string; code: string; title: string }>(
        'SELECT status, code, title FROM entries WHERE id=$1',
        [c.entry_id],
      );
      const e = entryRows[0]!;
      await query(
        `UPDATE entries SET status='pending_review', review_source='feedback', submitter_id=$2, submitted_at=now(), updated_at=now() WHERE id=$1`,
        [c.entry_id],
      ).then(() =>
        query('UPDATE entries SET submitter_id=$2 WHERE id=$1', [c.entry_id, req.currentUser!.id]),
      );
      await writeAudit(req.currentUser!, {
        objectType: 'entry', objectId: c.entry_id, objectLabel: `${e.code} ${e.title}`,
        action: '提交优化建议', category: 'review', field: '状态', before: e.status, after: 'pending_review',
        note: `来源：反馈修订（${c.signal_note}）`,
      });
    } else {
      const { rows: libs } = await query<{ id: string }>('SELECT id FROM libraries ORDER BY sort_order LIMIT 1');
      const { rows: chaps } = await query<{ id: string }>('SELECT id FROM chapters WHERE parent_id IS NOT NULL ORDER BY sort_order LIMIT 1');
      const { rows: maxCode } = await query<{ max: string | null }>(
        `SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INT))::text AS max FROM entries WHERE code ~ '^KB-[0-9]+$'`,
      );
      const code = `KB-${String(Number(maxCode[0]?.max ?? '200') + 1).padStart(4, '0')}`;
      const entryId = newId('ent');
      await query(
        `INSERT INTO entries (id, code, title, library_id, chapter_id, visibility, scene_l1, scene_l2, labels, body,
           status, review_source, submitter_id, submitted_at)
         VALUES ($1,$2,$3,$4,$5,'public','售后与退款','反馈',$6::jsonb,$7::jsonb,'pending_review','feedback',$8,now())`,
        [
          entryId, code, c.topic, libs[0]!.id, chaps[0]!.id,
          JSON.stringify(['反馈修订']),
          JSON.stringify({ paragraphs: [{ id: 'p_0', text: c.signal_note, html: '', internal: false, heading: false }] }),
          req.currentUser!.id,
        ],
      );
      await writeAudit(req.currentUser!, {
        objectType: 'entry', objectId: entryId, objectLabel: `${code} ${c.topic}`,
        action: '起草新条目（反馈修订）', category: 'review', field: '状态', before: '—', after: 'pending_review',
        note: c.signal_note,
      });
    }
    await query(`UPDATE revision_candidates SET disposition='suggested' WHERE id=$1`, [id]);
    return { ok: true };
  });

  /** 视图⑨ 操作日志：可见范围按角色 */
  app.get('/api/audit/logs', { preHandler: requireLogin }, async (req) => {
    const { category } = req.query as { category?: string };
    const user = req.currentUser!;
    const canAll = user.permissions.includes('audit.viewAll');
    const where: string[] = [];
    const params: unknown[] = [];
    if (!canAll) {
      params.push(user.id);
      where.push(`actor_id = $${params.length}`);
    }
    if (category && category !== 'all') {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    const { rows } = await query<{
      id: string; at: Date; actor_name: string; actor_role: string; object_label: string; action: string;
      category: string; field: string | null; before_value: string | null; after_value: string | null; note: string | null;
    }>(
      `SELECT * FROM audit_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY at DESC LIMIT 300`,
      params,
    );
    return {
      scope: canAll ? 'all' : 'self',
      appendOnlyNote: zhCN.audit.appendOnly,
      rows: rows.map((l) => ({
        id: l.id, at: l.at.toISOString(), actorName: l.actor_name, actorRole: l.actor_role,
        objectLabel: l.object_label, action: l.action, category: l.category,
        field: l.field, before: l.before_value, after: l.after_value, note: l.note,
      })),
    };
  });

  /** 视图① 我的工作台 */
  app.get('/api/workbench', { preHandler: requireLogin }, async (req) => {
    const user = req.currentUser!;
    const canReview = user.permissions.includes('review.decide');
    const { rows: mine } = await query<{
      id: string; code: string; title: string; status: string; en_status: string; updated_at: Date;
      chapter: string; parent: string | null; library: string; reject_reason: string | null; submitter_id: string | null;
    }>(
      `SELECT e.id, e.code, e.title, e.status, e.en_status, e.updated_at, c.name AS chapter, pc.name AS parent,
              l.name AS library, e.reject_reason, e.submitter_id
       FROM entries e JOIN chapters c ON c.id=e.chapter_id LEFT JOIN chapters pc ON pc.id=c.parent_id
       JOIN libraries l ON l.id=e.library_id
       WHERE e.owner_id=$1 OR e.submitter_id=$1 OR e.status IN ('pending_review','reviewing')
       ORDER BY e.updated_at DESC`,
      [user.id],
    );
    const drafts = mine.filter((e) => e.status === 'draft' || e.status === 'editing');
    const submitted = mine.filter((e) => e.submitter_id === user.id && ['pending_review', 'reviewing'].includes(e.status));
    const rejected = mine.filter((e) => e.status === 'rejected' && e.submitter_id === user.id);
    const toReview = canReview ? mine.filter((e) => ['pending_review', 'reviewing'].includes(e.status)) : [];
    const shape = (e: (typeof mine)[number]) => ({
      id: e.id, code: e.code, title: e.title, status: e.status, enStatus: e.en_status,
      path: `${e.library} / ${e.parent ? `${e.parent} / ` : ''}${e.chapter}`,
      updatedAt: e.updated_at.toISOString(),
      rejectReason: e.reject_reason,
      nextAction:
        e.status === 'draft' || e.status === 'editing'
          ? '继续编辑'
          : e.status === 'rejected'
            ? '按意见修改'
            : canReview
              ? '去审核'
              : '查看进度',
      selfSubmitted: e.submitter_id === user.id,
    });
    return {
      canReview,
      cards: {
        drafts: drafts.length,
        submitted: submitted.length,
        rejected: rejected.length,
        toReview: canReview ? toReview.length : null,
      },
      groups: {
        drafts: drafts.map(shape),
        submitted: submitted.map(shape),
        rejected: rejected.map(shape),
        toReview: toReview.map(shape),
      },
      emptyHint: canReview ? null : '当前角色没有待审任务（审核权限仅知识审核员）',
    };
  });

  /** 导航徽标计数 */
  app.get('/api/nav/counts', { preHandler: requireLogin }, async () => {
    const [{ rows: kb }, { rows: review }, { rows: sync }, { rows: mine }, { rows: fb }] = await Promise.all([
      query<{ n: string }>('SELECT COUNT(*)::text AS n FROM entries'),
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM entries WHERE status IN ('pending_review','reviewing')`),
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM sync_tasks WHERE status IN ('failed','blocked')`),
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM mining_candidates WHERE disposition='pending'`),
      query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM revision_candidates WHERE disposition='pending'`),
    ]);
    return {
      kb: Number(kb[0]!.n),
      review: Number(review[0]!.n),
      sync: Number(sync[0]!.n),
      mine: Number(mine[0]!.n),
      feedback: Number(fb[0]!.n),
    };
  });
}
