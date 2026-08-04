import type { FastifyInstance } from 'fastify';
import {
  createUserSchema,
  matrixUpdateSchema,
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_LABELS,
  ROLE_NOTES,
  type Permission,
  type Role,
} from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { destroyUserSessions, hashPassword, requireLogin } from '../core/auth.js';
import { getMatrix, invalidateMatrixCache, requirePermission } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { DomainError } from '../services/entries.js';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/rbac/users', { preHandler: [requireLogin, requirePermission('rbac.manage')] }, async () => {
    const { rows } = await query<{
      id: string; name: string; email: string; role: Role; library_scope: string[]; enabled: boolean; last_active_at: Date | null;
    }>('SELECT id, name, email, role, library_scope, enabled, last_active_at FROM users ORDER BY created_at'),
    { rows: libs } = await query<{ id: string; name: string }>('SELECT id, name FROM libraries ORDER BY sort_order');
    const libName = new Map(libs.map((l) => [l.id, l.name]));
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
      scopeLabel:
        u.library_scope.length === 0 || u.library_scope.length === libs.length
          ? '全部知识库'
          : u.library_scope.map((id) => libName.get(id) ?? id).join(' / '),
      enabled: u.enabled,
      lastActiveAt: u.last_active_at ? u.last_active_at.toISOString() : null,
    }));
  });

  app.get('/api/rbac/roles', { preHandler: requireLogin }, async () => {
    const matrix = await getMatrix();
    const { rows } = await query<{ role: Role; n: string }>('SELECT role, COUNT(*)::text AS n FROM users GROUP BY role');
    const counts = new Map(rows.map((r) => [r.role, Number(r.n)]));
    return ROLES.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      note: ROLE_NOTES[role],
      userCount: counts.get(role) ?? 0,
      allowed: PERMISSIONS.filter((p) => matrix[p][role]).map((p) => PERMISSION_LABELS[p]),
      denied: PERMISSIONS.filter((p) => !matrix[p][role]).map((p) => PERMISSION_LABELS[p]),
    }));
  });

  app.get('/api/rbac/matrix', { preHandler: requireLogin }, async () => {
    const matrix = await getMatrix();
    return {
      roles: ROLES.map((r) => ({ role: r, label: ROLE_LABELS[r] })),
      rows: PERMISSIONS.map((p) => ({
        permission: p,
        label: PERMISSION_LABELS[p],
        values: ROLES.map((r) => matrix[p][r]),
      })),
    };
  });

  /** 权限矩阵修改——仅系统管理员，写审计，即时生效（缓存失效） */
  app.put('/api/rbac/matrix', { preHandler: [requireLogin, requirePermission('rbac.manage')] }, async (req) => {
    const { permission, role, allowed } = matrixUpdateSchema.parse(req.body);
    const matrix = await getMatrix();
    const before = matrix[permission as Permission][role as Role];
    await query(
      `INSERT INTO permission_matrix (permission, role, allowed) VALUES ($1,$2,$3)
       ON CONFLICT (permission, role) DO UPDATE SET allowed=EXCLUDED.allowed, updated_at=now()`,
      [permission, role, allowed],
    );
    invalidateMatrixCache();
    await writeAudit(req.currentUser!, {
      objectType: 'permission_matrix',
      objectId: `${permission}:${role}`,
      objectLabel: `角色：${ROLE_LABELS[role as Role]} · ${PERMISSION_LABELS[permission as Permission]}`,
      action: '修改角色权限',
      category: 'admin',
      field: PERMISSION_LABELS[permission as Permission],
      before: before ? '允许' : '禁止',
      after: allowed ? '允许' : '禁止',
    });
    return { ok: true };
  });

  app.post('/api/rbac/users', { preHandler: [requireLogin, requirePermission('rbac.manage')] }, async (req) => {
    const input = createUserSchema.parse(req.body);
    const { rows: dup } = await query('SELECT id FROM users WHERE email=$1', [input.email]);
    if (dup[0]) throw new DomainError('该邮箱已存在', 409);
    const id = newId('usr');
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, library_scope, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,TRUE)`,
      [id, input.name, input.email, await hashPassword(input.initialPassword), input.role, JSON.stringify(input.libraryScope)],
    );
    await writeAudit(req.currentUser!, {
      objectType: 'user', objectId: id, objectLabel: `${input.name}（${input.email}）`,
      action: '创建用户', category: 'admin', field: '角色与范围',
      before: '—', after: `${ROLE_LABELS[input.role]} · ${input.libraryScope.length} 个知识库`,
      note: '首次登录强制改密',
    });
    return { id };
  });

  /** 禁用用户——会话即时失效（删除会话行），历史留痕保留 */
  app.post('/api/rbac/users/:id/toggle', { preHandler: [requireLogin, requirePermission('rbac.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { enabled } = req.body as { enabled: boolean };
    const { rows } = await query<{ name: string; email: string; enabled: boolean }>(
      'SELECT name, email, enabled FROM users WHERE id=$1',
      [id],
    );
    const u = rows[0];
    if (!u) throw new DomainError('用户不存在', 404);
    await query('UPDATE users SET enabled=$2 WHERE id=$1', [id, enabled]);
    if (!enabled) await destroyUserSessions(id);
    await writeAudit(req.currentUser!, {
      objectType: 'user', objectId: id, objectLabel: `${u.name}（${u.email}）`,
      action: enabled ? '启用用户' : '禁用用户', category: 'admin', field: '启用状态',
      before: u.enabled ? '启用' : '禁用', after: enabled ? '启用' : '禁用',
      note: enabled ? '账号恢复可登录' : '会话即时失效，历史留痕保留',
    });
    return { ok: true, message: enabled ? `已启用 ${u.name}` : `已禁用 ${u.name}（会话即时失效，历史留痕保留）` };
  });
}
