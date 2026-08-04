import cron from 'node-cron';
import { buildApp } from './app.js';
import { drainQueue, scanDrift } from './services/sync.js';
import { runDailyBatch } from './services/mining.js';

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
