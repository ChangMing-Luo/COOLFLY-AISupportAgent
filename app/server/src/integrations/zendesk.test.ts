import { existsSync, unlinkSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * live 模式集成层单测——无真实凭据、无数据库依赖，只桩掉 fetch 验证调用契约。
 * getZendesk() 内有模块级单例，故每例先 resetModules 再动态 import。
 */

const ENV_KEYS = [
  'ZENDESK_SUBDOMAIN',
  'ZENDESK_EMAIL',
  'ZENDESK_API_TOKEN',
  'ZENDESK_OAUTH_CLIENT_ID',
  'ZENDESK_OAUTH_CLIENT_SECRET',
  'ZENDESK_OAUTH_SCOPE',
  'ZENDESK_AGENT_SEGMENT_ID',
  'ZENDESK_LOCALE',
  'ZENDESK_SANDBOX_FILE',
];

interface Call {
  url: string;
  auth: string;
  method: string;
  body: Record<string, unknown> | null;
}

/** 桩 fetch：记录每次调用，按 url 路由假响应；articleStatus 供失败路径构造 */
function stubFetch(
  opts: {
    articleStatus?: number[];
    token?: string;
    expiresIn?: number;
    sectionArticleCount?: number;
    categorySectionCount?: number;
    sourceLocale?: string;
  } = {},
) {
  const calls: Call[] = [];
  const articleStatus = [...(opts.articleStatus ?? [])];
  const respond = (status: number, payload: unknown) => ({
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => payload,
    text: async () => (status === 204 ? '' : JSON.stringify(payload)),
  });
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const method = (init.method ?? 'GET').toUpperCase();
    calls.push({
      url,
      auth: headers.Authorization ?? '',
      method,
      body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null,
    });
    if (url.endsWith('/oauth/tokens')) {
      return respond(200, { access_token: opts.token ?? 'tok_1', expires_in: opts.expiresIn ?? 1800 });
    }
    if (method === 'DELETE') return respond(204, undefined);
    // 结构端点
    if (/\/help_center\/categories\.json$/.test(url) && method === 'POST') {
      return respond(201, { category: { id: 9001 } });
    }
    if (/\/help_center\/categories\/[^/]+\/sections\.json$/.test(url)) {
      if (method === 'POST') return respond(201, { section: { id: 9002 } });
      return respond(200, { count: opts.categorySectionCount ?? 0, sections: [] });
    }
    // 同一 URL 双语义：GET=查计数（删除防护依据），POST=建文章
    if (/\/help_center\/sections\/[^/]+\/articles\.json$/.test(url) && method === 'GET') {
      return respond(200, { count: opts.sectionArticleCount ?? 0, articles: [] });
    }
    // 改名走 translations（名字存在翻译里，对象上的 name 是只读投影）
    if (/\/help_center\/(categories|sections)\/[^/]+\/translations\/[^/]+\.json$/.test(url) && method === 'PUT') {
      return respond(200, { translation: { title: 'ok' } });
    }
    // 读对象：拿 source_locale（改名前置）
    if (/\/help_center\/categories\/[^/]+\.json$/.test(url) && method === 'GET') {
      return respond(200, { category: { id: 9001, source_locale: opts.sourceLocale ?? 'en-us' } });
    }
    if (/\/help_center\/sections\/[^/]+\.json$/.test(url) && method === 'GET') {
      return respond(200, { section: { id: 9002, source_locale: opts.sourceLocale ?? 'en-us' } });
    }
    if (/\/help_center\/(categories|sections)\/[^/]+\.json$/.test(url) && method === 'PUT') {
      return respond(200, {});
    }
    // 文章端点（既有用例）
    const status = articleStatus.shift() ?? 201;
    return respond(status, { article: { id: 907, updated_at: '2026-08-05T02:00:00Z' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

async function loadZendesk() {
  vi.resetModules();
  return import('./zendesk.js');
}

const PUSH = {
  entryCode: 'KB-0201',
  title: '退款政策',
  publicHtml: '<p>签收后 30 天内可申请全额退款。</p>',
  labels: ['退款', '退货'],
  sectionRef: '51991764632468',
  internalOnly: false,
};

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('凭据分支（getZendesk）', () => {
  it('OAuth 两项齐备时优先走 OAuth，即使 API token 也在', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_EMAIL = '312555102@qq.com';
    process.env.ZENDESK_API_TOKEN = 'legacy_token';
    process.env.ZENDESK_OAUTH_CLIENT_ID = 'knowledge_system';
    process.env.ZENDESK_OAUTH_CLIENT_SECRET = 'secret_value';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    expect(zd.mode).toBe('live');
    await zd.upsertArticle(PUSH);
    expect(calls[0]!.url).toBe('https://ourcoolfly-48181.zendesk.com/oauth/tokens');
    expect(calls[0]!.body).toMatchObject({ grant_type: 'client_credentials', client_id: 'knowledge_system', scope: 'read write' });
    expect(calls[1]!.auth).toBe('Bearer tok_1');
  });

  it('仅 API token 时走 Basic Auth，不取 OAuth 令牌', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_EMAIL = '312555102@qq.com';
    process.env.ZENDESK_API_TOKEN = 'legacy_token';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle(PUSH);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.auth).toBe(
      'Basic ' + Buffer.from('312555102@qq.com/token:legacy_token').toString('base64'),
    );
  });

  it('凭据不全时落沙箱', async () => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_SANDBOX_FILE = 'zendesk-test-not-exists.json';
    const { getZendesk } = await loadZendesk();
    expect(getZendesk().mode).toBe('sandbox');
  });
});

describe('OAuth 令牌生命周期', () => {
  beforeEach(() => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_OAUTH_CLIENT_ID = 'knowledge_system';
    process.env.ZENDESK_OAUTH_CLIENT_SECRET = 'secret_value';
  });

  it('未过期的令牌被复用，不重复取令牌', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    await zd.upsertArticle(PUSH);
    await zd.upsertArticle({ ...PUSH, entryCode: 'KB-0202' });
    expect(calls.filter((c) => c.url.endsWith('/oauth/tokens'))).toHaveLength(1);
  });

  it('401 时强制续取令牌并重试一次', async () => {
    const calls = stubFetch({ articleStatus: [401, 201] });
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle(PUSH);
    const tokenCalls = calls.filter((c) => c.url.endsWith('/oauth/tokens'));
    expect(tokenCalls).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes('/articles.json'))).toHaveLength(2);
  });

  it('续取后仍 401 才按凭据失效抛出，且只重试一次', async () => {
    const calls = stubFetch({ articleStatus: [401, 401] });
    const { getZendesk, ZendeskApiError } = await loadZendesk();
    const err = await getZendesk()
      .upsertArticle(PUSH)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ZendeskApiError);
    expect((err as Error).message).toMatch(/凭据失效/);
    expect((err as InstanceType<typeof ZendeskApiError>).status).toBe(401);
    expect(calls.filter((c) => c.url.includes('/articles.json'))).toHaveLength(2);
  });
});

describe('推送前置硬校验', () => {
  beforeEach(() => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_OAUTH_CLIENT_ID = 'knowledge_system';
    process.env.ZENDESK_OAUTH_CLIENT_SECRET = 'secret_value';
  });

  it('内部条目缺 segment 配置时拒绝推送，且不发出任何请求（数据泄漏零容忍）', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await expect(getZendesk().upsertArticle({ ...PUSH, internalOnly: true })).rejects.toThrow(
      /ZENDESK_AGENT_SEGMENT_ID/,
    );
    expect(calls).toHaveLength(0);
  });

  it('配了 segment 后内部条目正常挂 user_segment_id', async () => {
    process.env.ZENDESK_AGENT_SEGMENT_ID = 'seg_88';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    const article = await getZendesk().upsertArticle({ ...PUSH, internalOnly: true });
    const payload = calls.find((c) => c.url.includes('/articles.json'))!.body as {
      article: { user_segment_id: string };
    };
    expect(payload.article.user_segment_id).toBe('seg_88');
    expect(article.userSegmentId).toBe('seg_88');
  });

  it('对外条目 user_segment_id 恒为 null', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle(PUSH);
    const payload = calls.find((c) => c.url.includes('/articles.json'))!.body as {
      article: { user_segment_id: string | null };
    };
    expect(payload.article.user_segment_id).toBeNull();
  });
});

describe('locale 配置', () => {
  beforeEach(() => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_OAUTH_CLIENT_ID = 'knowledge_system';
    process.env.ZENDESK_OAUTH_CLIENT_SECRET = 'secret_value';
  });

  it('默认 zh-cn，英文译文单独打 en-us 的 translations 端点', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle({ ...PUSH, enBodyHtml: '<p>Full refund within 30 days.</p>' });
    const create = calls.find((c) => c.url.includes('/sections/') && c.url.includes('/articles.json'))!.body as {
      article: { locale: string };
    };
    expect(create.article.locale).toBe('zh-cn');
    // 译文写入走 upsert：先 PUT 指定 locale 的翻译，404 才 POST 创建
    const trans = calls.find((c) => c.url.includes('/translations/en-us.json'));
    expect(trans).toBeDefined();
    expect(trans!.method).toBe('PUT');
  });

  it('传了 enTitle 时英文译文用英文标题，而非回退中文标题', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle({
      ...PUSH,
      enTitle: 'Refund policy',
      enBodyHtml: '<p>Full refund within 30 days.</p>',
    });
    const trans = calls.find((c) => c.url.includes('/translations/en-us.json'))!.body as {
      translation: { title: string };
    };
    expect(trans.translation.title).toBe('Refund policy');
    expect(trans.translation.title).not.toBe(PUSH.title);
  });

  it('传了 articleRef 走更新路径：不再新建文章，改打对象与翻译端点', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle({ ...PUSH, articleRef: '54105583966355', enBodyHtml: '<p>EN</p>' });
    // 重复同步不得再创建文章——否则帮助中心会堆出重复条目
    expect(calls.some((c) => c.url.includes('/sections/') && c.url.includes('/articles.json'))).toBe(false);
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/articles/54105583966355.json'))).toBe(true);
    expect(
      calls.some((c) => c.method === 'PUT' && c.url.includes('/articles/54105583966355/translations/zh-cn.json')),
    ).toBe(true);
  });

  it('ZENDESK_LOCALE 生效', async () => {
    process.env.ZENDESK_LOCALE = 'zh-tw';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle(PUSH);
    const create = calls.find((c) => c.url.includes('/articles.json'))!.body as { article: { locale: string } };
    expect(create.article.locale).toBe('zh-tw');
  });

  it('正文 locale 与英文译文 locale 相同时拒绝推送（防译文覆盖正文）', async () => {
    process.env.ZENDESK_LOCALE = 'en-us';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await expect(
      getZendesk().upsertArticle({ ...PUSH, enBodyHtml: '<p>Full refund within 30 days.</p>' }),
    ).rejects.toThrow(/ZENDESK_LOCALE/);
    expect(calls).toHaveLength(0);
  });

  it('无英文译文时 locale=en-us 不阻断', async () => {
    process.env.ZENDESK_LOCALE = 'en-us';
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle(PUSH);
    expect(calls.filter((c) => c.url.includes('/articles.json'))).toHaveLength(1);
  });
});

describe('结构维护（live：目录→Category、章节→Section）', () => {
  beforeEach(() => {
    process.env.ZENDESK_SUBDOMAIN = 'ourcoolfly-48181';
    process.env.ZENDESK_OAUTH_CLIENT_ID = 'knowledge_system';
    process.env.ZENDESK_OAUTH_CLIENT_SECRET = 'secret_value';
  });

  it('createCategory / createSection 走正确端点并回传 id', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    const cat = await zd.createCategory('产品与使用');
    expect(cat.id).toBe('9001');
    const create = calls.find((c) => c.url.endsWith('/help_center/categories.json'))!;
    expect(create.body).toEqual({ category: { name: '产品与使用' } });
    const sec = await zd.createSection(cat.id, '固件升级');
    expect(sec.id).toBe('9002');
    expect(calls.some((c) => c.url.endsWith(`/help_center/categories/${cat.id}/sections.json`))).toBe(true);
  });

  it('renameSection 走 translations 端点改 title（对象上的 name 是只读投影，PUT 对象改名无效）', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().renameSection('777', '新名字');
    const put = calls.find((c) => c.url.endsWith('/help_center/sections/777/translations/en-us.json'))!;
    expect(put.body).toEqual({ translation: { title: '新名字' } });
    // 防回归：绝不能把改名打到对象端点上（Zendesk 会返 200 但静默不生效）
    expect(calls.some((c) => c.url.endsWith('/help_center/sections/777.json') && c.body !== null)).toBe(false);
  });

  it('renameCategory 同理走 translations，并按对象的 source_locale 定位', async () => {
    const calls = stubFetch({ sourceLocale: 'zh-cn' });
    const { getZendesk } = await loadZendesk();
    await getZendesk().renameCategory('9001', '新目录名');
    const put = calls.find((c) => c.url.includes('/help_center/categories/9001/translations/'))!;
    expect(put.url.endsWith('/translations/zh-cn.json')).toBe(true);
    expect(put.body).toEqual({ translation: { title: '新目录名' } });
  });

  it('moveSection 改 category_id 走对象端点（属元数据，非翻译）', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().moveSection('777', '9001');
    const put = calls.find((c) => c.url.endsWith('/help_center/sections/777.json') && c.body !== null)!;
    expect(put.body).toEqual({ section: { category_id: 9001 } });
  });

  it('deleteSection 兼容 204 空响应；计数端点读 count 字段', async () => {
    const calls = stubFetch({ sectionArticleCount: 3, categorySectionCount: 2 });
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    expect(await zd.sectionArticleCount('777')).toBe(3);
    expect(await zd.categorySectionCount('9001')).toBe(2);
    await expect(zd.deleteSection('777')).resolves.toBeUndefined();
    expect(calls.some((c) => c.url.endsWith('/help_center/sections/777.json'))).toBe(true);
  });
});

describe('结构维护（沙箱：与真实契约同形）', () => {
  beforeEach(() => {
    process.env.ZENDESK_SANDBOX_FILE = `zendesk-sandbox-test-${Math.random().toString(36).slice(2)}.json`;
  });

  afterEach(() => {
    const f = process.env.ZENDESK_SANDBOX_FILE;
    if (f && existsSync(f)) unlinkSync(f);
  });

  it('建目录→建章节→改名→移动→删除 全链路', async () => {
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    expect(zd.mode).toBe('sandbox');
    const cat = await zd.createCategory('测试目录');
    const sec = await zd.createSection(cat.id, '测试章节');
    await zd.renameSection(sec.id, '测试章节改');
    expect((await zd.listSections()).find((s) => s.id === sec.id)?.name).toBe('测试章节改');
    const cat2 = await zd.createCategory('目标目录');
    await zd.moveSection(sec.id, cat2.id);
    expect(await zd.categorySectionCount(cat2.id)).toBe(1);
    expect(await zd.categorySectionCount(cat.id)).toBe(0);
    await zd.deleteSection(sec.id);
    await zd.deleteCategory(cat2.id);
    expect(await zd.categorySectionCount(cat2.id)).toBe(0);
  });

  it('Section 内有文章时 sectionArticleCount 如实计数（删除防护的依据）', async () => {
    const { getZendesk } = await loadZendesk();
    const zd = getZendesk();
    const cat = await zd.createCategory('目录');
    const sec = await zd.createSection(cat.id, '章节');
    await zd.upsertArticle({ ...PUSH, sectionRef: sec.id });
    expect(await zd.sectionArticleCount(sec.id)).toBe(1);
  });

  it('不存在的 Category 下建 Section 报 404（与真实 API 同语义）', async () => {
    const { getZendesk, ZendeskApiError } = await loadZendesk();
    await expect(getZendesk().createSection('cat_ghost', 'x')).rejects.toThrow(ZendeskApiError);
  });
});
