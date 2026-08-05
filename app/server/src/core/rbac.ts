import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  DEFAULT_PERMISSION_MATRIX,
  PERMISSION_DENIED_TEXT,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from '@kb/contracts';
import { query } from '../db/pool.js';

type Matrix = Record<Permission, Record<Role, boolean>>;

let cache: Matrix | null = null;

/** 权限矩阵存库 + 进程内缓存，写时失效（技术方案 §4.2） */
export async function getMatrix(): Promise<Matrix> {
  if (cache) return cache;
  const { rows } = await query<{ permission: string; role: string; allowed: boolean }>(
    'SELECT permission, role, allowed FROM permission_matrix',
  );
  const next = structuredClone(DEFAULT_PERMISSION_MATRIX) as Matrix;
  for (const r of rows) {
    if (
      (PERMISSIONS as readonly string[]).includes(r.permission) &&
      (ROLES as readonly string[]).includes(r.role)
    ) {
      next[r.permission as Permission][r.role as Role] = r.allowed;
    }
  }
  cache = next;
  return next;
}

export function invalidateMatrixCache(): void {
  cache = null;
}

export async function roleHas(role: Role, permission: Permission): Promise<boolean> {
  const m = await getMatrix();
  return m[permission][role] === true;
}

/**
 * 审核权限是「单独授予」项（原型 admin.perms「审核（需授权）」）：
 * 矩阵给 ops 默认关，超管在用户页按人开 users.review_granted。
 */
export function hasPermission(
  matrix: Matrix,
  role: Role,
  reviewGranted: boolean,
  permission: Permission,
): boolean {
  if (permission === 'review.decide') return matrix[permission][role] === true || reviewGranted;
  return matrix[permission][role] === true;
}

export async function permissionsOf(role: Role, reviewGranted: boolean): Promise<Permission[]> {
  const m = await getMatrix();
  return PERMISSIONS.filter((p) => hasPermission(m, role, reviewGranted, p));
}

/** 写路由声明所需权限点；越权 403 带原因（接口层强制，不只前端禁用 —— RULE-01） */
export function requirePermission(permission: Permission) {
  return async function preHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = req.currentUser;
    if (!user) {
      await reply.code(401).send({ error: 'unauthorized', message: '未登录或会话已失效' });
      return;
    }
    const ok = hasPermission(await getMatrix(), user.role, user.reviewGranted, permission);
    if (!ok) {
      await reply.code(403).send({
        error: 'forbidden',
        permission,
        message: PERMISSION_DENIED_TEXT[permission],
      });
    }
  };
}
