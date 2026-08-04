import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentHash } from '../core/content.js';

/**
 * Zendesk 集成层（技术方案 §4.4）——REST API 直连，零 SDK。
 *
 * 凭据（ZENDESK_SUBDOMAIN / ZENDESK_EMAIL / ZENDESK_API_TOKEN）为 deployment-secret。
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
}

export interface ZendeskClient {
  readonly mode: 'sandbox' | 'live';
  upsertArticle(input: PushInput): Promise<ZendeskArticle>;
  archiveArticle(articleRef: string): Promise<void>;
  getArticle(articleRef: string): Promise<ZendeskArticle | null>;
  listSections(): Promise<Array<{ id: string; name: string }>>;
  fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }>;
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
  private sections = new Map<string, string>([
    ['Sec 5101', '退款与退货'],
    ['Sec 5102', '保修与换新'],
    ['Sec 5110', '发货与签收'],
    ['Sec 5120', '会员计费'],
    ['Sec 5130', 'Wi-Fi 配对'],
    ['Sec 5140', '太阳能'],
    ['Sec 5201', '退款沟通话术（内部）'],
  ]);
  /** 注入型故障：供 RULE-06 构造同步失败与 429 限流 */
  failNext = new Map<string, { status: number; retryAfterSec?: number; times: number }>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(this.stateFile)) return;
    try {
      const raw = JSON.parse(readFileSync(this.stateFile, 'utf8')) as Record<string, ZendeskArticle>;
      this.articles = new Map(Object.entries(raw));
    } catch {
      this.articles = new Map();
    }
  }

  private persist(): void {
    writeFileSync(this.stateFile, JSON.stringify(Object.fromEntries(this.articles), null, 2), 'utf8');
  }

  async upsertArticle(input: PushInput): Promise<ZendeskArticle> {
    this.maybeFail(input.entryCode);
    if (!this.sections.has(input.sectionRef)) {
      throw new ZendeskApiError(
        `目标 Section 不存在（${input.sectionRef}）——请先在章节管理修复映射，本台不自动创建未经确认的 Zendesk 结构`,
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
    return [...this.sections.entries()].map(([id, name]) => ({ id, name }));
  }

  async fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }> {
    this.maybeFail('__fetch__');
    const seed = new Date(sinceIso).getUTCDate();
    return {
      email: 18 + (seed % 7),
      chat: 11 + (seed % 6),
      items: [],
    };
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

/** 真实 Zendesk（Guide/Support REST API，Node 原生 fetch，429 读 Retry-After 退避） */
class LiveZendesk implements ZendeskClient {
  readonly mode = 'live' as const;
  private base: string;
  private auth: string;

  constructor(subdomain: string, email: string, token: string) {
    this.base = `https://${subdomain}.zendesk.com/api/v2`;
    this.auth = 'Basic ' + Buffer.from(`${email}/token:${token}`).toString('base64');
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get('Retry-After') ?? '60');
      throw new ZendeskApiError('Zendesk API 429 限流', 429, retry);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ZendeskApiError('Zendesk 凭据失效或权限不足——请联系内部技术团队（owner）', res.status);
    }
    if (!res.ok) {
      throw new ZendeskApiError(`Zendesk 接口错误（HTTP ${res.status}）`, res.status);
    }
    return (await res.json()) as T;
  }

  async upsertArticle(input: PushInput): Promise<ZendeskArticle> {
    const payload = {
      article: {
        title: input.title,
        body: input.publicHtml,
        label_names: input.labels,
        user_segment_id: input.internalOnly ? process.env.ZENDESK_AGENT_SEGMENT_ID : null,
        locale: 'zh-cn',
      },
    };
    const data = await this.call<{ article: { id: number; updated_at: string } }>(
      `/help_center/sections/${input.sectionRef}/articles.json`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
    if (input.enBodyHtml) {
      await this.call(`/help_center/articles/${data.article.id}/translations.json`, {
        method: 'POST',
        body: JSON.stringify({
          translation: { locale: 'en-us', title: input.enTitle ?? input.title, body: input.enBodyHtml },
        }),
      });
    }
    return {
      id: String(data.article.id),
      sectionId: input.sectionRef,
      title: input.title,
      bodyHtml: input.publicHtml,
      labels: input.labels,
      userSegmentId: input.internalOnly ? (process.env.ZENDESK_AGENT_SEGMENT_ID ?? null) : null,
      translations: input.enBodyHtml
        ? { 'en-us': { title: input.enTitle ?? input.title, bodyHtml: input.enBodyHtml } }
        : {},
      draft: false,
      updatedAt: data.article.updated_at,
      updatedBy: 'COOLFLY 知识运营中台',
    };
  }

  async archiveArticle(articleRef: string): Promise<void> {
    await this.call(`/help_center/articles/${articleRef}.json`, {
      method: 'PUT',
      body: JSON.stringify({ article: { draft: true } }),
    });
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

  async fetchConversations(sinceIso: string): Promise<{ email: number; chat: number; items: string[] }> {
    const start = Math.floor(new Date(sinceIso).getTime() / 1000);
    const data = await this.call<{ tickets: Array<{ id: number; via?: { channel?: string }; description?: string }> }>(
      `/incremental/tickets.json?start_time=${start}`,
    );
    const email = data.tickets.filter((t) => t.via?.channel !== 'chat').length;
    const chat = data.tickets.filter((t) => t.via?.channel === 'chat').length;
    return { email, chat, items: data.tickets.map((t) => t.description ?? '') };
  }
}

let client: ZendeskClient | null = null;

export function getZendesk(): ZendeskClient {
  if (client) return client;
  const sub = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const token = process.env.ZENDESK_API_TOKEN;
  client = sub && email && token ? new LiveZendesk(sub, email, token) : new SandboxZendesk();
  return client;
}

export function getSandbox(): SandboxZendesk {
  const c = getZendesk();
  if (c.mode !== 'sandbox') throw new Error('当前为 live 模式，无沙箱注入能力');
  return c as SandboxZendesk;
}

export { contentHash };
