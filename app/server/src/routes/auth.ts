import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@kb/contracts';
import { query } from '../db/pool.js';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  loadSessionUser,
  requireLogin,
  verifyPassword,
  type DbUser,
} from '../core/auth.js';
import { writeAudit } from '../core/audit.js';
import { DomainError } from '../services/entries.js';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  signed: true,
  secure: process.env.NODE_ENV === 'production',
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { rows } = await query<DbUser>('SELECT * FROM users WHERE email = $1', [body.email]);
    const user = rows[0];
    if (!user || !user.enabled || !(await verifyPassword(user.password_hash, body.password))) {
      return reply.code(401).send({ error: 'unauthorized', message: '邮箱或密码不正确，或账号已停用' });
    }
    const sid = await createSession(user.id);
    await query('UPDATE users SET last_active_at = now() WHERE id = $1', [user.id]);
    reply.setCookie(SESSION_COOKIE, sid, COOKIE_OPTS);
    const session = await loadSessionUser(sid);
    await writeAudit(
      { id: user.id, name: user.name, roleLabel: session?.roleLabel ?? '' },
      { action: '登录', objectType: 'user', objectCode: user.email, objectLabel: user.name },
    );
    return { user: session };
  });

  app.post('/api/auth/logout', { preHandler: requireLogin }, async (req, reply) => {
    if (req.sessionId) await destroySession(req.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireLogin }, async (req) => ({ user: req.currentUser }));

  /**
   * 切换账号：原型顶栏「切换」按钮的生产化实现。
   * 免密切身份是越权漏洞，故必须验密码后重新建会话（SPEC-v4 §7）。
   */
  app.post(
    '/api/auth/switch',
    { preHandler: requireLogin, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = loginSchema.parse(req.body);
      const { rows } = await query<DbUser>('SELECT * FROM users WHERE email = $1', [body.email]);
      const target = rows[0];
      if (!target || !target.enabled || !(await verifyPassword(target.password_hash, body.password))) {
        throw new DomainError('账号或密码不正确，或账号已停用', 401);
      }
      if (req.sessionId) await destroySession(req.sessionId);
      const sid = await createSession(target.id);
      reply.setCookie(SESSION_COOKIE, sid, COOKIE_OPTS);
      const session = await loadSessionUser(sid);
      await writeAudit(
        { id: target.id, name: target.name, roleLabel: session?.roleLabel ?? '' },
        { action: '切换账号', objectType: 'user', objectCode: target.email, objectLabel: target.name },
      );
      return { user: session };
    },
  );

  /** 切换账号对话框的可选账号（不含密码，仅姓名 / 角色 / 邮箱） */
  app.get('/api/auth/accounts', { preHandler: requireLogin }, async () => {
    const { rows } = await query<{ name: string; email: string; role: string; department: string }>(
      `SELECT name, email, role, department FROM users WHERE enabled ORDER BY role, created_at`,
    );
    return { accounts: rows };
  });
}
