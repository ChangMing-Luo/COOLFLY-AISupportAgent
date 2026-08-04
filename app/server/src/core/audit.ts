import type { PoolClient } from 'pg';
import { query, newId } from '../db/pool.js';
import type { Role } from '@kb/contracts';

export interface AuditActor {
  id: string;
  name: string;
  role: Role;
}

export interface AuditEntry {
  objectType: string;
  objectId: string | null;
  objectLabel: string;
  action: string;
  category: 'content' | 'review' | 'admin';
  field?: string | null;
  before?: string | null;
  after?: string | null;
  note?: string | null;
}

/** 审计写入——append-only；数据库规则已禁 UPDATE/DELETE（RULE-07） */
export async function writeAudit(
  actor: AuditActor,
  entry: AuditEntry,
  client?: PoolClient,
): Promise<void> {
  const sql = `INSERT INTO audit_logs
    (id, actor_id, actor_name, actor_role, object_type, object_id, object_label, action, category, field, before_value, after_value, note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;
  const params = [
    newId('log'),
    actor.id,
    actor.name,
    actor.role,
    entry.objectType,
    entry.objectId,
    entry.objectLabel,
    entry.action,
    entry.category,
    entry.field ?? null,
    entry.before ?? null,
    entry.after ?? null,
    entry.note ?? null,
  ];
  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}

/** 字段级前后值 diff——写操作统一取变更前后快照 */
export function fieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  watched: string[],
): Array<{ field: string; before: string; after: string }> {
  const out: Array<{ field: string; before: string; after: string }> = [];
  for (const key of watched) {
    const b = before[key];
    const a = after[key];
    const bs = normalize(b);
    const as = normalize(a);
    if (bs !== as) out.push({ field: key, before: bs, after: as });
  }
  return out;
}

function normalize(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
