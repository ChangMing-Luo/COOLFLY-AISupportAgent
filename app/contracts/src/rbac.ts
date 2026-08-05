import { z } from 'zod';

/** RBAC 四角色（PRD §2.1 / §5.10 视图⑩） */
export const ROLES = ['kb_manager', 'kb_reviewer', 'ai_ops', 'sys_admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  kb_manager: '知识管理员',
  kb_reviewer: '知识审核员',
  ai_ops: 'AI 运营',
  sys_admin: '系统管理员',
};

export const ROLE_NOTES: Record<Role, string> = {
  kb_manager: '知识生产得出：录入/编辑/结构维护/处置挖掘候选/提交审核；不能审核通过、不能发布、不能回滚',
  kb_reviewer: '守住质量线：审核、发布、同步、回滚的唯一执行者；四眼原则——自己提交的条目须另一名审核员通过',
  ai_ops: '只读 + 建议：编辑器只读，禁止审核/发布/回滚/同步；可查看数据并提交优化建议',
  sys_admin: '管人不管内容：仅用户与权限 + 审计日志；不参与知识内容审核发布',
};

/** 10 项权限点（PRD §5.10 权限矩阵唯一落点） */
export const PERMISSIONS = [
  'entry.write',
  'entry.submit',
  'review.decide',
  'publish',
  'version.rollback',
  'structure.manage',
  'metrics.view',
  'suggestion.submit',
  'rbac.manage',
  'audit.viewAll',
] as const;
export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  'entry.write': '新建 / 编辑知识条目',
  'entry.submit': '提交审核',
  'review.decide': '审核通过 / 驳回',
  publish: '发布到 Zendesk',
  'version.rollback': '版本回滚',
  'structure.manage': '管理目录与章节',
  'metrics.view': '查看效果与缺口数据',
  'suggestion.submit': '提交优化建议',
  'rbac.manage': '用户与角色管理',
  'audit.viewAll': '查看全量审计日志',
};

/** 权限矩阵默认值（10 项 × 4 角色，PRD §5.10 / 页面 MD §6.2） */
export const DEFAULT_PERMISSION_MATRIX: Record<Permission, Record<Role, boolean>> = {
  'entry.write': { kb_manager: true, kb_reviewer: true, ai_ops: false, sys_admin: false },
  'entry.submit': { kb_manager: true, kb_reviewer: true, ai_ops: false, sys_admin: false },
  'review.decide': { kb_manager: false, kb_reviewer: true, ai_ops: false, sys_admin: false },
  publish: { kb_manager: false, kb_reviewer: true, ai_ops: false, sys_admin: false },
  'version.rollback': { kb_manager: false, kb_reviewer: true, ai_ops: false, sys_admin: false },
  'structure.manage': { kb_manager: true, kb_reviewer: true, ai_ops: false, sys_admin: false },
  'metrics.view': { kb_manager: true, kb_reviewer: true, ai_ops: true, sys_admin: true },
  'suggestion.submit': { kb_manager: true, kb_reviewer: true, ai_ops: true, sys_admin: false },
  'rbac.manage': { kb_manager: false, kb_reviewer: false, ai_ops: false, sys_admin: true },
  'audit.viewAll': { kb_manager: false, kb_reviewer: true, ai_ops: false, sys_admin: true },
};

/** 越权拒绝文案（界面与接口共用同一 key，PRD §5.10 文案定稿） */
export const PERMISSION_DENIED_TEXT: Record<Permission, string> = {
  'entry.write': '当前角色对编辑器只读，无法修改内容。',
  'entry.submit': '当前角色不可提交审核，可改为提交优化建议。',
  'review.decide': '审核权限仅知识审核员。',
  publish: '发布权限仅知识审核员——统一过审铁律：任何角色无绕过审核的发布路径。',
  'version.rollback': '版本回滚仅知识审核员可执行。',
  'structure.manage': '目录与章节管理权限仅知识管理员与知识审核员。',
  'metrics.view': '当前角色无查看效果与缺口数据权限。',
  'suggestion.submit': '当前角色不可提交优化建议（系统管理员管人不管内容）。',
  'rbac.manage': '权限矩阵仅系统管理员可修改。',
  'audit.viewAll': '全量审计日志仅知识审核员与系统管理员可查。',
};

