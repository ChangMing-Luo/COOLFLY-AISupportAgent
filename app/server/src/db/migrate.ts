import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 08-05-2026 删除向量能力的一次性破坏性 DDL（用户当次授权）。
 * 幂等：全部带 IF EXISTS，已清理过的库再跑无副作用。
 * 顺序：先删依赖表与列，再删扩展——否则 vector 类型仍被引用，DROP EXTENSION 会失败。
 */
async function dropVectorStack(): Promise<void> {
  await pool.query('DROP TABLE IF EXISTS entry_vectors');
  await pool.query('ALTER TABLE IF EXISTS entries DROP COLUMN IF EXISTS vector_status');
  await pool.query('DROP EXTENSION IF EXISTS vector');
}

async function main(): Promise<void> {
  await dropVectorStack();
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);

  // 存量库补列（schema.sql 的 CREATE TABLE IF NOT EXISTS 不会给已存在的表加列）
  await pool.query(`
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT '';
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS summary_source TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS summary_at TIMESTAMPTZ;
    ALTER TABLE mining_candidates ADD COLUMN IF NOT EXISTS dedupe_reason TEXT NOT NULL DEFAULT '';
    ALTER TABLE mining_candidates ADD COLUMN IF NOT EXISTS dedupe_degraded BOOLEAN NOT NULL DEFAULT false;
  `);

  // 审计日志 append-only：数据库层拒绝 UPDATE / DELETE（RULE-07）
  await pool.query(`
    CREATE OR REPLACE RULE audit_logs_no_update AS
      ON UPDATE TO audit_logs DO INSTEAD NOTHING;
    CREATE OR REPLACE RULE audit_logs_no_delete AS
      ON DELETE TO audit_logs DO INSTEAD NOTHING;
  `);

  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
  );
  console.log(`迁移完成：${rows.length} 张表`);
  console.log(rows.map((r) => r.table_name).join(', '));
  await pool.end();
}

main().catch((err) => {
  console.error('迁移失败：', err);
  process.exit(1);
});
