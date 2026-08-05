import pg from 'pg';

const { Pool } = pg;

/** v4 独立库：旧模型的 kb_console 原样保留为回滚点，不做任何破坏性迁移 */
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://localhost:5432/kb_console_v4';

export const pool = new Pool({ connectionString: DATABASE_URL });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
