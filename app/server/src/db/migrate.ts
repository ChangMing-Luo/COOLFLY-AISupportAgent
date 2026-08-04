import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);

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
