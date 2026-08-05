/**
 * FLOW 系列端到端验收（真实浏览器操作真实后端与数据库）。
 * 每条流程输出 PASS/FAIL 与关键断言证据。
 */
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:3311/';
const VIEWPORT = { width: 1440, height: 1000 };
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

const browser = await chromium.launch();

async function loginAs(email) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.fill('#em', email);
  await page.fill('#pw', 'Coolfly@2026');
  await page.click('button[type=submit]');
  await page.waitForSelector('.shell', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function go(page, view) {
  await page.click(`[data-view="${view}"]`);
  await page.waitForTimeout(900);
}

// ---------- SMOKE-02：登录 + 十视图导航 ----------
{
  const { ctx, page } = await loginAs('lixiao@coolfly.com');
  const title = await page.locator('.topbar__title').innerText();
  const cards = await page.locator('.stat').count();
  const visited = [];
  for (const v of ['work', 'kb', 'entry', 'mine', 'review', 'sync', 'dash', 'feedback', 'logs']) {
    await go(page, v);
    const crumb = await page.locator('.topbar__crumb').innerText();
    const t = await page.locator('.topbar__title').innerText();
    visited.push(`${v}:${t}/${crumb.split(' / ')[0]}`);
  }
  const rbacDisabled = await page.locator('[data-view="rbac"]').isDisabled();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  record(
    'SMOKE-02',
    title === '我的工作台' && cards >= 4 && visited.length === 9 && rbacDisabled && errors.length === 0,
    `登录落工作台(${title})、四统计卡=${cards}、九视图导航与面包屑联动、rbac 无权限置灰=${rbacDisabled}、页面错误=${errors.length}`,
  );
  await ctx.close();
}

// ---------- FLOW-01：录入 → 审核 → 门禁 → 同步 全链路 ----------
let flow01EntryTitle = `E2E 无人机首次配对失败排查 ${Date.now().toString().slice(-5)}`;
{
  const { ctx, page } = await loginAs('wangwen@coolfly.com');
  await go(page, 'work');
  const draftsBefore = Number((await page.locator('.stat').first().locator('.stat__value').innerText()).trim());

  // 经 API 建条目并提交（界面新建走条目工作台，此处验证工作台计数与审核中心联动）
  const created = await page.evaluate(async (title) => {
    const r = await fetch('/api/kb/entries', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, libraryId: 'lib_product', chapterId: 'ch_wifi', entryType: '操作流程型',
        visibility: 'public', sceneL1: '安装与配网', sceneL2: 'Wi-Fi 配对', labels: ['配对'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [{ id: 'p0', text: '首次配对失败排查', internal: false, heading: true }, { id: 'p1', text: '1. 确认手机连接 2.4GHz 网络。', internal: false, heading: false }] },
      }),
    });
    return r.json();
  }, flow01EntryTitle);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const draftsAfter = Number((await page.locator('.stat').first().locator('.stat__value').innerText()).trim());

  // 提交审核 + 检查导航待审徽标
  await page.evaluate(async (id) => {
    await fetch(`/api/kb/entries/${id}/submit`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual' }),
    });
  }, created.id);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const submittedCard = Number((await page.locator('.stat').nth(1).locator('.stat__value').innerText()).trim());
  const reviewBadge = await page.locator('[data-view="review"] .nav__badge').innerText().catch(() => '0');

  // 过审前：不应出现在知识库总览的已发布集合
  await go(page, 'kb');
  const publishedBefore = await page.locator('table tbody tr', { hasText: flow01EntryTitle }).count();

  await ctx.close();

  // 审核员：通过 → 门禁（英文未确认应阻断）
  const reviewer = await loginAs('lixiao@coolfly.com');
  await go(reviewer.page, 'review');
  await reviewer.page.locator('table tbody tr', { hasText: flow01EntryTitle }).first().click();
  await reviewer.page.waitForTimeout(800);
  // 变更对照两层：摘要层默认展示，点「查看具体变更」才出 git diff
  const summaryVisible = (await reviewer.page.locator('.change-summary__item').count()) > 0;
  const diffHiddenBefore = (await reviewer.page.locator('[data-testid="gitdiff"]').count()) === 0;
  await reviewer.page.locator('[data-testid="toggle-diff"]').click();
  await reviewer.page.waitForTimeout(700);
  const diffLines = await reviewer.page.locator('.gitdiff__line').count();
  const addLines = await reviewer.page.locator('.gitdiff__line--add').count();
  await reviewer.page.locator('[data-testid="approve"]').click();
  await reviewer.page.waitForTimeout(1200);

  const gateBlocked = await reviewer.page.evaluate(async (id) => {
    const r = await fetch(`/api/review/${id}/publish`, { method: 'POST', credentials: 'include' });
    return r.json();
  }, created.id);
  const blockedNoQueue = gateBlocked.status === 'blocked';

  // 补齐翻译确认后再发布（门禁三查：格式字段 / 内部段落 / 英文状态）
  await reviewer.page.evaluate(async (id) => {
    await fetch(`/api/kb/entries/${id}/translate`, { method: 'POST', credentials: 'include' });
    await fetch(`/api/kb/entries/${id}/translation/confirm`, { method: 'POST', credentials: 'include' });
  }, created.id);
  const published = await reviewer.page.evaluate(async (id) => {
    const r = await fetch(`/api/review/${id}/publish`, { method: 'POST', credentials: 'include' });
    return r.json();
  }, created.id);
  // 发布时生成 AI 摘要（AC-F09-39）
  const summaryAfterPublish = await reviewer.page.evaluate(
    async (id) => (await (await fetch(`/api/kb/entries/${id}/summary`, { credentials: 'include' })).json()).source,
    created.id,
  );

  await go(reviewer.page, 'sync');
  await reviewer.page.waitForTimeout(1000);
  const syncedRow = await reviewer.page.locator('table tbody tr', { hasText: flow01EntryTitle }).count();

  await go(reviewer.page, 'kb');
  // 条目在「产品与使用知识库」，总览默认选中首个库——切库后再断言可见性
  await reviewer.page.locator('.stat', { hasText: '产品与使用知识库' }).first().click();
  await reviewer.page.waitForTimeout(900);
  const publishedAfter = await reviewer.page.locator('table tbody tr', { hasText: flow01EntryTitle }).count();

  record(
    'FLOW-01',
    draftsAfter === draftsBefore + 1 && submittedCard >= 1 && Number(reviewBadge) >= 1 &&
      publishedBefore === 0 && blockedNoQueue && published.status === 'published' && syncedRow >= 1 && publishedAfter >= 1 &&
      summaryVisible && diffHiddenBefore && diffLines > 0 && summaryAfterPublish === 'ai',
    `草稿卡 ${draftsBefore}→${draftsAfter}、提交待审卡=${submittedCard}、待审徽标=${reviewBadge}、过审前不在总览=${publishedBefore === 0}、变更摘要层=${summaryVisible}、diff 默认折叠=${diffHiddenBefore}、展开后 diff 行=${diffLines}（新增 ${addLines}）、门禁阻断=${blockedNoQueue}、补齐后发布=${published.status}、同步任务行=${syncedRow}、总览可见=${publishedAfter >= 1}、发布后 AI 摘要来源=${summaryAfterPublish}`,
  );
  await reviewer.ctx.close();
}

// ---------- FLOW-02：驳回理由必填 + 往返 ----------
{
  const mgr = await loginAs('wangwen@coolfly.com');
  const rejectTitle = `E2E 驳回往返 ${Date.now().toString().slice(-5)}`;
  const created = await mgr.page.evaluate(async (title) => {
    const r = await fetch('/api/kb/entries', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, libraryId: 'lib_policy', chapterId: 'ch_billing', entryType: 'FAQ 型',
        visibility: 'public', sceneL1: '会员与账户', sceneL2: '会员计费', labels: ['会员'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [{ id: 'p0', text: '初版内容', internal: false, heading: false }] },
      }),
    });
    const e = await r.json();
    await fetch(`/api/kb/entries/${e.id}/submit`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manual' }),
    });
    return e;
  }, rejectTitle);
  await mgr.ctx.close();

  const rev = await loginAs('lixiao@coolfly.com');
  await go(rev.page, 'review');
  await rev.page.locator('table tbody tr', { hasText: rejectTitle }).first().click();
  await rev.page.waitForTimeout(700);
  await rev.page.locator('[data-testid="reject"]').click();
  await rev.page.waitForTimeout(400);
  // 空理由提交 → 必填校验可见
  await rev.page.locator('[data-testid="confirm-ok"]').click();
  await rev.page.waitForTimeout(400);
  const errVisible = await rev.page.locator('[data-testid="reject-error"]').isVisible();
  const errText = errVisible ? await rev.page.locator('[data-testid="reject-error"]').innerText() : '';
  // 填写理由后提交
  await rev.page.locator('[data-testid="reject-reason"]').fill('计费周期与财务口径不符，请附财务确认截图');
  await rev.page.locator('[data-testid="confirm-ok"]').click();
  await rev.page.waitForTimeout(1200);
  await rev.ctx.close();

  const mgr2 = await loginAs('wangwen@coolfly.com');
  await go(mgr2.page, 'work');
  const rejectedTab = mgr2.page.locator('.tab', { hasText: '被驳回' });
  await rejectedTab.click();
  await mgr2.page.waitForTimeout(600);
  const rejectedRow = await mgr2.page.locator('.content', { hasText: rejectTitle }).count();
  const reasonVisible = await mgr2.page.locator('.content').innerText();
  await mgr2.ctx.close();

  record(
    'FLOW-02',
    errVisible && errText.includes('驳回理由必填') && rejectedRow >= 1 && reasonVisible.includes('财务确认截图'),
    `空理由校验提示可见="${errText.slice(0, 20)}…"、驳回后进提交人「被驳回待改」=${rejectedRow >= 1}、理由回传可见=${reasonVisible.includes('财务确认截图')}`,
  );
}

// ---------- FLOW-03：挖掘批次三态 + 三重准入 ----------
{
  const { ctx, page } = await loginAs('wangwen@coolfly.com');
  await go(page, 'mine');
  const text = await page.locator('.content').innerText();
  const hasEmpty = text.includes('无新候选') || text.includes('无新草稿');
  const hasFailed = text.includes('429') || text.includes('拉取失败');
  const hasChannels = text.includes('邮件工单') && text.includes('在线聊天');
  const hasAdmission = text.includes('三重准入');
  const dedupeHint = text.includes('不新建，挂修订') || text.includes('挂修订');
  // 高查重候选不得出现「起草并提交审核」按钮
  const dupCard = page
    .locator('.card')
    .filter({ has: page.locator('span.strong', { hasText: '（挂到 KB-0155）' }) })
    .first();
  const dupHasDraftBtn = await dupCard.locator('button', { hasText: '起草并提交审核' }).count();
  // LLM 语义查重：判定理由随候选展示；本地 provider 时如实标注「语义查重未生效」
  const hasDedupeReason = text.includes('查重判定理由');
  const llmMode = await page.evaluate(async () => (await (await fetch('/healthz')).json()).llm);
  // 真跑一次批次，验证当前 provider 下的降级标注是否如实（本地模式必须标注，不得静默给分）
  const ranBatch = await page.evaluate(async () => {
    const r = await fetch('/api/mine/batches/run', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchDate: '2026-08-09' }),
    });
    const b = await r.json();
    const cands = await (await fetch(`/api/mine/candidates?batchId=${b.batchId}`, { credentials: 'include' })).json();
    return { status: b.status, degraded: cands.every((c) => c.dedupeDegraded), reasons: cands.every((c) => c.dedupeReason) };
  });
  // 回到挖掘视图重新拉批次（页面按内部路由渲染，reload 会退回默认视图）
  await go(page, 'work');
  await go(page, 'mine');
  await page.waitForTimeout(900);
  await page.locator('[data-batch="2026-08-09"]').first().click();
  await page.waitForTimeout(900);
  const degradedNoted = (await page.locator('.content').innerText()).includes('语义查重未生效');
  record(
    'FLOW-03',
    hasEmpty && hasFailed && hasChannels && hasAdmission && dedupeHint && dupHasDraftBtn === 0 &&
      hasDedupeReason && ranBatch.reasons && (llmMode !== 'local' || (ranBatch.degraded && degradedNoted)),
    `空批次如实标注=${hasEmpty}、失败批次含原因=${hasFailed}、分渠道计数=${hasChannels}、三重准入说明=${hasAdmission}、查重≥0.85仅挂修订（无立新条按钮）=${dupHasDraftBtn === 0}、查重判定理由可见=${hasDedupeReason}、LLM 模式=${llmMode}、实跑批次=${ranBatch.status}/每条含理由=${ranBatch.reasons}/本地模式标降级=${ranBatch.degraded}、界面「语义查重未生效」可见=${degradedNoted}`,
  );
  await ctx.close();
}

// ---------- FLOW-04：版本 diff + 回滚 ----------
{
  const { ctx, page } = await loginAs('lixiao@coolfly.com');
  const before = await page.evaluate(async () => {
    const r = await fetch('/api/kb/entries/KB-0155', { credentials: 'include' });
    return r.json();
  });
  const rolled = await page.evaluate(async (id) => {
    const r = await fetch(`/api/review/${id}/rollback`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetVersionNo: 1 }),
    });
    return r.json();
  }, before.entry.id);
  const after = await page.evaluate(async () => {
    const r = await fetch('/api/kb/entries/KB-0155', { credentials: 'include' });
    return r.json();
  });
  const rolledBackMarked = after.versions.some((v) => v.status === 'rolled_back');
  const metricsKept = after.versions.filter((v) => v.solveRate !== null).length >= 1;
  const syncQueued = await page.evaluate(async () => {
    const r = await fetch('/api/sync/tasks', { credentials: 'include' });
    const d = await r.json();
    return d.tasks.some((t) => t.action.includes('回滚'));
  });
  // 知识管理员无回滚入口
  await ctx.close();
  const mgr = await loginAs('wangwen@coolfly.com');
  const mgrRollback = await mgr.page.evaluate(async (id) => {
    const r = await fetch(`/api/review/${id}/rollback`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetVersionNo: 1 }),
    });
    return r.status;
  }, before.entry.id);
  await mgr.ctx.close();

  record(
    'FLOW-04',
    rolled.status === 'rolled_back' && rolledBackMarked && metricsKept && syncQueued && mgrRollback === 403,
    `回滚生成 v${rolled.newVersion}、原版标已回滚=${rolledBackMarked}、历史指标保留=${metricsKept}、自动入同步队列=${syncQueued}、知识管理员回滚被拒=${mgrRollback}`,
  );
}

// ---------- FLOW-05：数据看板三页签 + 信号矩阵 ----------
{
  const { ctx, page } = await loginAs('chendi@coolfly.com');
  await go(page, 'dash');
  const t1 = await page.locator('.content').innerText();
  const lowRed = t1.includes('配件兼容');
  const sampleShort = t1.includes('样本积累中');
  await page.locator('.tab', { hasText: '知识缺口' }).click();
  await page.waitForTimeout(700);
  const t2 = await page.locator('.content').innerText();
  const hasGap = t2.includes('未覆盖') && (t2.includes('return shipping') || t2.includes('refund how long'));
  await page.locator('.tab', { hasText: '客服工作数据' }).click();
  await page.waitForTimeout(700);
  const t3 = await page.locator('.content').innerText();
  const exploreOnly = t3.includes('Explore') && !t3.includes('首次响应中位') && !/CSAT\s*[:：]\s*\d/.test(t3);

  await go(page, 'feedback');
  const t4 = await page.locator('.content').innerText();
  const fourChannels = ['AI bot 自动回答', '人工工单', '用户自助浏览', '客服主动反馈'].every((s) => t4.includes(s));
  const certainty = t4.includes('待核实') && t4.includes('必得');
  const fiveSources = ['客服 flag', '文章被踩', 'bot 未解决', '高频无覆盖', '搜索无结果'].every((s) => t4.includes(s));
  record(
    'FLOW-05',
    lowRed && sampleShort && hasGap && exploreOnly && fourChannels && certainty && fiveSources,
    `低覆盖场景可见=${lowRed}、样本积累中=${sampleShort}、缺口与无结果关键词=${hasGap}、客服工作数据仅 Explore 指向=${exploreOnly}、信号四渠道=${fourChannels}、确定性档位=${certainty}、五来源候选=${fiveSources}`,
  );
  await ctx.close();
}

// ---------- FLOW-06：翻译状态机 ----------
{
  const { ctx, page } = await loginAs('wangwen@coolfly.com');
  const r = await page.evaluate(async () => {
    const create = await fetch('/api/kb/entries', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `E2E 翻译状态机 ${Date.now().toString().slice(-5)}`, libraryId: 'lib_policy', chapterId: 'ch_refund',
        entryType: 'FAQ 政策型', visibility: 'mixed', sceneL1: '售后与退款', sceneL2: '退款时限',
        labels: ['退款'], deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [
          { id: 'p0', text: '退款时限', internal: false, heading: true },
          { id: 'p1', text: '非质量问题：签收后 5 天内可退。', internal: false, heading: false },
          { id: 'p2', text: '内部：超时个案走主管审批，额度上限 $80。', internal: true, heading: false },
        ] },
      }),
    });
    const e = await create.json();
    const t = await (await fetch(`/api/kb/entries/${e.id}/translate`, { method: 'POST', credentials: 'include' })).json();
    const afterTranslate = await (await fetch(`/api/kb/entries/${e.id}`, { credentials: 'include' })).json();
    const c = await (await fetch(`/api/kb/entries/${e.id}/translation/confirm`, { method: 'POST', credentials: 'include' })).json();
    // 中文改动 → 英文置 stale + 同步阻断
    const latest = await (await fetch(`/api/kb/entries/${e.id}`, { credentials: 'include' })).json();
    await fetch(`/api/kb/entries/${e.id}`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: latest.entry.title, libraryId: 'lib_policy', chapterId: 'ch_refund', entryType: 'FAQ 政策型',
        visibility: 'mixed', sceneL1: '售后与退款', sceneL2: '退款时限', labels: ['退款'],
        deviceModels: [], reviewCycleDays: 180, ownerId: null,
        body: { paragraphs: [
          { id: 'p0', text: '退款时限（已改口径）', internal: false, heading: true },
          { id: 'p1', text: '非质量问题：签收后 3 天内可退。', internal: false, heading: false },
          { id: 'p2', text: '内部：超时个案走主管审批，额度上限 $80。', internal: true, heading: false },
        ] },
        expectedVersion: latest.entry.lockVersion,
      }),
    });
    const afterEdit = await (await fetch(`/api/kb/entries/${e.id}`, { credentials: 'include' })).json();
    return {
      afterTranslateStatus: t.enStatus,
      internalNotTranslated: afterTranslate.pairs.filter((p) => p.internal).every((p) => !p.en),
      confirmed: c.enStatus,
      afterEditEn: afterEdit.entry.enStatus,
      gateChecks: (await (await fetch(`/api/review/${e.id}/gate`, { credentials: 'include' })).json()).checks.map((c) => c.key),
    };
  });
  const gateThree = r.gateChecks.length === 3 && !r.gateChecks.includes('proxy_eval');
  record(
    'FLOW-06',
    r.afterTranslateStatus === 'pending_human' && r.internalNotTranslated && r.confirmed === 'confirmed' &&
      r.afterEditEn === 'stale' && gateThree,
    `翻译后=${r.afterTranslateStatus}、内部段落未翻译=${r.internalNotTranslated}、人工确认=${r.confirmed}、中文改动后英文=${r.afterEditEn}、门禁三查=${r.gateChecks.join('/')}`,
  );
  await ctx.close();
}

// ---------- FLOW-07：总览多库 / 结构树 / 筛选 / 复核 / 章节保护 ----------
{
  const { ctx, page } = await loginAs('wangwen@coolfly.com');
  await go(page, 'kb');
  const text = await page.locator('.content').innerText();
  const threeLibs = ['政策与售后知识库', '产品与使用知识库', '客服话术库'].every((s) => text.includes(s));
  const internalNote = text.includes('不对外公开');
  const sectionRef = text.includes('Sec 51');
  const mappingNote = text.includes('Help Center brand');
  const overdue = text.includes('复核已到期');
  // 三级结构树：目录行 → 章节行 → 条目行（树内仅已发布）
  const onlyPublishedBadge = text.includes('仅已发布');
  const toolbar = ['新建目录', '新建章节', '调整层级'].every((s) => text.includes(s));
  const leafCount = await page.locator('.tree__row--leaf').count();
  await page.locator('.tree__row--child').first().locator('.tree__caret').click();
  await page.waitForTimeout(400);
  const leafAfterCollapse = await page.locator('.tree__row--leaf').count();
  await page.locator('.tree__row--child').first().locator('.tree__caret').click();
  await page.waitForTimeout(400);
  // 调整层级：把「退款与退货」移到「订单与物流」目录下再移回
  const moveResp = await page.evaluate(async () => {
    const to = await (await fetch('/api/kb/tree?libraryId=lib_policy', { credentials: 'include' })).json();
    const target = to.find((t) => t.name !== '售后政策');
    const r = await fetch('/api/kb/chapters/ch_refund/parent', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: target.id }),
    });
    const ok = r.status;
    const back = await (await fetch('/api/kb/tree?libraryId=lib_policy', { credentials: 'include' })).json();
    const moved = back.find((t) => t.id === target.id).children.some((c) => c.id === 'ch_refund');
    // 还原，避免污染后续断言
    await fetch('/api/kb/chapters/ch_refund/parent', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: 'ch_after' }),
    });
    return { ok, moved };
  });
  // 组合筛选
  const dueSelect = page.locator('select').filter({ hasText: '复核' }).first();
  const selectCount = await page.locator('select').count();
  // 含条目章节删除拦截（API 层验证界面提示来源）
  const delResp = await page.evaluate(async () => {
    const r = await fetch('/api/kb/chapters/ch_refund', { method: 'DELETE', credentials: 'include' });
    return { status: r.status, msg: (await r.json()).message };
  });
  record(
    'FLOW-07',
    threeLibs && internalNote && sectionRef && mappingNote && overdue && selectCount >= 3 &&
      onlyPublishedBadge && toolbar && leafCount > 0 && leafAfterCollapse < leafCount && moveResp.ok === 200 && moveResp.moved &&
      delResp.status === 409 && delResp.msg.includes('移空'),
    `三库可切换=${threeLibs}、仅内部库说明=${internalNote}、Section 映射标识=${sectionRef}、映射说明条=${mappingNote}、超期标注=${overdue}、筛选器=${selectCount} 个、「仅已发布」徽章=${onlyPublishedBadge}、结构工具条三按钮=${toolbar}、三级树条目行=${leafCount} 个（折叠后 ${leafAfterCollapse}）、调整层级=${moveResp.ok}/移动生效=${moveResp.moved}、含条目章节删除拦截=${delResp.status}「${delResp.msg.slice(0, 24)}…」`,
  );
  await ctx.close();
}

await browser.close();

console.log('\n================ 汇总 ================');
const pass = results.filter((r) => r.ok).length;
console.log(`${pass}/${results.length} 通过`);
for (const r of results.filter((x) => !x.ok)) console.log(`  未通过：${r.id} — ${r.detail}`);
process.exit(pass === results.length ? 0 : 1);
