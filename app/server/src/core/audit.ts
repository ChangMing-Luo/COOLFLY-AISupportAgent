import type { PoolClient } from 'pg';
import { query, newId } from '../db/pool.js';

export interface AuditActor {
  id: string | null;
  name: string;
  roleLabel: string;
}

export interface AuditEntry {
  /** 审计列表第一列「操作」，如 提交审核 / 审核通过并发布 / 驳回 / Zendesk 同步 */
  action: string;
  /** 对象展示名，如 `KB-20418 国际机票改签手续费计算规则（2026 版）` */
  objectLabel: string;
  objectType?: string;
  objectCode?: string | null;
  result?: '成功' | '失败';
  version?: string | null;
  detail?: string | null;
}

/** 系统动作（定时任务、Zendesk 回流）统一记在「系统」名下 */
export const SYSTEM_ACTOR: AuditActor = { id: null, name: '系统', roleLabel: '系统' };

/** 审计写入——append-only；数据库规则已禁 UPDATE/DELETE（RULE-02） */
export async function writeAudit(
  actor: AuditActor,
  entry: AuditEntry,
  client?: PoolClient,
): Promise<void> {
  const sql = `INSERT INTO audit_logs
    (id, actor_id, actor_name, actor_role, action, object_type, object_code, object_label, result, version, detail)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`;
  const params = [
    newId('log'),
    actor.id,
    actor.name,
    actor.roleLabel,
    entry.action,
    entry.objectType ?? 'entry',
    entry.objectCode ?? null,
    entry.objectLabel,
    entry.result ?? '成功',
    entry.version ?? null,
    entry.detail ?? null,
  ];
  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}
