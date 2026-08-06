import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ROLE_LABELS, type Role, type SessionUser } from '@kb/contracts';
import { query } from '../db/pool.js';
import { permissionsOf } from './rbac.js';

export const SESSION_COOKIE = 'kb_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  department: string;
  review_granted: boolean;
  enabled: boolean;
  must_change_password: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * 会话 id 是本系统唯一的认证凭据，必须用 CSPRNG。
 * 通用的 `newId()` 走 `Math.random()`（V8 xorshift128+，非密码学安全）且随机位只有 ~41 bit——
 * 攻击者拿自己多次登录的 session id 就能反推 PRNG 状态、预测他人会话。
 */
export async function createSession(userId: string): Promise<string> {
  const id = `sess_${randomBytes(32).toString('base64url')}`;
  await query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)', [
    id,
    userId,
    new Date(Date.now() + SESSION_TTL_MS),
  ]);
  return id;
}

export async function destroySession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

/** 禁用用户即删其全部会话行 —— 会话即时失效（RULE-05） */
export async function destroyUserSessions(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

export async function loadSessionUser(sessionId: string): Promise<SessionUser | null> {
  const { rows } = await query<DbUser & { expires_at: Date }>(
    `SELECT u.*, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.enabled = TRUE`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;
  const reviewGranted = row.role === 'super' || row.review_granted;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role],
    department: row.department ?? '',
    reviewGranted,
    mustChangePassword: row.must_change_password,
    permissions: await permissionsOf(row.role, reviewGranted),
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SessionUser;
    sessionId?: string;
  }
}

/** 全局登录态解析；未登录不在此处拒绝（由 requireLogin/requirePermission 决定） */
export async function attachUser(req: FastifyRequest): Promise<void> {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return;
  // 签名校验不通过就直接拒绝。原来会回退到原始 Cookie 值继续查库，
  // 等于把 `signed: true` 的防伪保护抵消掉：任何人手写 `kb_session=<会话id>` 就能通过认证。
  const unsigned = req.unsignCookie(sid);
  if (!unsigned.valid || !unsigned.value) return;
  const user = await loadSessionUser(unsigned.value);
  if (user) {
    req.currentUser = user;
    req.sessionId = unsigned.value;
  }
}

export async function requireLogin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.currentUser) {
    await reply.code(401).send({ error: 'unauthorized', message: '未登录或会话已失效' });
  }
}

export function currentUserOrThrow(req: FastifyRequest): SessionUser {
  if (!req.currentUser) throw new Error('未登录');
  return req.currentUser;
}
