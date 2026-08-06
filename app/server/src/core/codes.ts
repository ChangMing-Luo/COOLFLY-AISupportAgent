/**
 * 业务编号（KB- / RV- / EX- / CT- / FB- / CAT- …）都是「读 MAX → +1 → INSERT」，
 * 这三步不是原子的：两个人同时提交会读到同一个 MAX，后到者撞唯一键直接 500。
 *
 * 最坏的一例是提交审核——`submitEntry` 先把条目置 pending、再插审核请求，
 * 插入一失败，条目就成了「已提交但审核队列里根本没有」的孤儿：
 * 它因 pending 不可编辑、不可修订，界面上也没有任何入口能解开。
 *
 * 冲突是罕见且瞬时的（重算一次 MAX 就避开了），所以按唯一键冲突重试即可，
 * 不必为此把所有写路径包进事务或引入号段表。
 */

/** PostgreSQL unique_violation */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

/**
 * 执行「算号 + 插入」，撞唯一键就重算重试。
 * `fn` 必须把取号也包在里面，否则重试还是拿同一个号。
 */
export async function withCodeRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      last = err;
      // 退让一小段再重算，避免两个请求以同一节奏反复相撞
      await new Promise((r) => setTimeout(r, 15 * (i + 1) + Math.floor(Math.random() * 15)));
    }
  }
  throw last;
}
