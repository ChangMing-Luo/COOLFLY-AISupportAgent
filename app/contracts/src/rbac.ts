import { z } from 'zod';

/** v4 两角色（SPEC-v4 §1，原型 admin.users / admin.perms） */
export const ROLES = ['super', 'ops'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  super: '超级管理员',
  ops: '知识运营',
};

export const ROLE_NOTES: Record<Role, string> = {
  super: '可配置系统与权限，可见全部模块；删除、Zendesk 配置、日志导出仅超管。',
  ops: '负责采集、编辑、审核与反馈处理；系统管理不可见（403 拦截）。审核权限单独授予。',
};

/** 权限点：与原型「权限矩阵」页九个模块一一对应，外加审核这一单独授予项 */
export const PERMISSIONS = [
  'collect.manage',
  'entry.write',
  'review.decide',
  'review.auto',
  'kb.offline',
  'sync.run',
  'feedback.handle',
  'meta.manage',
  'analytics.view',
  'admin.manage',
] as const;
export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  'collect.manage': '处置抽取候选',
  'entry.write': '新建 / 编辑知识',
  'review.decide': '审核通过 / 驳回',
  'review.auto': '自动过审（提交即生效）',
  'kb.offline': '下线 / 恢复知识',
  'sync.run': '同步 / 重试',
  'feedback.handle': '处理反馈与未命中',
  'meta.manage': '维护分类 / 场景 / 标签',
  'analytics.view': '查看数据分析',
  'admin.manage': '用户、权限与审计',
};

/**
 * 权限矩阵默认值。
 * `review.decide` 对 ops 默认 **false**——原型 admin.perms 明写「审核（需授权）· 审核权限单独授予」，
 * 由超管在权限矩阵页按人开启（users.review_granted）。
 */
export const DEFAULT_PERMISSION_MATRIX: Record<Permission, Record<Role, boolean>> = {
  'collect.manage': { super: true, ops: true },
  'entry.write': { super: true, ops: true },
  'review.decide': { super: true, ops: false },
  // 自动过审默认只给超管：提交即批准并同步 Zendesk，但仍完整落审核记录与审计
  'review.auto': { super: true, ops: false },
  'kb.offline': { super: true, ops: true },
  'sync.run': { super: true, ops: true },
  'feedback.handle': { super: true, ops: true },
  'meta.manage': { super: true, ops: true },
  'analytics.view': { super: true, ops: true },
  'admin.manage': { super: true, ops: false },
};

export const PERMISSION_DENIED_TEXT: Record<Permission, string> = {
  'collect.manage': '当前角色不可处置抽取候选。',
  'entry.write': '当前角色对编辑器只读，无法修改内容。',
  'review.decide': '审核权限需单独授予，请联系超级管理员在权限矩阵中开启。',
  'review.auto': '自动过审权限未开启，提交后需等待审核。',
  'kb.offline': '下线与恢复权限未开启。',
  'sync.run': '当前角色不可触发 Zendesk 同步。',
  'feedback.handle': '当前角色不可处理反馈与未命中问题。',
  'meta.manage': '分类、场景与标签维护权限未开启。',
  'analytics.view': '当前角色无查看数据分析权限。',
  'admin.manage': '该模块仅超级管理员可见。',
};

/** 权限矩阵页九行（原型 admin.perms 行文案，逐字一致） */
export const PERMISSION_MATRIX_ROWS: Array<{
  module: string;
  permission: Permission;
  super: string;
  ops: string;
  note: string;
}> = [
  { module: '知识采集', permission: 'collect.manage', super: '全部', ops: '全部', note: '两角色一致' },
  { module: '知识编辑', permission: 'entry.write', super: '全部', ops: '全部', note: '仅本人草稿可删' },
  { module: '审核中心', permission: 'review.decide', super: '全部', ops: '审核（需授权）', note: '审核权限单独授予' },
  { module: '自动过审', permission: 'review.auto', super: '全部', ops: '不可用', note: '提交即生效，仍留审核记录' },
  { module: '知识库', permission: 'kb.offline', super: '全部', ops: '查看 / 编辑 / 下线', note: '删除仅超管' },
  { module: '发布与同步', permission: 'sync.run', super: '全部', ops: '同步 / 重试', note: 'Zendesk 配置仅超管' },
  { module: '反馈回流', permission: 'feedback.handle', super: '全部', ops: '全部', note: '两角色一致' },
  { module: '元数据中心', permission: 'meta.manage', super: '全部', ops: '新增 / 编辑 / 翻译', note: '删除仅超管' },
  { module: '数据分析', permission: 'analytics.view', super: '全部', ops: '查看', note: '导出仅超管' },
  { module: '系统管理', permission: 'admin.manage', super: '全部', ops: '不可见', note: '403 拦截' },
];
