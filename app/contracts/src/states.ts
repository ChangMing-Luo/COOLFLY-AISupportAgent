import { z } from 'zod';

/** 条目状态机（PRD §8.1 / 页面 MD §5.3 状态流转条） */
export const ENTRY_STATUSES = [
  'draft',
  'editing',
  'pending_review',
  'reviewing',
  'approved',
  'published',
  'rejected',
  'offline',
] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  draft: '草稿',
  editing: '编辑中',
  pending_review: '待审核',
  reviewing: '审核中',
  approved: '审核通过',
  published: '已发布',
  rejected: '已驳回',
  offline: '已下线',
};

/** 合法流转表——非法流转直接 409（技术方案 §4.2 状态机守卫） */
export const ENTRY_TRANSITIONS: Record<EntryStatus, EntryStatus[]> = {
  draft: ['draft', 'editing', 'pending_review'],
  editing: ['editing', 'draft', 'pending_review'],
  pending_review: ['reviewing', 'approved', 'rejected'],
  reviewing: ['approved', 'rejected', 'pending_review'],
  approved: ['published', 'editing'],
  published: ['editing', 'offline'],
  rejected: ['draft', 'editing', 'pending_review'],
  offline: ['editing'],
};

export function canTransitionEntry(from: EntryStatus, to: EntryStatus): boolean {
  return ENTRY_TRANSITIONS[from].includes(to);
}

/** 英文（翻译）状态机（PRD §5.10 翻译工作流；铁律：confirmed 前不可同步） */
export const EN_STATUSES = [
  'none',
  'translating',
  'pending_human',
  'confirmed',
  'synced',
  'failed',
  'stale',
] as const;
export const enStatusSchema = z.enum(EN_STATUSES);
export type EnStatus = z.infer<typeof enStatusSchema>;

export const EN_STATUS_LABELS: Record<EnStatus, string> = {
  none: '未生成',
  translating: 'AI 翻译中',
  pending_human: '待人工校验',
  confirmed: '已确认',
  synced: '已同步 Zendesk',
  failed: '翻译失败',
  stale: '待重新校验',
};

export const EN_TRANSITIONS: Record<EnStatus, EnStatus[]> = {
  none: ['translating'],
  translating: ['pending_human', 'failed'],
  pending_human: ['confirmed', 'translating', 'stale'],
  confirmed: ['synced', 'stale', 'translating'],
  synced: ['stale', 'translating'],
  failed: ['translating', 'stale'],
  stale: ['translating', 'pending_human'],
};

export function canTransitionEn(from: EnStatus, to: EnStatus): boolean {
  return EN_TRANSITIONS[from].includes(to);
}

/** 英文「已确认」及之后才允许同步——铁律，服务端强制 */
export function enAllowsSync(status: EnStatus): boolean {
  return status === 'confirmed' || status === 'synced';
}

/** 同步状态机（PRD §8.1；页面 MD §5.6 状态机说明） */
export const SYNC_STATUSES = [
  'none',
  'queued',
  'running',
  'synced',
  'failed',
  'blocked',
  'archived',
] as const;
export const syncStatusSchema = z.enum(SYNC_STATUSES);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  none: '未同步',
  queued: '待同步',
  running: '同步中',
  synced: '已同步',
  failed: '失败',
  blocked: '已阻断',
  archived: '已归档',
};

/** 可见性三档（PRD §4.1；内部段落不进对外文章、不翻译、不同步对外） */
export const VISIBILITIES = ['public', 'internal', 'mixed'] as const;
export const visibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof visibilitySchema>;

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: '对外公开',
  internal: '仅客服内部',
  mixed: '对外公开 + 内部段落',
};

/** 审核来源五类（PRD §5.10 视图⑤ 来源徽章） */
export const REVIEW_SOURCES = ['mining', 'manual', 'revision', 'feedback', 'import'] as const;
export const reviewSourceSchema = z.enum(REVIEW_SOURCES);
export type ReviewSource = z.infer<typeof reviewSourceSchema>;

export const REVIEW_SOURCE_LABELS: Record<ReviewSource, string> = {
  mining: 'AI 挖掘',
  manual: '人工录入',
  revision: '版本修订',
  feedback: '反馈修订',
  import: '批量导入',
};

/** 批次状态（PRD §5.10 视图④） */
export const BATCH_STATUSES = ['completed', 'empty', 'failed'] as const;
export const batchStatusSchema = z.enum(BATCH_STATUSES);
export type BatchStatus = z.infer<typeof batchStatusSchema>;

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  completed: '完成',
  empty: '无新草稿',
  failed: '失败',
};

/** 候选类型（三类：新增/修订/合并） */
export const CANDIDATE_TYPES = ['new', 'revision', 'merge'] as const;
export const candidateTypeSchema = z.enum(CANDIDATE_TYPES);
export type CandidateType = z.infer<typeof candidateTypeSchema>;

export const CANDIDATE_TYPE_LABELS: Record<CandidateType, string> = {
  new: '新增',
  revision: '修订',
  merge: '合并',
};

/** 信号确定性档位（PRD §4.3；待核实信号不进达标判定） */
export const SIGNAL_CERTAINTIES = ['certain', 'tier_dependent', 'unverified'] as const;
export const signalCertaintySchema = z.enum(SIGNAL_CERTAINTIES);
export type SignalCertainty = z.infer<typeof signalCertaintySchema>;

export const SIGNAL_CERTAINTY_LABELS: Record<SignalCertainty, string> = {
  certain: '原生 · 必得',
  tier_dependent: '档位相关',
  unverified: '待核实',
};

/** 版本状态 */
export const VERSION_STATUSES = ['current', 'history', 'rolled_back', 'pending'] as const;
export const versionStatusSchema = z.enum(VERSION_STATUSES);
export type VersionStatus = z.infer<typeof versionStatusSchema>;

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  current: '已发布',
  history: '历史版本',
  rolled_back: '已回滚',
  pending: '待审核',
};
