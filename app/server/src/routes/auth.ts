import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, loginSchema } from '@kb/contracts';
import { query } from '../db/pool.js';
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
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

/**
 * 账号不存在时也跑一次 argon2，抹平「无此邮箱（快）/ 密码错（慢）」的时间差。
 * 否则文案再泛化，响应耗时仍然把账号是否存在告诉了攻击者。
 */
let dummyHash: Promise<string> | null = null;

async function checkCredential(user: DbUser | undefined, password: string): Promise<boolean> {
  if (!user) {
    // 惰性生成真实哈希：写死字面量一旦格式不符会被 verifyPassword 的 catch 直接吞掉，
    // 那就没有真正跑 argon2，时间差照样存在。
    dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    await verifyPassword(await dummyHash, password);
    return false;
  }
  const ok = await verifyPassword(user.password_hash, password);
  return ok && user.enabled;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { rows } = await query<DbUser>('SELECT * FROM users WHERE email = $1', [body.email]);
    const user = rows[0];
    if (!(await checkCredential(user, body.password))) {
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
      if (!(await checkCredential(target, body.password))) {
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

  /**
   * 修改密码。新增用户拿到的一次性初始密码必须能被换掉，否则 `must_change_password`
   * 无从满足、初始密码永久有效。改完销毁该用户**其它**会话（当前会话续用），
   * 防止密码泄露后旧登录态继续存活。
   */
  app.post(
    '/api/auth/change-password',
    { preHandler: requireLogin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = changePasswordSchema.parse(req.body);
      const me = req.currentUser!;
      const { rows } = await query<DbUser>('SELECT * FROM users WHERE id = $1', [me.id]);
      const user = rows[0];
      if (!user || !(await verifyPassword(user.password_hash, body.currentPassword))) {
        throw new DomainError('当前密码不正确。', 401);
      }
      if (body.currentPassword === body.newPassword) {
        throw new DomainError('新密码不能与当前密码相同。', 400);
      }
      await query('UPDATE users SET password_hash=$2, must_change_password=FALSE WHERE id=$1', [
        me.id,
        await hashPassword(body.newPassword),
      ]);
      await destroyUserSessions(me.id);
      const sid = await createSession(me.id);
      reply.setCookie(SESSION_COOKIE, sid, COOKIE_OPTS);
      await writeAudit(
        { id: me.id, name: me.name, roleLabel: me.roleLabel },
        { action: '修改密码', objectType: 'user', objectCode: me.email, objectLabel: me.name },
      );
      return { user: await loadSessionUser(sid) };
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
