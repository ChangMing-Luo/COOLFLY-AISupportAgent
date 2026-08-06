import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { pool, DATABASE_URL } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 目标库不存在时自动建库（纯新增，不触碰任何既有库）。
 * v4 用独立库 kb_console_v4，旧模型的 kb_console 原样保留为回滚点。
 */
async function ensureDatabase(): Promise<void> {
  const url = new URL(DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName) throw new Error('DATABASE_URL 缺少库名');
  try {
    await pool.query('SELECT 1');
    return;
  } catch (err) {
    if ((err as { code?: string }).code !== '3D000') throw err;
  }
  const adminUrl = new URL(DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();
  console.log(`已创建数据库 ${dbName}`);
}

async function main(): Promise<void> {
  await ensureDatabase();
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);

  // 存量库补列（CREATE TABLE IF NOT EXISTS 不会给已存在的表加列）
  await pool.query(`
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS sync_fail_reason TEXT;
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS pending_kind TEXT;
    ALTER TABLE entries ADD COLUMN IF NOT EXISTS pending_version TEXT;
    ALTER TABLE users  ADD COLUMN IF NOT EXISTS review_granted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS category_hint TEXT NOT NULL DEFAULT '';
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS scene_hint TEXT NOT NULL DEFAULT '';
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS mention_count INT NOT NULL DEFAULT 1;
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS sentiment TEXT NOT NULL DEFAULT 'neutral';
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS drop_reason TEXT;
    ALTER TABLE extract_candidates ADD COLUMN IF NOT EXISTS auto_dropped BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
    ALTER TABLE scenes     ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
  `);

  // 存量分类/场景在引入审核前就在用，已同步到 Zendesk 的直接视为已发布，避免一升级全被门禁挡住
  await pool.query(`
    UPDATE categories SET status='published' WHERE status='draft' AND zendesk_category_ref IS NOT NULL;
    UPDATE scenes     SET status='published' WHERE status='draft' AND zendesk_section_ref  IS NOT NULL;
  `);

  // 审计日志 append-only：数据库层拒绝 UPDATE / DELETE（RULE-02）
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
