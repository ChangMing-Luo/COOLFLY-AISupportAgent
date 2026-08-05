/**
 * DESIGN 系列视觉验收：对照 doc/v4/spec/prototype.template.html 的关键度量与文案。
 * 跑法：先起 web(5311) 与 server(3311)，再 node e2e/ui.mjs
 * 产物：e2e/shots/*.png（逐页截图，供人工比对原型）
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5311';
const PWD = process.env.SEED_PASSWORD ?? 'Coolfly@2026';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(WEB, { waitUntil: 'networkidle' });
await page.fill('#em', 'chenmo@coolfly.com');
await page.fill('#pw', PWD);
await page.click('button[type=submit]');
await page.waitForSelector('aside nav button', { timeout: 15000 });
await page.waitForTimeout(700);

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}${name}.png` });
}

async function go(label, sub) {
  await page.evaluate(
    ([l, s]) => {
      const nav = [...document.querySelectorAll('aside nav button')];
      nav.find((b) => b.textContent.includes(l))?.click();
      if (s) {
        setTimeout(() => {
          [...document.querySelectorAll('aside nav button')].find((b) => b.textContent.trim() === s)?.click();
        }, 60);
      }
    },
    [label, sub],
  );
  await page.waitForTimeout(700);
}

/* ══════ DESIGN-01 骨架度量 ══════ */
{
  const m = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const groups = document.querySelectorAll('aside nav > div').length;
    const kpi = document.querySelectorAll('main > div:nth-of-type(2) > div').length;
    return {
      root: document.querySelector('#root > div')?.getBoundingClientRect().width,
      aside: aside?.getBoundingClientRect().width,
      groups,
      kpi,
      brand: document.querySelector('aside div')?.textContent,
    };
  });
  record(
    'DESIGN-01a',
    m.root === 1440 && m.aside === 236 && m.groups === 10 && m.kpi === 5,
    `根容器 ${m.root}px / 侧栏 ${m.aside}px / 导航 ${m.groups} 组 / KPI ${m.kpi} 列（原型 1440 / 236 / 10 / 5）`,
  );
  await shot('01-dash');
}

/* ══════ DESIGN-01 列表列宽 ══════ */
{
  await go('知识库');
  const w = await page.evaluate(() =>
    [...document.querySelectorAll('table.table thead th')].map((th) => th.style.width || '—'),
  );
  record(
    'DESIGN-01b',
    JSON.stringify(w) === JSON.stringify(['34%', '13%', '11%', '15%', '11%', '16%']),
    `列宽 ${w.join(' / ')}（原型 34/13/11/15/11/16）`,
  );
  await shot('02-kb-list');
}

/* ══════ DESIGN-02 六态与四同步态文案 ══════ */
{
  const labels = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('td .tag').forEach((t) => set.add(t.textContent.trim()));
    return [...set];
  });
  const expected = ['草稿', '待审核', '已驳回', '已发布', '修复中'];
  record(
    'DESIGN-02a',
    expected.every((l) => labels.includes(l)),
    `列表出现状态标签：${labels.join(' / ')}`,
  );

  await go('发布与同步');
  const syncLabels = await page.evaluate(() => [...new Set([...document.querySelectorAll('td .tag')].map((t) => t.textContent.trim()))]);
  record(
    'DESIGN-02b',
    syncLabels.some((l) => ['已同步', '同步失败', '同步中', '未同步'].includes(l)),
    `同步态标签：${syncLabels.join(' / ')}`,
  );
  await shot('03-publish');
}

/* ══════ DESIGN-01 抽屉 640 / 弹窗 440 / toast 392 ══════ */
{
  await go('审核中心');
  await page.evaluate(() => {
    [...document.querySelectorAll('td button')].find((b) => b.textContent.trim() === '审核')?.click();
  });
  await page.waitForTimeout(800);
  const drawer = await page.evaluate(() => {
    const panel = document.querySelector('div[style*="z-index: 60"] > div:nth-child(2)');
    const diffTypes = [...document.querySelectorAll('div[style*="z-index: 60"] div')]
      .filter((d) => /^\d+$/.test(d.textContent.trim()) && d.style.width)
      .map((d) => d.style.background);
    return { width: panel?.getBoundingClientRect().width, diffRows: diffTypes.length };
  });
  record('DESIGN-01c', drawer.width === 640, `审核抽屉宽 ${drawer.width}px（原型 640），diff 行 ${drawer.diffRows}`);
  await shot('04-review-drawer');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '×')?.click();
  });
  await page.waitForTimeout(400);
}

{
  await go('知识库');
  await page.evaluate(() => {
    [...document.querySelectorAll('td button')].find((b) => b.textContent.includes('国际机票改签手续费'))?.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('版本与质量'))?.click();
  });
  await page.waitForTimeout(300);
  await shot('05-detail-versions');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('回滚至'))?.click();
  });
  await page.waitForTimeout(500);
  const dialog = await page.evaluate(() => document.querySelector('.dialog')?.getBoundingClientRect().width);
  record('DESIGN-01d', dialog === 440, `回滚弹窗宽 ${dialog}px（原型 440）`);
  await shot('06-rollback-modal');
  await page.evaluate(() => {
    [...document.querySelectorAll('.dialog button')].find((b) => b.textContent.trim() === '取消')?.click();
  });
  await page.waitForTimeout(300);
}

/* ══════ 其余页面留档 ══════ */
for (const [label, sub, name] of [
  ['知识采集', null, '07-extract'],
  ['知识编辑', null, '08-drafts'],
  ['反馈回流', '用户反馈', '09-feedback'],
  ['反馈回流', '未命中问题', '10-miss'],
  ['元数据中心', '知识分类', '11-meta-cat'],
  ['元数据中心', '知识标签', '12-meta-tag'],
  ['数据分析', null, '13-health'],
  ['系统管理', '用户与角色', '14-users'],
  ['系统管理', '权限矩阵', '15-perms'],
  ['系统管理', '操作审计', '16-audit'],
]) {
  await go(label, sub);
  await shot(name);
}

/* ══════ RULE-01 UI 层 403 ══════ */
{
  await page.evaluate(() =>
    fetch('/api/auth/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'linjing@coolfly.com', password: 'Coolfly@2026' }),
    }),
  );
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await go('系统管理', '用户与角色');
  const denied = await page.evaluate(() => document.body.innerText.includes('403 · 权限不足'));
  record('RULE-01-ui', denied, `林静访问系统管理 → 页面显示 403 权限不足=${denied}`);
  await shot('17-403');
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
console.log(`截图目录：${SHOTS}`);
if (failed.length) process.exit(1);
