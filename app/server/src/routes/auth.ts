import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, loginSchema } from '@kb/contracts';
import { query } from '../db/pool.js';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  hashPassword,
  loadSessionUser,
  requireLogin,
  verifyPassword,
  type DbUser,
} from '../core/auth.js';
import { writeAudit } from '../core/audit.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: Number(process.env.LOGIN_RATE_MAX ?? '10'), timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { email, password } = loginSchema.parse(req.body);
      const { rows } = await query<DbUser>('SELECT * FROM users WHERE email = $1', [email]);
      const user = rows[0];
      if (!user || !user.enabled || !(await verifyPassword(user.password_hash, password))) {
        return reply.code(401).send({ error: 'invalid_credentials', message: '邮箱或密码不正确，或账号已被禁用' });
      }
      const sid = await createSession(user.id);
      await query('UPDATE users SET last_active_at = now() WHERE id = $1', [user.id]);
      reply.setCookie(SESSION_COOKIE, sid, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        signed: true,
        secure: process.env.NODE_ENV === 'production',
      });
      const session = await loadSessionUser(sid);
      return { user: session };
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionId) await destroySession(req.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.currentUser) return reply.code(401).send({ error: 'unauthorized', message: '未登录或会话已失效' });
    return { user: req.currentUser };
  });

  app.post('/api/auth/change-password', { preHandler: requireLogin }, async (req) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const me = req.currentUser!;
    const { rows } = await query<DbUser>('SELECT * FROM users WHERE id = $1', [me.id]);
    const user = rows[0]!;
    if (!(await verifyPassword(user.password_hash, currentPassword))) {
      return { ok: false, message: '当前密码不正确' };
    }
    await query('UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE id = $1', [
      me.id,
      await hashPassword(newPassword),
    ]);
    await writeAudit(me, {
      objectType: 'user',
      objectId: me.id,
      objectLabel: `${me.name}（${me.email}）`,
      action: '修改密码',
      category: 'admin',
      field: '首次登录强制改密',
      before: '待改密',
      after: '已完成',
    });
    return { ok: true };
  });
}
