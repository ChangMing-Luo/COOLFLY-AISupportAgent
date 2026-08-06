import { randomBytes } from 'node:crypto';
import { DEFAULT_PERMISSION_MATRIX, PERMISSIONS, ROLE_LABELS, type Role } from '@kb/contracts';
import { pool, query, newId } from './pool.js';
import { hashPassword } from '../core/auth.js';

/**
 * 引导数据（**不含任何演示/mock 业务数据**）：
 *   ① 每个角色一个账号；② 权限矩阵默认值。
 * 幂等且非破坏性：重跑不删业务数据、不重置已存在账号的密码
 * （要重置密码显式 `SEED_RESET_PASSWORD=1`）。
 *
 * 分类 / 场景 / 标签由用户在「元数据中心」自建并同步 Zendesk；
 * 知识条目、抽取候选、反馈、未命中一律来自真实业务与 Zendesk 回流。
 */

interface BootstrapUser {
  name: string;
  email: string;
  role: Role;
  department: string;
  /** 审核权限（super 恒有；ops 需单独授予） */
  review: boolean;
}

const USERS: BootstrapUser[] = [
  { name: '超级管理员', email: 'admin@coolfly.com', role: 'super', department: '知识中台', review: true },
  { name: '知识运营', email: 'ops@coolfly.com', role: 'ops', department: '客服运营', review: true },
];

/** 16 字符强随机密码，仅在创建时输出一次，库里只存 argon2 哈希 */
function newPassword(): string {
  return randomBytes(12).toString('base64url');
}

async function main(): Promise<void> {
  const created: Array<{ name: string; email: string; role: string; password: string }> = [];
  const kept: string[] = [];

  for (const u of USERS) {
    const { rows } = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [u.email]);
    const reset = process.env.SEED_RESET_PASSWORD === '1';
    if (rows[0] && !reset) {
      await query(
        'UPDATE users SET name=$2, role=$3, department=$4, review_granted=$5, enabled=TRUE WHERE id=$1',
        [rows[0].id, u.name, u.role, u.department, u.review],
      );
      kept.push(`${u.name} <${u.email}>`);
      continue;
    }
    const password = newPassword();
    const hash = await hashPassword(password);
    if (rows[0]) {
      await query(
        'UPDATE users SET name=$2, password_hash=$3, role=$4, department=$5, review_granted=$6, enabled=TRUE WHERE id=$1',
        [rows[0].id, u.name, hash, u.role, u.department, u.review],
      );
    } else {
      await query(
        `INSERT INTO users (id, name, email, password_hash, role, department, review_granted, enabled, must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,FALSE)`,
        [newId('usr'), u.name, u.email, hash, u.role, u.department, u.review],
      );
    }
    created.push({ name: u.name, email: u.email, role: ROLE_LABELS[u.role], password });
  }

  for (const p of PERMISSIONS) {
    for (const role of ['super', 'ops'] as const) {
      await query(
        `INSERT INTO permission_matrix (permission, role, allowed) VALUES ($1,$2,$3)
         ON CONFLICT (permission, role) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()`,
        [p, role, DEFAULT_PERMISSION_MATRIX[p][role]],
      );
    }
  }

  const counts = await query<{ t: string; n: string }>(
    `SELECT 'entries' AS t, COUNT(*)::text AS n FROM entries
     UNION ALL SELECT 'categories', COUNT(*)::text FROM categories
     UNION ALL SELECT 'scenes', COUNT(*)::text FROM scenes
     UNION ALL SELECT 'tags', COUNT(*)::text FROM tags
     UNION ALL SELECT 'feedbacks', COUNT(*)::text FROM feedbacks
     UNION ALL SELECT 'misses', COUNT(*)::text FROM misses`,
  );

  console.log('引导数据就绪（无演示数据）：');
  console.log(`  权限矩阵 ${PERMISSIONS.length} 权限 × 2 角色`);
  if (created.length) {
    console.log('  新建账号（密码仅显示这一次）：');
    for (const c of created) console.log(`    ${c.role}  ${c.name} <${c.email}>  密码：${c.password}`);
  }
  if (kept.length) console.log(`  已存在账号（密码未变动）：${kept.join('、')}`);
  console.log(`  当前业务数据：${counts.rows.map((r) => `${r.t}=${r.n}`).join(' ')}`);
  await pool.end();
}

main().catch((err) => {
  console.error('引导数据写入失败：', err);
  process.exit(1);
});
