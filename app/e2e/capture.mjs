/**
 * DESIGN-01 视觉基线捕获：以相同视口与相同顺序，分别截取
 *   ① 原型（v3.dc.html，权威 UI） → *-baseline-*.png
 *   ② 成品（知识运营中台运行态）   → *-actual-*.png
 * 输出到 COOLFLY智能客服/output/tests/visual/
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.VISUAL_DIR;
const PROTO = process.env.PROTO_URL;
const APP = process.env.APP_URL;
const VIEWPORT = { width: 1440, height: 1000 };

const VIEWS = ['work', 'kb', 'entry', 'mine', 'review', 'sync', 'dash', 'feedback', 'logs', 'rbac'];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function captureProto() {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(PROTO, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  for (const v of VIEWS) {
    // 原型导航按 label 文本定位（React 运行时渲染，无 data-view 钩子）
    const labels = {
      work: '我的工作台', kb: '知识库总览', entry: '条目工作台', mine: 'AI 对话挖掘',
      review: '审核中心', sync: '同步中心 · Zendesk', dash: '数据看板',
      feedback: '反馈回流', logs: '操作日志', rbac: '用户与权限',
    };
    const btn = page.locator('nav button', { hasText: labels[v] }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${OUT}/PAGE-F09-01-baseline-${v}.png` });
    console.log(`baseline ${v} ✓`);
  }
  await page.close();
}

async function captureApp() {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.fill('#em', 'lixiao@coolfly.com');
  await page.fill('#pw', 'Coolfly@2026');
  await page.click('button[type=submit]');
  await page.waitForSelector('.shell', { timeout: 15000 });
  await page.waitForTimeout(1000);
  for (const v of VIEWS) {
    const btn = page.locator(`[data-view="${v}"]`);
    const disabled = await btn.isDisabled();
    if (!disabled) {
      await btn.click();
      await page.waitForTimeout(900);
    }
    // 条目工作台：默认是「新建条目」空白态，改从总览点一条既有条目进入，
    // 否则 AI 摘要面板 / 版本 / 效果 / 门禁三查都没有可对照的内容
    if (v === 'entry' && !disabled) {
      await page.locator('[data-view="kb"]').click();
      await page.waitForTimeout(900);
      await page.locator('table tbody tr').first().click();
      await page.waitForTimeout(1200);
    }
    // 审核中心：选中队列首条并展开 git diff，使两层变更对照与门禁三查同时可见
    if (v === 'review' && !disabled) {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.count()) {
        await firstRow.click();
        await page.waitForTimeout(900);
        const toggle = page.locator('[data-testid="toggle-diff"]');
        if (await toggle.count()) {
          await toggle.click();
          await page.waitForTimeout(700);
        }
      }
    }
    await page.screenshot({ path: `${OUT}/PAGE-F09-01-actual-${v}.png` });
    console.log(`actual ${v} ✓${disabled ? '（该角色无权限，截当前态）' : ''}`);
  }
  // 系统管理员视角补 rbac 视图
  await page.click('text=退出登录');
  await page.waitForSelector('#em', { timeout: 10000 });
  await page.fill('#em', 'ken@coolfly.com');
  await page.fill('#pw', 'Coolfly@2026');
  await page.click('button[type=submit]');
  await page.waitForSelector('.shell', { timeout: 15000 });
  await page.click('[data-view="rbac"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/PAGE-F09-01-actual-rbac.png` });
  console.log('actual rbac（系统管理员）✓');
  await page.close();
}

await captureProto();
await captureApp();
await browser.close();
console.log('截图对捕获完成');
