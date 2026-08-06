import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentHash } from '../core/content.js';

/**
 * Zendesk 集成层（技术方案 §4.4）——REST API 直连，零 SDK。
 *
 * 凭据为 deployment-secret，两种认证任选其一（OAuth 优先，scope 可收窄）：
 *  - OAuth client_credentials：ZENDESK_SUBDOMAIN + ZENDESK_OAUTH_CLIENT_ID + ZENDESK_OAUTH_CLIENT_SECRET
 *  - API token（Basic）：ZENDESK_SUBDOMAIN + ZENDESK_EMAIL + ZENDESK_API_TOKEN
 * 未配置凭据时启用**本地沙箱**（TDD 契约 §6 明确：本轮以 Mock/沙箱联调为验收态）——
 * 沙箱实现与真实 API 相同的调用契约与失败语义（429/5xx/凭据失效），
 * 便于在无生产凭据时验证同步、drift 与限流退避链路。
 */

export interface ZendeskArticle {
  id: string;
  sectionId: string;
  title: string;
  bodyHtml: string;
  labels: string[];
  userSegmentId: string | null;
  translations: Record<string, { title: string; bodyHtml: string }>;
  draft: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface PushInput {
  entryCode: string;
  title: string;
  publicHtml: string;
  labels: string[];
  sectionRef: string;
  internalOnly: boolean;
  enTitle?: string;
  enBodyHtml?: string;
  /**
   * 已同步过的文章 id。传了走**更新**路径，不传才创建。
   * 缺它会让「重新下发 / 重试同步」在帮助中心堆出重复文章。
   */
  articleRef?: string | null;
}

export interface ZendeskClient {
  readonly mode: 'sandbox' | 'live';
  upsertArticle(input: PushInput): Promise<ZendeskArticle>;
  archiveArticle(articleRef: string): Promise<void>;
  getArticle(articleRef: string): Promise<ZendeskArticle | null>;
  listSections(): Promise<Array<{ id: string; name: string }>>;
  fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }>;
  /**
   * 结构维护（08-05-2026 拍板：结构只在本台维护并同步 Zendesk）——
   * 目录→Category、章节→Section；删除带防护由调用方先查计数。
   */
  createCategory(name: string): Promise<{ id: string }>;
  renameCategory(categoryRef: string, name: string): Promise<void>;
  deleteCategory(categoryRef: string): Promise<void>;
  categorySectionCount(categoryRef: string): Promise<number>;
  createSection(categoryRef: string, name: string): Promise<{ id: string }>;
  renameSection(sectionRef: string, name: string): Promise<void>;
  moveSection(sectionRef: string, categoryRef: string): Promise<void>;
  deleteSection(sectionRef: string): Promise<void>;
  sectionArticleCount(sectionRef: string): Promise<number>;
  /** 文章投票（帮助中心 up/down）——确定性档位：必得 */
  fetchArticleVotes(articleRef: string): Promise<{ up: number; down: number }>;
  /** 工单解决信号（solved / reopen / CSAT）——确定性档位：工单信号必得 */
  fetchTicketSignals(sinceIso: string): Promise<{ solved: number; reopened: number; csatGood: number; csatBad: number }>;
  /** 帮助中心搜索无结果关键词——档位相关，依订阅；不可得时返回空数组由上层如实标注 */
  fetchNoResultSearches(sinceIso: string): Promise<Array<{ keyword: string; count: number }>>;
}

export class ZendeskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ZendeskApiError';
  }
}

/**
 * 沙箱：Guide/Support 契约实现。
 * 状态落盘（SANDBOX_STATE_FILE）——外部系统的数据不随本服务进程消失，
 * 否则 drift 比对与跨进程联调无法成立。
 */
class SandboxZendesk implements ZendeskClient {
  readonly mode = 'sandbox' as const;
  private stateFile = process.env.ZENDESK_SANDBOX_FILE ?? join(process.cwd(), '.sandbox-zendesk.json');
  private articles = new Map<string, ZendeskArticle>();
  private categories = new Map<string, string>([['cat_general', 'General']]);
  private sections = new Map<string, { name: string; categoryRef: string }>([
    ['Sec 5101', { name: '退款与退货', categoryRef: 'cat_general' }],
    ['Sec 5102', { name: '保修与换新', categoryRef: 'cat_general' }],
    ['Sec 5110', { name: '发货与签收', categoryRef: 'cat_general' }],
    ['Sec 5120', { name: '会员计费', categoryRef: 'cat_general' }],
    ['Sec 5130', { name: 'Wi-Fi 配对', categoryRef: 'cat_general' }],
    ['Sec 5140', { name: '太阳能', categoryRef: 'cat_general' }],
    ['Sec 5201', { name: '退款沟通话术（内部）', categoryRef: 'cat_general' }],
  ]);
  /** 注入型故障：供 RULE-06 构造同步失败与 429 限流（结构操作用 key `__structure__`） */
  failNext = new Map<string, { status: number; retryAfterSec?: number; times: number }>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(this.stateFile)) return;
    try {
      const raw = JSON.parse(readFileSync(this.stateFile, 'utf8')) as {
        articles?: Record<string, ZendeskArticle>;
        categories?: Record<string, string>;
        sections?: Record<string, { name: string; categoryRef: string }>;
      } & Record<string, ZendeskArticle>;
      if (raw.articles) {
        // 新格式：{articles, categories, sections}
        this.articles = new Map(Object.entries(raw.articles));
        if (raw.categories) this.categories = new Map(Object.entries(raw.categories));
        if (raw.sections) this.sections = new Map(Object.entries(raw.sections));
      } else {
        // 旧格式（仅文章平铺）：结构沿用内置默认
        this.articles = new Map(Object.entries(raw as Record<string, ZendeskArticle>));
      }
    } catch {
      this.articles = new Map();
    }
  }

  private persist(): void {
    writeFileSync(
      this.stateFile,
      JSON.stringify(
        {
          articles: Object.fromEntries(this.articles),
          categories: Object.fromEntries(this.categories),
          sections: Object.fromEntries(this.sections),
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  async upsertArticle(input: PushInput): Promise<ZendeskArticle> {
    this.maybeFail(input.entryCode);
    if (!this.sections.has(input.sectionRef)) {
      throw new ZendeskApiError(
        `目标 Section 不存在（${input.sectionRef}）——请先在章节管理修复映射（结构由本台维护并同步）`,
        404,
      );
    }
    const id = `art_${input.entryCode}`;
    const prev = this.articles.get(id);
    const article: ZendeskArticle = {
      id,
      sectionId: input.sectionRef,
      title: input.title,
      bodyHtml: input.publicHtml,
      labels: input.labels,
      userSegmentId: input.internalOnly ? 'seg_agents_only' : null,
      translations: {
        ...(prev?.translations ?? {}),
        ...(input.enBodyHtml
          ? { 'en-us': { title: input.enTitle ?? input.title, bodyHtml: input.enBodyHtml } }
          : {}),
      },
      draft: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'COOLFLY 知识运营中台',
    };
    this.articles.set(id, article);
    this.persist();
    return article;
  }

  async archiveArticle(articleRef: string): Promise<void> {
    const a = this.articles.get(articleRef);
    if (a) {
      this.articles.set(articleRef, { ...a, draft: true, updatedAt: new Date().toISOString() });
      this.persist();
    }
  }

  async getArticle(articleRef: string): Promise<ZendeskArticle | null> {
    this.load();
    return this.articles.get(articleRef) ?? null;
  }

  async listSections(): Promise<Array<{ id: string; name: string }>> {
    return [...this.sections.entries()].map(([id, s]) => ({ id, name: s.name }));
  }

  async createCategory(name: string): Promise<{ id: string }> {
    this.maybeFail('__structure__');
    const id = `cat_${Math.random().toString(36).slice(2, 10)}`;
    this.categories.set(id, name);
    this.persist();
    return { id };
  }

  async renameCategory(categoryRef: string, name: string): Promise<void> {
    this.maybeFail('__structure__');
    if (!this.categories.has(categoryRef)) throw new ZendeskApiError(`Category 不存在（${categoryRef}）`, 404);
    this.categories.set(categoryRef, name);
    this.persist();
  }

  async deleteCategory(categoryRef: string): Promise<void> {
    this.maybeFail('__structure__');
    this.categories.delete(categoryRef);
    this.persist();
  }

  async categorySectionCount(categoryRef: string): Promise<number> {
    return [...this.sections.values()].filter((s) => s.categoryRef === categoryRef).length;
  }

  async createSection(categoryRef: string, name: string): Promise<{ id: string }> {
    this.maybeFail('__structure__');
    if (!this.categories.has(categoryRef)) throw new ZendeskApiError(`Category 不存在（${categoryRef}）`, 404);
    const id = `sec_${Math.random().toString(36).slice(2, 10)}`;
    this.sections.set(id, { name, categoryRef });
    this.persist();
    return { id };
  }

  async renameSection(sectionRef: string, name: string): Promise<void> {
    this.maybeFail('__structure__');
    const s = this.sections.get(sectionRef);
    if (!s) throw new ZendeskApiError(`Section 不存在（${sectionRef}）`, 404);
    this.sections.set(sectionRef, { ...s, name });
    this.persist();
  }

  async moveSection(sectionRef: string, categoryRef: string): Promise<void> {
    this.maybeFail('__structure__');
    const s = this.sections.get(sectionRef);
    if (!s) throw new ZendeskApiError(`Section 不存在（${sectionRef}）`, 404);
    if (!this.categories.has(categoryRef)) throw new ZendeskApiError(`Category 不存在（${categoryRef}）`, 404);
    this.sections.set(sectionRef, { ...s, categoryRef });
    this.persist();
  }

  async deleteSection(sectionRef: string): Promise<void> {
    this.maybeFail('__structure__');
    this.sections.delete(sectionRef);
    this.persist();
  }

  async sectionArticleCount(sectionRef: string): Promise<number> {
    this.load();
    return [...this.articles.values()].filter((a) => a.sectionId === sectionRef).length;
  }

  async fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }> {
    this.maybeFail('__fetch__');
    const seed = new Date(sinceIso).getUTCDate();
    const email = 18 + (seed % 7);
    const chat = 11 + (seed % 6);
    // 沙箱语料：与真实 Zendesk 的 ticket.description 同形（一条会话一段自然语言）。
    // 原来返回空数组，挖掘管道拿不到任何语料——真实链路缺陷被掩盖。
    const templates = [
      '喂鸟器在零下十几度的晚上会自己关机，白天回暖又能开，是不是低温保护？能不能一直开着',
      '我的喂鸟器一到夜里就断电，早上又好了，最近寒潮特别明显，这是坏了吗',
      '跨境订单什么时候开始算退款期限？我的包裹清关花了两周，退款窗口是不是已经过了',
      '国际订单退款起算日到底是下单日还是清关日，客服说法不一致',
      '太阳能板阴天充不满电，固件升级到 2.4 之后更明显了，是不是充电阈值改了',
      '连续阴天太阳能供电撑不住，摄像头半夜就没电，加个 USB 供电行不行',
      '摄像头夜视画面很糊，白天正常，换了角度也没用',
      '设备一直配不上 Wi-Fi，手机连的是 5G 频段，指示灯红色常亮',
    ];
    // 真实会话是长尾分布：头部两三个主题占大头，其余零散。
    // 均匀轮转会让每个主题都只出现 3–4 次、全部达不到频次阈值（≥10 次/周），
    // 挖掘管道的正常路径就永远跑不到——沙箱要能覆盖happy path。
    const weights = [12, 10, 8, 5, 3, 2, 1, 1];
    const items: string[] = [];
    for (let t = 0; t < templates.length; t += 1) {
      const n = Math.max(1, Math.round((weights[t]! * (email + chat)) / 42));
      for (let k = 0; k < n; k += 1) items.push(templates[(t + seed) % templates.length]!);
    }
    return { email, chat, items };
  }

  async fetchArticleVotes(articleRef: string): Promise<{ up: number; down: number }> {
    this.maybeFail('__votes__');
    this.load();
    const a = this.articles.get(articleRef);
    if (!a) return { up: 0, down: 0 };
    // 确定性派生：同一篇文章每次返回同值，便于验收断言
    let h = 0;
    for (const ch of articleRef) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return { up: 20 + (h % 90), down: h % 13 };
  }

  async fetchTicketSignals(sinceIso: string): Promise<{ solved: number; reopened: number; csatGood: number; csatBad: number }> {
    this.maybeFail('__ticket_signals__');
    const seed = new Date(sinceIso).getUTCDate();
    return { solved: 40 + (seed % 15), reopened: 3 + (seed % 4), csatGood: 30 + (seed % 9), csatBad: 4 + (seed % 3) };
  }

  async fetchNoResultSearches(sinceIso: string): Promise<Array<{ keyword: string; count: number }>> {
    this.maybeFail('__no_result__');
    const seed = new Date(sinceIso).getUTCDate();
    return [
      { keyword: 'refund how long', count: 20 + (seed % 9) },
      { keyword: 'solar panel cloudy', count: 12 + (seed % 6) },
      { keyword: 'night vision blurry', count: 9 + (seed % 5) },
    ];
  }

  /** 供测试/演练注入外部故障 */
  injectFailure(key: string, status: number, times = 1, retryAfterSec?: number): void {
    this.failNext.set(key, { status, times, retryAfterSec });
  }

  /** 模拟 Zendesk 端被直接改写（drift 源） */
  simulateRemoteEdit(articleRef: string, newBodyHtml: string, editor: string): void {
    this.load();
    const a = this.articles.get(articleRef);
    if (!a) return;
    this.articles.set(articleRef, {
      ...a,
      bodyHtml: newBodyHtml,
      updatedAt: new Date().toISOString(),
      updatedBy: editor,
    });
    this.persist();
  }

  private maybeFail(key: string): void {
    const f = this.failNext.get(key);
    if (!f || f.times <= 0) return;
    f.times -= 1;
    if (f.times <= 0) this.failNext.delete(key);
    if (f.status === 429) {
      throw new ZendeskApiError('Zendesk API 429 限流', 429, f.retryAfterSec ?? 1);
    }
    throw new ZendeskApiError(`Zendesk 接口错误（HTTP ${f.status}）`, f.status);
  }
}

/** 英文译文固定落位的 Zendesk locale */
const EN_LOCALE = 'en-us';

type LiveAuth =
  | { kind: 'api_token'; email: string; token: string }
  | { kind: 'oauth'; clientId: string; clientSecret: string; scope: string };

/** 真实 Zendesk（Guide/Support REST API，Node 原生 fetch，429 读 Retry-After 退避） */
class LiveZendesk implements ZendeskClient {
  /**
   * 写操作闸门：有凭据 ≠ 允许写生产。
   * 开发机与 E2E 会自动加载 .env 从而连上真实 Zendesk，一旦章节映射填了真实 section id，
   * 发布链路就会往**生产帮助中心**真写文章、真归档。默认只读，
   * 确实要同步生产时显式 `ALLOW_LIVE_SYNC=1`。
   */
  private assertWritable(action: string): void {
    // vitest 里放行：测试的外部凭据已被 globalSetup/setupFiles 擦除、fetch 也被打桩，
    // 两层保护下不可能打到真实端点；而写路径本身（OAuth 取令牌、Basic Auth、401 续取）
    // 必须能被单测覆盖。守卫针对的是开发机/CI 误连生产，不是测试。
    if (process.env.VITEST) return;
    if (process.env.ALLOW_LIVE_SYNC !== '1') {
      throw new ZendeskApiError(
        `已连接真实 Zendesk，但写操作被安全闸拦下（${action}）。确认要写生产帮助中心请设 ALLOW_LIVE_SYNC=1。`,
        403,
      );
    }
  }

  readonly mode = 'live' as const;
  private base: string;
  private origin: string;
  /** OAuth 令牌缓存：2026-04-30 后创建的 client 默认 30 分钟过期，须自动续取 */
  private bearer: { value: string; expiresAt: number } | null = null;
  /** 条目正文所用 locale（须已在 Guide 启用），英文走 translations 分支 */
  private locale = process.env.ZENDESK_LOCALE ?? 'zh-cn';

  constructor(
    subdomain: string,
    private auth: LiveAuth,
  ) {
    this.origin = `https://${subdomain}.zendesk.com`;
    this.base = `${this.origin}/api/v2`;
  }

  /** client_credentials 取令牌（无 refresh_token，过期即重取） */
  private async fetchBearer(): Promise<string> {
    if (this.auth.kind !== 'oauth') throw new Error('非 OAuth 模式');
    const res = await fetch(`${this.origin}/oauth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.auth.clientId,
        client_secret: this.auth.clientSecret,
        scope: this.auth.scope,
      }),
    });
    if (!res.ok) {
      throw new ZendeskApiError(
        `Zendesk OAuth 取令牌失败（HTTP ${res.status}）——请核对 client 唯一标识符/密钥与 scope，并联系内部技术团队（owner）`,
        res.status,
      );
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    // expires_in 缺省 = 该 client 创建于 2026-04-30 前，令牌不过期；仍按天续取，避免长驻进程持有陈旧令牌
    const ttlSec = Number(data.expires_in ?? 0);
    this.bearer = {
      value: data.access_token,
      expiresAt: Date.now() + (ttlSec > 0 ? Math.max(ttlSec - 60, 30) : 86400) * 1000,
    };
    return this.bearer.value;
  }

  private async authHeader(force = false): Promise<string> {
    if (this.auth.kind === 'api_token') {
      return 'Basic ' + Buffer.from(`${this.auth.email}/token:${this.auth.token}`).toString('base64');
    }
    if (force || !this.bearer || Date.now() >= this.bearer.expiresAt) await this.fetchBearer();
    return `Bearer ${this.bearer!.value}`;
  }

  private async call<T>(path: string, init: RequestInit = {}, renewed = false): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: await this.authHeader(),
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get('Retry-After') ?? '60');
      throw new ZendeskApiError('Zendesk API 429 限流', 429, retry);
    }
    if (res.status === 401 && this.auth.kind === 'oauth' && !renewed) {
      // 令牌被提前吊销/过期：强制续取一次再重试，仍失败才按凭据失效告警
      await this.authHeader(true);
      return this.call<T>(path, init, true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ZendeskApiError('Zendesk 凭据失效或权限不足——请联系内部技术团队（owner）', res.status);
    }
    if (!res.ok) {
      throw new ZendeskApiError(`Zendesk 接口错误（HTTP ${res.status}）`, res.status);
    }
    // DELETE 返回 204 无正文；统一按空文本容错
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async upsertArticle(input: PushInput): Promise<ZendeskArticle> {
    this.assertWritable('upsertArticle');
    const segmentId = process.env.ZENDESK_AGENT_SEGMENT_ID ?? null;
    // 数据泄漏零容忍：segment 未配置时 user_segment_id 会被 JSON.stringify 丢弃，
    // Zendesk 按默认（对外公开）建文章——内部知识必须在推送前拦下，而非事后补救
    if (input.internalOnly && !segmentId) {
      throw new ZendeskApiError(
        '内部知识缺少「仅客服」用户细分配置（ZENDESK_AGENT_SEGMENT_ID）——为防内部内容被公开发布，已拒绝推送',
        400,
      );
    }
    if (input.enBodyHtml && this.locale === EN_LOCALE) {
      throw new ZendeskApiError(
        `条目正文 locale 与英文译文 locale 同为 ${EN_LOCALE}（ZENDESK_LOCALE）——译文会覆盖正文，已拒绝推送；请将 ZENDESK_LOCALE 设为条目正文语言（如 zh-cn）并在 Guide 启用该语言`,
        400,
      );
    }
    let articleId: string;
    let updatedAt: string;
    if (input.articleRef) {
      // 更新路径：文章的标题与正文存在 translation 里，对象端点只改元数据
      await this.upsertTranslation(input.articleRef, this.locale, input.title, input.publicHtml);
      const meta = await this.call<{ article: { id: number; updated_at: string } }>(
        `/help_center/articles/${input.articleRef}.json`,
        {
          method: 'PUT',
          body: JSON.stringify({
            article: {
              section_id: Number(input.sectionRef),
              label_names: input.labels,
              user_segment_id: input.internalOnly ? segmentId : null,
              draft: false,
            },
          }),
        },
      );
      articleId = String(meta.article.id);
      updatedAt = meta.article.updated_at;
    } else {
      const payload = {
        article: {
          title: input.title,
          body: input.publicHtml,
          label_names: input.labels,
          user_segment_id: input.internalOnly ? segmentId : null,
          locale: this.locale,
        },
      };
      const data = await this.call<{ article: { id: number; updated_at: string } }>(
        `/help_center/sections/${input.sectionRef}/articles.json`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      articleId = String(data.article.id);
      updatedAt = data.article.updated_at;
    }
    if (input.enBodyHtml) {
      await this.upsertTranslation(articleId, EN_LOCALE, input.enTitle ?? input.title, input.enBodyHtml);
    }
    return {
      id: articleId,
      sectionId: input.sectionRef,
      title: input.title,
      bodyHtml: input.publicHtml,
      labels: input.labels,
      userSegmentId: input.internalOnly ? segmentId : null,
      translations: input.enBodyHtml
        ? { [EN_LOCALE]: { title: input.enTitle ?? input.title, bodyHtml: input.enBodyHtml } }
        : {},
      draft: false,
      updatedAt,
      updatedBy: 'COOLFLY 知识运营中台',
    };
  }

  /**
   * 翻译 upsert：先试 PUT，翻译不存在（404）再 POST 创建。
   * 必须显式带 `draft:false`——被下线过的文章重新发布时，若不复位 draft，
   * 内容会更新但文章仍对客隐藏。
   */
  private async upsertTranslation(
    articleRef: string,
    locale: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.call(`/help_center/articles/${articleRef}/translations/${locale}.json`, {
        method: 'PUT',
        body: JSON.stringify({ translation: { title, body, draft: false } }),
      });
    } catch (err) {
      if (err instanceof ZendeskApiError && err.status === 404) {
        await this.call(`/help_center/articles/${articleRef}/translations.json`, {
          method: 'POST',
          body: JSON.stringify({ translation: { locale, title, body, draft: false } }),
        });
        return;
      }
      throw err;
    }
  }

  /**
   * 下线 = 把文章从对客帮助中心撤下（不裸删）。
   * 文章的 `draft` 是 **translation 上的字段**，对象端点上的 `draft` 只是源翻译的只读投影：
   * `PUT /help_center/articles/{id}.json {article:{draft:true}}` 返回 200 但不生效（08-06-2026 线上实证）。
   * 必须逐个 locale 打 translations 端点，否则「已下线」在中台成立、文章却仍对客可见。
   */
  async archiveArticle(articleRef: string): Promise<void> {
    this.assertWritable('archiveArticle');
    const data = await this.call<{ translations: Array<{ locale: string }> }>(
      `/help_center/articles/${articleRef}/translations.json`,
    );
    const locales = (data.translations ?? []).map((t) => t.locale);
    if (locales.length === 0) locales.push(this.locale);
    for (const locale of locales) {
      await this.call(`/help_center/articles/${articleRef}/translations/${locale}.json`, {
        method: 'PUT',
        body: JSON.stringify({ translation: { draft: true } }),
      });
    }
  }

  async getArticle(articleRef: string): Promise<ZendeskArticle | null> {
    const data = await this.call<{
      article: { id: number; section_id: number; title: string; body: string; label_names: string[]; updated_at: string; draft: boolean };
    }>(`/help_center/articles/${articleRef}.json`);
    const a = data.article;
    return {
      id: String(a.id),
      sectionId: String(a.section_id),
      title: a.title,
      bodyHtml: a.body,
      labels: a.label_names ?? [],
      userSegmentId: null,
      translations: {},
      draft: a.draft,
      updatedAt: a.updated_at,
      updatedBy: 'Zendesk 端',
    };
  }

  async listSections(): Promise<Array<{ id: string; name: string }>> {
    const data = await this.call<{ sections: Array<{ id: number; name: string }> }>(
      '/help_center/sections.json',
    );
    return data.sections.map((s) => ({ id: String(s.id), name: s.name }));
  }

  async createCategory(name: string): Promise<{ id: string }> {
    this.assertWritable('createCategory');
    // 不显式传 locale：跟随帮助中心默认源语言（en-us），中文名先原样落源语言、翻译后续在 Guide 补
    const data = await this.call<{ category: { id: number } }>('/help_center/categories.json', {
      method: 'POST',
      body: JSON.stringify({ category: { name } }),
    });
    return { id: String(data.category.id) };
  }

  /**
   * Category/Section 的名字存在 **translation 的 title** 里，对象上的 `name` 只是按请求 locale 的只读投影。
   * `PUT /help_center/{categories|sections}/{id}.json` 只改元数据（排序位等），改名会静默无效——
   * 必须走 translations 端点，且 locale 取该对象的 source_locale（创建时即存在，避免 PUT 不存在的翻译报 404）。
   */
  private async renameTranslated(kind: 'categories' | 'sections', ref: string, title: string): Promise<void> {
    const data = await this.call<{
      category?: { source_locale?: string };
      section?: { source_locale?: string };
    }>(`/help_center/${kind}/${ref}.json`);
    const locale = (data.category ?? data.section)?.source_locale ?? this.locale;
    await this.call(`/help_center/${kind}/${ref}/translations/${locale.toLowerCase()}.json`, {
      method: 'PUT',
      body: JSON.stringify({ translation: { title } }),
    });
  }

  async renameCategory(categoryRef: string, name: string): Promise<void> {
    this.assertWritable('renameCategory');
    await this.renameTranslated('categories', categoryRef, name);
  }

  async deleteCategory(categoryRef: string): Promise<void> {
    this.assertWritable('deleteCategory');
    await this.call(`/help_center/categories/${categoryRef}.json`, { method: 'DELETE' });
  }

  async categorySectionCount(categoryRef: string): Promise<number> {
    const data = await this.call<{ count: number }>(
      `/help_center/categories/${categoryRef}/sections.json`,
    );
    return data.count;
  }

  async createSection(categoryRef: string, name: string): Promise<{ id: string }> {
    this.assertWritable('createSection');
    const data = await this.call<{ section: { id: number } }>(
      `/help_center/categories/${categoryRef}/sections.json`,
      { method: 'POST', body: JSON.stringify({ section: { name } }) },
    );
    return { id: String(data.section.id) };
  }

  async renameSection(sectionRef: string, name: string): Promise<void> {
    this.assertWritable('renameSection');
    await this.renameTranslated('sections', sectionRef, name);
  }

  async moveSection(sectionRef: string, categoryRef: string): Promise<void> {
    this.assertWritable('moveSection');
    await this.call(`/help_center/sections/${sectionRef}.json`, {
      method: 'PUT',
      body: JSON.stringify({ section: { category_id: Number(categoryRef) } }),
    });
  }

  async deleteSection(sectionRef: string): Promise<void> {
    this.assertWritable('deleteSection');
    await this.call(`/help_center/sections/${sectionRef}.json`, { method: 'DELETE' });
  }

  async sectionArticleCount(sectionRef: string): Promise<number> {
    const data = await this.call<{ count: number }>(
      `/help_center/sections/${sectionRef}/articles.json`,
    );
    return data.count;
  }

  /**
   * 拉近期会话正文。
   * **不能只取 `ticket.description`**：Zendesk Messaging（`via.channel = native_messaging`）的
   * description 只是占位串「Conversation with Web User …」，真正的对话在 comments 里（线上实证）。
   * 因此逐工单取 comments，拼接公开可见的往来内容；同时把 messaging / chat 都算作会话渠道。
   */
  async fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }> {
    const start = Math.floor(new Date(sinceIso).getTime() / 1000);
    const data = await this.call<{
      tickets: Array<{ id: number; subject?: string; via?: { channel?: string }; description?: string }>;
    }>(`/incremental/tickets.json?start_time=${start}`);

    const CHAT_CHANNELS = new Set(['chat', 'native_messaging', 'messaging', 'web_widget', 'any_channel']);
    const tickets = data.tickets ?? [];
    const email = tickets.filter((t) => !CHAT_CHANNELS.has(t.via?.channel ?? '')).length;
    const chat = tickets.length - email;

    const items: string[] = [];
    for (const t of tickets) {
      let text = '';
      try {
        const c = await this.call<{ comments: Array<{ body?: string; public?: boolean }> }>(
          `/tickets/${t.id}/comments.json`,
        );
        text = (c.comments ?? [])
          .filter((m) => m.public !== false)
          .map((m) => (m.body ?? '').trim())
          .filter(Boolean)
          .join('\n');
      } catch {
        text = '';
      }
      // comments 拿不到时退回 description，但把占位串滤掉，避免拿垃圾去喂模型
      if (!text) {
        const d = (t.description ?? '').trim();
        text = /^Conversation with Web User/i.test(d) ? '' : d;
      }
      const full = [t.subject, text].filter(Boolean).join('\n').trim();
      if (full) items.push(full);
    }
    return { email, chat, items };
  }

  /**
   * 文章投票。Zendesk 返回的键是 **`votes`**，不是 `article_votes`——
   * 读错键会让投票恒为 0/0：采纳率永远算不出来，差评也永远回流不了（08-06-2026 线上实证）。
   * 两个键都兜住，避免不同版本/端点的差异再把这条链路打断。
   */
  async fetchArticleVotes(articleRef: string): Promise<{ up: number; down: number }> {
    const data = await this.call<{
      votes?: Array<{ value: number }>;
      article_votes?: Array<{ value: number }>;
    }>(`/help_center/articles/${articleRef}/votes.json?per_page=100`);
    const votes = data.votes ?? data.article_votes ?? [];
    return { up: votes.filter((v) => v.value > 0).length, down: votes.filter((v) => v.value < 0).length };
  }

  async fetchTicketSignals(sinceIso: string): Promise<{ solved: number; reopened: number; csatGood: number; csatBad: number }> {
    const start = Math.floor(new Date(sinceIso).getTime() / 1000);
    const data = await this.call<{
      tickets: Array<{ status?: string; satisfaction_rating?: { score?: string } }>;
    }>(`/incremental/tickets.json?start_time=${start}`);
    const t = data.tickets ?? [];
    return {
      solved: t.filter((x) => x.status === 'solved' || x.status === 'closed').length,
      reopened: t.filter((x) => x.status === 'open').length,
      csatGood: t.filter((x) => x.satisfaction_rating?.score === 'good').length,
      csatBad: t.filter((x) => x.satisfaction_rating?.score === 'bad').length,
    };
  }

  /**
   * 搜索无结果关键词：Zendesk 的帮助中心搜索报表属 Explore 能力，
   * REST 无通用端点——不可得时返回空数组，由上层如实标注「待核实」，绝不编数。
   */
  async fetchNoResultSearches(): Promise<Array<{ keyword: string; count: number }>> {
    return [];
  }
}

let client: ZendeskClient | null = null;

/** OAuth 优先（scope 可收窄至 read write），其次 API token；均不全 → 沙箱 */
export function getZendesk(): ZendeskClient {
  if (client) return client;
  // 强制沙箱：开发机与 E2E 会自动加载 .env（含真实凭据），单靠 `env -u` 挡不住——
  // loadEnvFile 会把变量填回来。这个开关是唯一可靠的「我就是要跑沙箱」表达。
  if (process.env.ZENDESK_FORCE_SANDBOX === '1') {
    client = new SandboxZendesk();
    return client;
  }
  const sub = process.env.ZENDESK_SUBDOMAIN;
  const clientId = process.env.ZENDESK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ZENDESK_OAUTH_CLIENT_SECRET;
  const email = process.env.ZENDESK_EMAIL;
  const token = process.env.ZENDESK_API_TOKEN;
  if (sub && clientId && clientSecret) {
    client = new LiveZendesk(sub, {
      kind: 'oauth',
      clientId,
      clientSecret,
      scope: process.env.ZENDESK_OAUTH_SCOPE ?? 'read write',
    });
  } else if (sub && email && token) {
    client = new LiveZendesk(sub, { kind: 'api_token', email, token });
  } else {
    client = new SandboxZendesk();
  }
  return client;
}

export function getSandbox(): SandboxZendesk {
  const c = getZendesk();
  if (c.mode !== 'sandbox') throw new Error('当前为 live 模式，无沙箱注入能力');
  return c as SandboxZendesk;
}

export { contentHash };
