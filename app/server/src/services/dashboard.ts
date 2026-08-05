import type { SessionUser } from '@kb/contracts';
import { query } from '../db/pool.js';
import { fmtShort, fmtToday, greetingOf } from '../core/fmt.js';
import { getZendesk } from '../integrations/zendesk.js';
import { listEntries, toDto, type EntryDto } from './entries.js';
import { listFeedbacks } from './feedback.js';

export interface AuditDto {
  at: string;
  who: string;
  act: string;
  obj: string;
  result: string;
  version: string | null;
}

export async function recentAudit(limit = 6): Promise<AuditDto[]> {
  const { rows } = await query<{
    at: Date;
    actor_name: string;
    action: string;
    object_label: string;
    result: string;
    version: string | null;
  }>(`SELECT at, actor_name, action, object_label, result, version FROM audit_logs ORDER BY at DESC LIMIT $1`, [
    limit,
  ]);
  return rows.map((r) => ({
    at: fmtShort(r.at),
    who: r.actor_name,
    act: r.action,
    obj: r.object_label,
    result: r.result,
    version: r.version,
  }));
}

export interface DashboardDto {
  today: string;
  greeting: string;
  kpis: Array<{ label: string; value: number; delta: string }>;
  todos: Array<{
    step: string;
    title: string;
    meta: string;
    tagClass: string;
    tagText: string;
    cta: string;
    kind: 'review' | 'feedback' | 'draft';
    code: string;
  }>;
  lifecycle: Array<{ label: string; n: number; route: string }>;
  zendesk: Array<{ k: string; v: string; accent: boolean }>;
  recent: AuditDto[];
  stat: { total: number; publishedToday: number; todo: number };
}

export async function dashboard(user: SessionUser): Promise<DashboardDto> {
  const all = (await listEntries('')).map(toDto);
  const pending = all.filter((d) => d.status === 'pending');
  const drafts = all.filter((d) => d.status === 'draft' || d.status === 'rejected');
  const rejected = drafts.filter((d) => d.status === 'rejected');
  const syncFailed = all.filter((d) => d.syncStatus === 'failed');
  const feedbacks = await listFeedbacks();
  const openFb = feedbacks.filter((f) => f.state === 'open');

  const { rows: missRows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM misses WHERE state='open'`,
  );
  const openMiss = Number(missRows[0].n);
  const { rows: candRows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM extract_candidates WHERE disposition='pending'`,
  );
  const { rows: todayRows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM entries WHERE published_at::date = (now() AT TIME ZONE 'Asia/Shanghai')::date`,
  );
  const { rows: pullRows } = await query<{ at: Date | null }>(
    `SELECT MAX(at) AS at FROM audit_logs WHERE action='Zendesk 拉取'`,
  );

  const rollbackCount = pending.filter((d) => d.pendingKind === 'rollback').length;

  const todos: DashboardDto['todos'] = [];
  for (const d of pending.slice(0, 2)) {
    todos.push({
      step: '审核',
      title: d.titleZh,
      meta: `${d.code} · ${d.ownerName} 提交 · ${d.updatedAt}`,
      tagClass: 'tag-outline',
      tagText: '待审核',
      cta: '审核',
      kind: 'review',
      code: d.code,
    });
  }
  for (const f of openFb.slice(0, 2)) {
    todos.push({
      step: '反馈',
      title: f.text,
      meta: `${f.code} · ${f.entryCode} · Zendesk ${f.conversation} · ${f.at}`,
      tagClass: 'tag-neutral',
      tagText: f.type,
      cta: '去修复',
      kind: 'feedback',
      code: f.code,
    });
  }
  for (const d of rejected.slice(0, 1)) {
    todos.push({
      step: '草稿',
      title: d.titleZh,
      meta: `${d.code} · 被驳回：${d.rejectReason ?? '未填写意见'}`,
      tagClass: 'tag-neutral',
      tagText: '已驳回',
      cta: '修改',
      kind: 'draft',
      code: d.code,
    });
  }

  const zd = getZendesk();
  return {
    today: fmtToday(),
    greeting: greetingOf(user.name),
    kpis: [
      {
        label: '待我审核',
        value: pending.length,
        delta: rollbackCount ? `其中 ${rollbackCount} 条为回滚审核` : '全部为内容审核',
      },
      { label: '我的草稿', value: drafts.length, delta: rejected.length ? `含 ${rejected.length} 条被驳回` : '无被驳回' },
      { label: '待处理反馈', value: openFb.length, delta: '来自 Zendesk 客诉' },
      {
        label: 'Zendesk 同步失败',
        value: syncFailed.length,
        delta: syncFailed.length ? (syncFailed[0].syncFailReason ?? '需补英文字段') : '全部正常',
      },
      { label: '未命中问题', value: openMiss, delta: '可建采集任务' },
    ],
    todos,
    lifecycle: [
      { label: '采集', n: Number(candRows[0].n), route: 'collect.extract' },
      { label: '草稿', n: drafts.length, route: 'author.drafts' },
      { label: '待审', n: pending.length, route: 'review.queue' },
      { label: '已发布', n: all.filter((d) => d.status === 'published').length, route: 'kb.list' },
      { label: '同步', n: all.filter((d) => d.syncStatus === 'synced').length, route: 'publish.channels' },
      { label: '反馈', n: feedbacks.length, route: 'feedback.list' },
    ],
    zendesk: [
      { k: '实例', v: process.env.ZENDESK_SUBDOMAIN ? `${process.env.ZENDESK_SUBDOMAIN}.zendesk.com` : '沙箱实例', accent: false },
      { k: '连接模式', v: zd.mode === 'live' ? '真实实例' : '沙箱', accent: zd.mode !== 'live' },
      { k: '上次拉取', v: pullRows[0].at ? fmtShort(pullRows[0].at) : '尚未拉取', accent: false },
      { k: '待同步知识', v: String(all.filter((d) => d.syncStatus === 'pending').length), accent: false },
      { k: '同步失败', v: String(syncFailed.length), accent: syncFailed.length > 0 },
    ],
    recent: await recentAudit(6),
    stat: {
      total: all.length,
      publishedToday: Number(todayRows[0].n),
      todo: pending.length + openFb.length + openMiss,
    },
  };
}

/** 顶栏全局搜索：标题 / 知识 ID / 场景 / 分类，最多 6 条 */
export async function search(q: string): Promise<Array<{ code: string; title: string; meta: string }>> {
  const like = `%${q}%`;
  const rows = await listEntries(
    `WHERE e.title_zh ILIKE $1 OR e.code ILIKE $1 OR s.name_zh ILIKE $1 OR c.name_zh ILIKE $1
     ORDER BY e.updated_at DESC LIMIT 6`,
    [like],
  );
  return rows.map((r) => {
    const d = toDto(r);
    return {
      code: d.code,
      title: d.titleZh,
      meta: `${d.code} · ${d.sceneZh || '未设置场景'} · ${d.statusLabel}`,
    };
  });
}

export type { EntryDto };
