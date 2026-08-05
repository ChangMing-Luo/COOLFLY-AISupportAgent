import { z } from 'zod';

/* ══════════ 条目六态（原型 prototype.logic.js:21-25，文案逐字一致） ══════════ */

export const ENTRY_STATUSES = ['draft', 'pending', 'rejected', 'published', 'fixing', 'offline'] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

export interface StatusMeta {
  /** 短标签，列表与徽标用 */
  label: string;
  /** tokens.css 的 tag 类 */
  tagClass: 'tag-neutral' | 'tag-outline' | 'tag-accent' | 'tag-accent-2';
  /** 人话说明，详情页「状态：」后面那句 */
  readable: string;
}

export const ENTRY_STATUS_META: Record<EntryStatus, StatusMeta> = {
  draft: { label: '草稿', tagClass: 'tag-neutral', readable: '草稿 · 编辑中，尚未提交审核' },
  pending: { label: '待审核', tagClass: 'tag-outline', readable: '待审核 · 已提交，排队等待审核' },
  rejected: { label: '已驳回', tagClass: 'tag-neutral', readable: '已驳回 · 审核未通过，退回修改' },
  published: { label: '已发布', tagClass: 'tag-accent', readable: '已发布 · 线上生效，已同步 Zendesk' },
  fixing: { label: '修复中', tagClass: 'tag-accent-2', readable: '修复中 · 正在根据反馈修订' },
  offline: { label: '已下线', tagClass: 'tag-neutral', readable: '已下线 · 已撤回，不再对客展示' },
};

/** 合法流转表（SPEC-v4 §2.3）。键 = 起点，值 = 允许到达的状态 */
export const ENTRY_TRANSITIONS: Record<EntryStatus, EntryStatus[]> = {
  draft: ['draft', 'pending'],
  pending: ['published', 'rejected'],
  rejected: ['rejected', 'draft', 'pending'],
  published: ['draft', 'fixing', 'offline', 'pending'],
  fixing: ['fixing', 'draft', 'pending'],
  offline: ['draft'],
};

export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
  return ENTRY_TRANSITIONS[from].includes(to);
}

/* ══════════ 同步四态 ══════════ */

export const SYNC_STATUSES = ['none', 'pending', 'synced', 'failed'] as const;
export const syncStatusSchema = z.enum(SYNC_STATUSES);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const SYNC_STATUS_META: Record<SyncStatus, { label: string; tagClass: string }> = {
  none: { label: '未同步', tagClass: 'tag-neutral' },
  pending: { label: '同步中', tagClass: 'tag-accent-2' },
  synced: { label: '已同步', tagClass: 'tag-accent' },
  failed: { label: '同步失败', tagClass: 'tag-neutral' },
};

/* ══════════ 其余枚举 ══════════ */

export const FEEDBACK_TYPES = ['差评', '信息有误', '无法解决'] as const;
export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

export const FEEDBACK_STATES = ['open', 'fixing', 'closed'] as const;
export const feedbackStateSchema = z.enum(FEEDBACK_STATES);
export type FeedbackState = z.infer<typeof feedbackStateSchema>;
export const FEEDBACK_STATE_LABELS: Record<FeedbackState, string> = {
  open: '未处理',
  fixing: '修复中',
  closed: '已关闭',
};

export const MISS_STATES = ['open', 'planned'] as const;
export const missStateSchema = z.enum(MISS_STATES);
export type MissState = z.infer<typeof missStateSchema>;
export const MISS_STATE_LABELS: Record<MissState, string> = { open: '待处理', planned: '已排期' };

export const COLLECT_TASK_STATES = ['ready', 'running', 'done', 'failed'] as const;
export type CollectTaskState = (typeof COLLECT_TASK_STATES)[number];

export const CANDIDATE_DISPOSITIONS = ['pending', 'accepted', 'dropped'] as const;
export type CandidateDisposition = (typeof CANDIDATE_DISPOSITIONS)[number];

export const TAG_TYPES = ['业务', '属性', '动作', '人群'] as const;
export const tagTypeSchema = z.enum(TAG_TYPES);
export type TagType = z.infer<typeof tagTypeSchema>;

export const VERSION_ACTS = ['发布', '回滚', '创建'] as const;
export type VersionAct = (typeof VERSION_ACTS)[number];
/** 版本列表的动作显示名（原型 dtVals：发布 → 发布上线） */
export const VERSION_ACT_LABELS: Record<VersionAct, string> = {
  发布: '发布上线',
  回滚: '版本回滚',
  创建: '新建条目',
};

/* ══════════ 版本号 ══════════ */

/** 大版本 +1（审核通过发布）或小版本 +1（创建修订 / 反馈转修复） */
export function bumpVersion(current: string, major: boolean): string {
  const m = /v(\d+)\.(\d+)/.exec(current);
  const maj = m ? Number(m[1]) : 0;
  const min = m ? Number(m[2]) : 1;
  return major ? `v${maj + 1}.0` : `v${maj}.${min + 1}`;
}

export function priorVersion(current: string): string {
  const m = /v(\d+)\.(\d+)/.exec(current);
  const maj = m ? Number(m[1]) : 0;
  const min = m ? Number(m[2]) : 1;
  return min > 0 ? `v${maj}.${min - 1}` : `v${Math.max(0, maj - 1)}.0`;
}

/* ══════════ 会话用户 ══════════ */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'super' | 'ops';
  roleLabel: string;
  department: string;
  /** 审核权限是否被单独授予（ops 需要，super 恒 true） */
  reviewGranted: boolean;
  mustChangePassword: boolean;
  permissions: string[];
}
