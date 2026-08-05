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
  body: Record<string, unknown> | null;
}

/** 桩 fetch：记录每次调用，按 url 返回对应假响应；oauthStatus/articleStatus 供失败路径构造 */
function stubFetch(opts: { articleStatus?: number[]; token?: string; expiresIn?: number } = {}) {
  const calls: Call[] = [];
  const articleStatus = [...(opts.articleStatus ?? [])];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({
      url,
      auth: headers.Authorization ?? '',
      body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : null,
    });
    const nullHeaders = { get: () => null };
    if (url.endsWith('/oauth/tokens')) {
      return {
        ok: true,
        status: 200,
        headers: nullHeaders,
        json: async () => ({ access_token: opts.token ?? 'tok_1', expires_in: opts.expiresIn ?? 1800 }),
      };
    }
    const status = articleStatus.shift() ?? 201;
    return {
      ok: status < 400,
      status,
      headers: nullHeaders,
      json: async () => ({ article: { id: 907, updated_at: '2026-08-05T02:00:00Z' } }),
    };
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

  it('默认 zh-cn，英文译文单独走 en-us translations', async () => {
    const calls = stubFetch();
    const { getZendesk } = await loadZendesk();
    await getZendesk().upsertArticle({ ...PUSH, enBodyHtml: '<p>Full refund within 30 days.</p>' });
    const create = calls.find((c) => c.url.includes('/articles.json'))!.body as { article: { locale: string } };
    expect(create.article.locale).toBe('zh-cn');
    const trans = calls.find((c) => c.url.includes('/translations.json'))!.body as {
      translation: { locale: string };
    };
    expect(trans.translation.locale).toBe('en-us');
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
