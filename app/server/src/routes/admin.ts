import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  PERMISSION_MATRIX_ROWS,
  ROLE_LABELS,
  createUserSchema,
  grantReviewSchema,
  toggleUserSchema,
  updateMatrixSchema,
  updateUserSchema,
} from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { requirePermission, invalidateMatrixCache, getMatrix } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { destroyUserSessions, hashPassword } from '../core/auth.js';
import { fmtShort } from '../core/fmt.js';
import { actorOf, DomainError } from '../services/entries.js';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: requirePermission('admin.manage') };

  app.get('/api/admin/users', guard, async () => {
    const { rows } = await query<{
      id: string;
      name: string;
      email: string;
      role: 'super' | 'ops';
      department: string;
      review_granted: boolean;
      enabled: boolean;
      last_active_at: Date | null;
    }>(`SELECT id, name, email, role, department, review_granted, enabled, last_active_at
        FROM users ORDER BY CASE role WHEN 'super' THEN 0 ELSE 1 END, created_at`);
    return {
      users: rows.map((r, i) => ({
        id: r.id,
        uid: `UID-${1001 + i}`,
        name: r.name,
        email: r.email,
        department: r.department,
        role: r.role,
        roleLabel: r.role === 'super' ? ROLE_LABELS.super : r.review_granted ? '知识运营 · 审核' : '知识运营',
        reviewGranted: r.review_granted,
        enabled: r.enabled,
        lastActive: fmtShort(r.last_active_at),
        status: r.enabled ? '正常' : '已停用',
      })),
    };
  });

  app.post('/api/admin/users', guard, async (req) => {
    const body = createUserSchema.parse(req.body);
    const { rows: dup } = await query('SELECT 1 FROM users WHERE email=$1', [body.email]);
    if (dup.length) throw new DomainError('该邮箱已存在账号。', 409);
    const id = newId('usr');
    const initial = randomBytes(9).toString('base64url');
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, department, review_granted, enabled, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE)`,
      [id, body.name, body.email, await hashPassword(initial), body.role, body.department, body.reviewGranted],
    );
    await writeAudit(actorOf(req.currentUser!), {
      action: '新增用户',
      objectType: 'user',
      objectCode: body.email,
      objectLabel: `${body.name}（${body.role === 'super' ? '超级管理员' : '知识运营'}）`,
    });
    // 初始密码只在本次响应里出现一次，不落库明文
    return { id, initialPassword: initial };
  });

  app.put('/api/admin/users/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = updateUserSchema.parse(req.body);
    const { rows } = await query<{ name: string }>(
      'UPDATE users SET name=$2, department=$3, role=$4 WHERE id=$1 RETURNING name',
      [id, body.name, body.department, body.role],
    );
    if (!rows[0]) throw new DomainError('用户不存在', 404);
    await writeAudit(actorOf(req.currentUser!), {
      action: '编辑用户',
      objectType: 'user',
      objectCode: id,
      objectLabel: `${body.name}（${body.role === 'super' ? '超级管理员' : '知识运营'} · ${body.department}）`,
    });
    return { ok: true };
  });

  app.post('/api/admin/users/:id/toggle', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = toggleUserSchema.parse(req.body);
    const { rows } = await query<{ name: string }>(
      'UPDATE users SET enabled=$2 WHERE id=$1 RETURNING name',
      [id, body.enabled],
    );
    if (!rows[0]) throw new DomainError('用户不存在', 404);
    if (!body.enabled) await destroyUserSessions(id);
    await writeAudit(actorOf(req.currentUser!), {
      action: body.enabled ? '启用账号' : '停用账号',
      objectType: 'user',
      objectCode: id,
      objectLabel: rows[0].name,
    });
    return { ok: true };
  });

  app.post('/api/admin/users/:id/review-grant', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = grantReviewSchema.parse(req.body);
    const { rows } = await query<{ name: string }>(
      'UPDATE users SET review_granted=$2 WHERE id=$1 RETURNING name',
      [id, body.granted],
    );
    if (!rows[0]) throw new DomainError('用户不存在', 404);
    await writeAudit(actorOf(req.currentUser!), {
      action: body.granted ? '授予审核权限' : '收回审核权限',
      objectType: 'user',
      objectCode: id,
      objectLabel: rows[0].name,
    });
    return { ok: true };
  });

  app.get('/api/admin/permissions', guard, async () => {
    const matrix = await getMatrix();
    return {
      rows: PERMISSION_MATRIX_ROWS.map((r, i) => ({
        ...r,
        index: String(i + 1).padStart(2, '0'),
        superAllowed: matrix[r.permission].super,
        opsAllowed: matrix[r.permission].ops,
      })),
    };
  });

  app.put('/api/admin/permissions', guard, async (req) => {
    const body = updateMatrixSchema.parse(req.body);
    await query(
      `INSERT INTO permission_matrix (permission, role, allowed) VALUES ($1,$2,$3)
       ON CONFLICT (permission, role) DO UPDATE SET allowed=EXCLUDED.allowed, updated_at=now()`,
      [body.permission, body.role, body.allowed],
    );
    invalidateMatrixCache();
    await writeAudit(actorOf(req.currentUser!), {
      action: '调整权限矩阵',
      objectType: 'permission',
      objectCode: body.permission,
      objectLabel: `${body.permission} · ${body.role} → ${body.allowed ? '允许' : '禁止'}`,
    });
    return { ok: true };
  });

  app.get('/api/admin/audit', guard, async (req) => {
    const limit = Number((req.query as { limit?: string }).limit ?? 200);
    const { rows } = await query<{
      id: string;
      at: Date;
      actor_name: string;
      action: string;
      object_label: string;
      object_code: string | null;
      result: string;
      version: string | null;
      detail: string | null;
      actor_role: string;
    }>(`SELECT * FROM audit_logs ORDER BY at DESC LIMIT $1`, [limit]);
    return {
      logs: rows.map((r, i) => ({
        id: r.id,
        no: `#${90000 + rows.length - i}`,
        at: fmtShort(r.at),
        who: r.actor_name,
        role: r.actor_role,
        act: r.action,
        obj: r.object_label,
        objCode: r.object_code,
        result: r.result,
        version: r.version,
        detail: r.detail,
      })),
    };
  });

}
