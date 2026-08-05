import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // setupFiles 在测试模块加载前执行：清空外部凭据，强制沙箱 + 本地 provider。
    // 少了这道守卫，配了 .env 的机器上跑测试会真写生产 Zendesk。
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
