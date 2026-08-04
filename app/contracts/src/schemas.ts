import { z } from 'zod';
import { roleSchema, permissionSchema } from './rbac.js';
import {
  entryStatusSchema,
  enStatusSchema,
  syncStatusSchema,
  vectorStatusSchema,
  visibilitySchema,
  reviewSourceSchema,
  batchStatusSchema,
  candidateTypeSchema,
  signalCertaintySchema,
  versionStatusSchema,
} from './states.js';

/** 建议值参数（PRD §5.10 边界数值，可配置，终稿前确认） */
export const TUNABLES = {
  dedupeThreshold: 0.85,
  frequencyThreshold: 10,
  syncRetryLimit: 3,
  translateFailAlert: 3,
  reviewCycleDays: 180,
  reviewDueSoonDays: 30,
  rollbackAdviceDropPp: 15,
  sampleFloor: 10,
  lowSolveRatePct: 60,
  driftScanCron: '0 * * * *',
  maxLabels: 20,
  importMaxRows: 500,
} as const;

/** 段落节点：内部段落带 internal 标记，同步与翻译按标记剥离 */
export const paragraphSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  internal: z.boolean().default(false),
  heading: z.boolean().default(false),
});
export type Paragraph = z.infer<typeof paragraphSchema>;

export const entryBodySchema = z.object({
  paragraphs: z.array(paragraphSchema).min(1),
});
export type EntryBody = z.infer<typeof entryBodySchema>;

export const entryFieldsSchema = z.object({
  title: z.string().min(1, '标题必填'),
  libraryId: z.string().min(1, '所属知识库必填'),
  chapterId: z.string().min(1, '所属章节必填'),
  entryType: z.string().min(1),
  visibility: visibilitySchema,
  sceneL1: z.string().min(1, '一级问题场景必填'),
  sceneL2: z.string().min(1, '二级问题场景必填'),
  labels: z.array(z.string()).max(TUNABLES.maxLabels, `标签最多 ${TUNABLES.maxLabels} 个`),
  deviceModels: z.array(z.string()).default([]),
  reviewCycleDays: z.number().int().positive().default(TUNABLES.reviewCycleDays),
  ownerId: z.string().nullable().default(null),
});
export type EntryFields = z.infer<typeof entryFieldsSchema>;

export const entryUpsertSchema = entryFieldsSchema.extend({
  body: entryBodySchema,
  expectedVersion: z.number().int().nonnegative().optional(),
});
export type EntryUpsert = z.infer<typeof entryUpsertSchema>;

export const entryRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  path: z.string(),
  entryType: z.string(),
  visibility: visibilitySchema,
  versionLabel: z.string(),
  status: entryStatusSchema,
  enStatus: enStatusSchema,
  syncStatus: syncStatusSchema,
  vectorStatus: vectorStatusSchema,
  solveRate: z.number().nullable(),
  sampleShort: z.boolean(),
  reviewDueAt: z.string().nullable(),
  reviewDueLevel: z.enum(['ok', 'warn', 'bad']),
  updatedAt: z.string(),
  libraryId: z.string(),
  chapterId: z.string(),
  sceneL1: z.string(),
  sceneL2: z.string(),
  labels: z.array(z.string()),
  lockVersion: z.number().int(),
});
export type EntryRow = z.infer<typeof entryRowSchema>;

export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码必填'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码必填'),
  newPassword: z.string().min(8, '新密码至少 8 位'),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: roleSchema,
  libraryScope: z.array(z.string()),
  mustChangePassword: z.boolean(),
  permissions: z.array(permissionSchema),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, '驳回理由必填——审核意见会回传给提交人并留痕。'),
});

export const submitReviewSchema = z.object({
  source: reviewSourceSchema.default('manual'),
  note: z.string().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(1, '姓名必填'),
  email: z.string().email('邮箱格式不正确'),
  role: roleSchema,
  libraryScope: z.array(z.string()).min(1, '必须选择知识库范围'),
  initialPassword: z.string().min(8, '初始密码至少 8 位'),
});

export const matrixUpdateSchema = z.object({
  permission: permissionSchema,
  role: roleSchema,
  allowed: z.boolean(),
});

export const chapterUpsertSchema = z.object({
  libraryId: z.string().min(1),
  parentId: z.string().nullable(),
  name: z.string().min(1, '章节名称必填'),
  zendeskSectionRef: z.string().nullable().default(null),
});

export const driftResolveSchema = z.object({
  action: z.enum(['overwrite', 'pull_back']),
});

export const candidateActionSchema = z.object({
  action: z.enum(['draft', 'attach_revision', 'merge', 'discard', 'suggest']),
  note: z.string().optional(),
});

export const importRowSchema = z.object({
  title: z.string(),
  chapterName: z.string(),
  visibility: z.string(),
  sceneL1: z.string(),
  sceneL2: z.string(),
  body: z.string(),
});

export const gateResultSchema = z.object({
  passed: z.boolean(),
  checks: z.array(
    z.object({
      key: z.enum(['fields', 'internal', 'english', 'proxy_eval']),
      label: z.string(),
      passed: z.boolean(),
      detail: z.string(),
      hard: z.boolean(),
    }),
  ),
  proxyEvalNote: z.string(),
});
export type GateResult = z.infer<typeof gateResultSchema>;

export const auditRowSchema = z.object({
  id: z.string(),
  at: z.string(),
  actorName: z.string(),
  actorRole: roleSchema,
  objectLabel: z.string(),
  action: z.string(),
  category: z.enum(['content', 'review', 'admin']),
  field: z.string().nullable(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  note: z.string().nullable(),
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export const batchRowSchema = z.object({
  id: z.string(),
  batchDate: z.string(),
  emailCount: z.number().int(),
  chatCount: z.number().int(),
  candidateCount: z.number().int(),
  status: batchStatusSchema,
  failReason: z.string().nullable(),
});

export const candidateRowSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  type: candidateTypeSchema,
  title: z.string(),
  sourceSummary: z.string(),
  frequency: z.number().int(),
  dedupeScore: z.number(),
  gapVerdict: z.string(),
  aiSummary: z.string(),
  admissionNote: z.string(),
  targetEntryCode: z.string().nullable(),
  disposition: z.enum(['pending', 'drafted', 'attached', 'merged', 'discarded', 'suggested']),
});

export const signalRowSchema = z.object({
  id: z.string(),
  scene: z.string(),
  channel: z.string(),
  hitSignal: z.string(),
  solveSignal: z.string(),
  certainty: signalCertaintySchema,
});

export const versionRowSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  versionNo: z.number().int(),
  label: z.string(),
  status: versionStatusSchema,
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  authorName: z.string(),
  calls: z.number().int().nullable(),
  hitRate: z.number().nullable(),
  solveRate: z.number().nullable(),
  adoptRate: z.number().nullable(),
});

export const syncTaskRowSchema = z.object({
  id: z.string(),
  entryCode: z.string(),
  entryTitle: z.string(),
  versionLabel: z.string(),
  action: z.string(),
  target: z.string(),
  status: syncStatusSchema,
  languages: z.string(),
  retryCount: z.number().int(),
  failReason: z.string().nullable(),
  blockedReason: z.string().nullable(),
  updatedAt: z.string(),
});

export const driftRowSchema = z.object({
  id: z.string(),
  entryCode: z.string(),
  articleRef: z.string(),
  title: z.string(),
  changedBy: z.string(),
  diffSummary: z.string(),
  detectedAt: z.string(),
  resolvedAction: z.string().nullable(),
  resolvedBy: z.string().nullable(),
});
