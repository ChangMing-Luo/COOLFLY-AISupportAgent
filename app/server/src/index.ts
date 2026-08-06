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
import { runCollect } from './services/collect.js';
import { refreshMisses } from './services/feedback.js';
import { purgeEmptyDrafts } from './services/importer.js';

const PORT = Number(process.env.PORT ?? 3311);

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`知识运营中台服务已启动 http://localhost:${PORT}`);

  // 清掉「点了撰写新知识但没写就走了」留下的空壳草稿（现在新建已改为首次保存才落库，这里收历史残留）
  const purged = await purgeEmptyDrafts().catch(() => 0);
  if (purged) app.log.info(`已清理 ${purged} 条空草稿`);

  if (process.env.DISABLE_CRON !== '1') {
    // AI 抽取：每日 07:00（抽取工作台页头文案与此一致）
    cron.schedule(process.env.COLLECT_CRON ?? '0 7 * * *', () => {
      runCollect('系统').catch((e) => app.log.error({ err: e }, 'AI 抽取失败'));
    });
    // 未命中刷新：每小时从帮助中心「搜索无结果」拉取
    cron.schedule('30 * * * *', () => {
      refreshMisses().catch((e) => app.log.error({ err: e }, '未命中刷新失败'));
    });
  }
}

main().catch((err) => {
  console.error('服务启动失败：', err);
  process.exit(1);
});
