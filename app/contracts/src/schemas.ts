import { z } from 'zod';
import { feedbackTypeSchema, tagTypeSchema } from './states.js';

/** 可调参数（抽取阈值与查重阈值，抽取配置卡直接读它） */
export const TUNABLES = {
  /** 低于该置信度的候选不入库 */
  confidenceThreshold: 0.6,
  /** 查重相似度提示线 */
  dedupeThreshold: 0.85,
  /** 查重粗筛上限：至多把 N 条既有条目交 LLM 判定 */
  dedupeShortlist: 5,
  /** 质量告警：历史最佳版本采纳率高出当前版本 N 个百分点即告警 */
  rollbackAdvicePp: 15,
  /** 待修复判定：已发布且采纳率低于 N% */
  riskyAdoptPct: 45,
  /** 待修复判定：置信度低于 N */
  riskyConfidence: 0.72,
} as const;

/* ══════════ 认证 ══════════ */

export const loginSchema = z.object({
  email: z.string().email('请输入正确的邮箱'),
  password: z.string().min(1, '请输入密码'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(10, '新密码至少 10 位'),
});

/* ══════════ 条目 ══════════ */

export const entryListViewSchema = z.enum(['drafts', 'mine', 'queue', 'all', 'offline', 'sync']);
export type EntryListView = z.infer<typeof entryListViewSchema>;

export const createEntrySchema = z.object({
  titleZh: z.string().trim().min(1, '标题不能为空').default('未命名知识'),
  bodyZh: z.string().default(''),
  categoryId: z.string().optional(),
  sceneId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  source: z.string().optional(),
  /** 来源联动：采纳候选 / 未命中建条目 */
  fromCandidate: z.string().optional(),
  fromMiss: z.string().optional(),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const saveEntrySchema = z.object({
  titleZh: z.string().trim().min(1, '中文标题不能为空'),
  titleEn: z.string().default(''),
  bodyZh: z.string().default(''),
  bodyEn: z.string().default(''),
  categoryId: z.string().nullable().optional(),
  sceneId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().default(''),
  /** 英文是否经人工二次编辑（前端按内容变更判定后回传） */
  enEdited: z.boolean().optional(),
});
export type SaveEntryInput = z.infer<typeof saveEntrySchema>;

export const rejectSchema = z.object({
  comment: z.string().trim().min(1, '驳回必须说明原因，意见会回写到提交人的草稿'),
});

export const approveSchema = z.object({
  comment: z.string().default(''),
});

export const rollbackSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+$/, '版本号格式应为 vX.Y'),
});

/* ══════════ 元数据 ══════════ */

export const upsertCategorySchema = z.object({
  nameZh: z.string().trim().min(1, '中文名不能为空'),
  nameEn: z.string().trim().default(''),
});

export const upsertSceneSchema = z.object({
  nameZh: z.string().trim().min(1, '中文名不能为空'),
  nameEn: z.string().trim().default(''),
  categoryId: z.string().min(1, '必须归属一个一级分类'),
});

export const upsertTagSchema = z.object({
  name: z.string().trim().min(1, '标签名不能为空'),
  type: tagTypeSchema.default('业务'),
});

export const mergeTagSchema = z.object({
  targetId: z.string().min(1, '请选择目标标签'),
});

export const translateMetaSchema = z.object({
  text: z.string().trim().min(1, '请先填写中文名'),
  kind: z.enum(['分类', '场景']),
});

/* ══════════ 反馈 / 未命中 / 采集 ══════════ */

export const createFeedbackSchema = z.object({
  entryCode: z.string().min(1),
  type: feedbackTypeSchema,
  text: z.string().trim().min(1),
  conversation: z.string().trim().min(1),
});

/* ══════════ 管理 ══════════ */

export const toggleUserSchema = z.object({ enabled: z.boolean() });
export const grantReviewSchema = z.object({ granted: z.boolean() });

export const updateMatrixSchema = z.object({
  permission: z.string().min(1),
  role: z.enum(['super', 'ops']),
  allowed: z.boolean(),
});
