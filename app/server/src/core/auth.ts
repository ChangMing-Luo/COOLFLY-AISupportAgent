import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role, SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { permissionsOf } from './rbac.js';

export const SESSION_COOKIE = 'kb_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  library_scope: string[];
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

export async function createSession(userId: string): Promise<string> {
  const id = newId('sess');
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
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    libraryScope: row.library_scope ?? [],
    mustChangePassword: row.must_change_password,
    permissions: await permissionsOf(row.role),
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
  const unsigned = req.unsignCookie(sid);
  const value = unsigned.valid && unsigned.value ? unsigned.value : sid;
  const user = await loadSessionUser(value);
  if (user) {
    req.currentUser = user;
    req.sessionId = value;
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
