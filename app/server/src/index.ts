import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cron from 'node-cron';
import { buildApp } from './app.js';

// .env 自动加载：Node 24 原生 loadEnvFile，零依赖。
// 必须在 import 之后、任何读 process.env 的代码之前执行——
// 原来只能靠 `node --env-file=.env` 或 shell export，漏了就静默跑成本地桩。
const here = dirname(fileURLToPath(import.meta.url));
for (const dir of [process.cwd(), join(here, '..'), join(here, '../..')]) {
  const f = join(dir, '.env');
  if (existsSync(f)) {
    process.loadEnvFile(f);
    break;
  }
}
import { drainQueue, scanDrift } from './services/sync.js';
import { runDailyBatch } from './services/mining.js';
import { collectSignals } from './services/signals.js';
import { scanReviewDue } from './services/entries.js';

const PORT = Number(process.env.PORT ?? 3311);

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`知识运营中台服务已启动 http://localhost:${PORT}`);

  if (process.env.DISABLE_CRON !== '1') {
    // 同步队列（分钟级推送）
    cron.schedule('* * * * *', () => {
      drainQueue().catch((e) => app.log.error({ err: e }, '同步队列执行失败'));
    });
    // drift 扫描（建议值每小时）
    cron.schedule('0 * * * *', () => {
      scanDrift().catch((e) => app.log.error({ err: e }, 'drift 扫描失败'));
    });
    // 信号采集（每小时，四渠道；待核实档位如实标注不进达标判定）
    cron.schedule('30 * * * *', () => {
      collectSignals().catch((e) => app.log.error({ err: e }, '信号采集失败'));
    });
    // 复核到期扫描（每日 8:00，到期与临期条目写告警信号，界面据此提醒）
    cron.schedule('0 8 * * *', () => {
      scanReviewDue().catch((e) => app.log.error({ err: e }, '复核到期扫描失败'));
    });
    // 每日挖掘批次（业务时区低峰）
    cron.schedule('0 3 * * *', () => {
      const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      runDailyBatch(d).catch((e) => app.log.error({ err: e }, '挖掘批次失败'));
    });
  }
}

main().catch((err) => {
  console.error('服务启动失败：', err);
  process.exit(1);
});
