/**
 * LLM 能力层（技术方案 §6）——六个用途：
 * 中→英翻译 / 会话主题提炼 / 挖掘候选起草 / 整理建议（标签·场景·章节归类）/
 * 条目 AI 摘要（发布时生成）/ 挖掘语义查重判定。
 *
 * 供应商：**阿里云百炼 · 通义千问**（08-05-2026 用户拍板，取代原 Anthropic Claude），
 * 走 DashScope 的 OpenAI 兼容端点（`/chat/completions`），零 SDK、原生 fetch。
 * 两档模型分工沿用原「重任务/轻任务」思路：
 *   - QWEN_MODEL（默认 qwen3.5-plus）：翻译 / 主题提炼 / 起草 / 摘要 / 查重判定
 *   - QWEN_MODEL_LIGHT（默认 qwen3.5-flash）：标签与归类建议等结构化小任务
 *
 * `enable_thinking: false` 是必须的：qwen3.5 默认开思考模式，实测翻一句话要 1671 个输出
 * token（关掉后 28 个）。本台全是确定性批处理，不需要思维链，开着纯烧钱。
 *
 * QWEN_API_KEY 未配置时启用**本地确定性 provider**：产出带 `[local]` 前缀，
 * 界面与 /healthz 如实显示「AI 服务：本地模式」——不冒充真实模型输出。
 * 任一 provider 失败均按 PRD §7.1 状态矩阵处理（翻译失败保留上次英文并阻断同步；批次标失败）。
 */

export interface TranslateSegment {
  paragraphId: string;
  zh: string;
}

export interface TranslateResult {
  paragraphId: string;
  en: string;
}

export interface DraftResult {
  title: string;
  body: string;
  summary: string;
}

/** 会话主题提炼结果（挖掘管道第一步，取代原写死的主题池） */
export interface DerivedTopic {
  topic: string;
  summary: string;
  /** 该主题命中的会话条数（频次准入的分子） */
  count: number;
}

/** 整理建议（建议态：不写正文，运营逐项采纳/修改/拒绝） */
export interface OrganizeSuggestion {
  labels: string[];
  sceneL1: string;
  sceneL2: string;
  chapterName: string;
  reason: string;
  /** true = 未走真实模型（LLM 不可用），界面须如实标注「AI 建议未生效」 */
  degraded: boolean;
}

/** 语义查重的候选比对项：只带标题与 AI 摘要，不传全文（控 token） */
export interface DedupeCandidate {
  code: string;
  title: string;
  summary: string;
}

export interface DedupeVerdict {
  /** 比中的既有条目标识；无可比对项时为 null */
  code: string | null;
  /** 0–1，与 TUNABLES.dedupeThreshold 比较 */
  similarity: number;
  reason: string;
  /** true = 未走真实语义判定（LLM 不可用），界面须如实标注「语义查重未生效」 */
  degraded: boolean;
}

export interface LlmProvider {
  readonly mode: 'qwen' | 'local';
  translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]>;
  /** 从真实客服会话正文提炼主题（已脱敏文本进来） */
  extractTopics(conversations: string[]): Promise<DerivedTopic[]>;
  draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult>;
  /** 整理建议：标签 / 两级问题场景 / 章节归类（建议态） */
  suggestOrganize(title: string, body: string, chapters: string[], scenes: string[]): Promise<OrganizeSuggestion>;
  /** 条目 AI 摘要：2–3 句中文，发布时生成 */
  summarizeEntry(title: string, body: string): Promise<string>;
  /** 语义查重判定：从粗筛出的候选里选最像的一条并给出理由 */
  judgeDuplicate(topic: string, sourceSummary: string, candidates: DedupeCandidate[]): Promise<DedupeVerdict>;
}

/**
 * 字面相似度（字符二元组 Jaccard）——两个用途：
 * ①粗筛：把 LLM 判定的候选压到 TUNABLES.dedupeShortlist 条；
 * ②降级：LLM 不可用时的兜底分值（此时 degraded=true，界面如实标注）。
 */
export function literalSimilarity(a: string, b: string): number {
  const grams = (t: string): Set<string> => {
    const clean = t.replace(/\s+/g, '').toLowerCase();
    const out = new Set<string>();
    for (let i = 0; i < clean.length - 1; i += 1) out.add(clean.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return Number((inter / (ga.size + gb.size - inter)).toFixed(4));
}

const GLOSSARY: Array<[RegExp, string]> = [
  [/退款政策/g, 'Refund policy'],
  [/退款时限/g, 'Refund window'],
  [/退货运费/g, 'Return shipping'],
  [/保修/g, 'Warranty'],
  [/会员/g, 'Membership'],
  [/订单/g, 'Order'],
  [/配对/g, 'Pairing'],
  [/太阳能/g, 'Solar'],
  [/适用范围/g, 'Scope'],
  [/办理流程/g, 'How to request'],
  [/签收后/g, 'after delivery'],
  [/质量问题/g, 'quality issues'],
  [/天内/g, ' days'],
];

class LocalProvider implements LlmProvider {
  readonly mode = 'local' as const;

  async translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]> {
    return segments.map((s) => {
      let out = s.zh;
      for (const [re, en] of GLOSSARY) out = out.replace(re, en);
      return { paragraphId: s.paragraphId, en: `[local] ${out}` };
    });
  }

  /**
   * 本地模式不做语义提炼——按会话首句粗聚合，产物带 [local] 前缀。
   * 无真实语料时返回空集，界面标「无新候选」——绝不用假主题冒充挖掘结果。
   */
  async extractTopics(conversations: string[]): Promise<DerivedTopic[]> {
    const bucket = new Map<string, number>();
    for (const c of conversations) {
      const head = c.replace(/\s+/g, ' ').trim().split(/[。！？.!?]/)[0]?.slice(0, 28) ?? '';
      if (head.length < 4) continue;
      bucket.set(head, (bucket.get(head) ?? 0) + 1);
    }
    return [...bucket.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({
        topic: `[local] ${topic}`,
        summary: `[local] 按首句粗聚合，共 ${count} 条会话——本地模式未做语义提炼`,
        count,
      }));
  }

  async draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult> {
    return {
      title: topic,
      body: `[local] 针对「${topic}」的草稿：\n1. 现象说明。\n2. 处理步骤。\n3. 例外与升级路径。\n来源摘要：${sourceSummary}`,
      summary: `[local] 由 ${sourceSummary} 聚类生成的候选摘要`,
    };
  }

  async suggestOrganize(
    title: string,
    _body: string,
    chapters: string[],
    scenes: string[],
  ): Promise<OrganizeSuggestion> {
    return {
      labels: title
        .split(/[\s，。、/]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 5),
      sceneL1: scenes[0] ?? '',
      sceneL2: '',
      chapterName: chapters[0] ?? '',
      reason: '本地模式未做语义归类——标签取自标题分词、场景与章节取默认值，请人工确认',
      degraded: true,
    };
  }

  async summarizeEntry(title: string, body: string): Promise<string> {
    const head = body.replace(/\s+/g, ' ').trim().slice(0, 120);
    return `[local] 「${title}」摘要：${head}`;
  }

  /** 本地模式不做语义判定——退回字面相似度并标 degraded，界面据此提示「语义查重未生效」 */
  async judgeDuplicate(topic: string, _sourceSummary: string, candidates: DedupeCandidate[]): Promise<DedupeVerdict> {
    let best: DedupeVerdict = { code: null, similarity: 0, reason: '无可比对的既有条目', degraded: true };
    for (const c of candidates) {
      const sim = literalSimilarity(topic, `${c.title} ${c.summary}`);
      if (sim > best.similarity) {
        best = {
          code: c.code,
          similarity: sim,
          reason: `字面相似度 ${sim}（与「${c.title}」比对）——本地模式未做语义判定`,
          degraded: true,
        };
      }
    }
    return best;
  }
}

const DEFAULT_BASE = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const CALL_TIMEOUT_MS = 60_000;
const MAX_RETRY = 2;

class QwenProvider implements LlmProvider {
  readonly mode = 'qwen' as const;
  private readonly base: string;
  private readonly heavy: string;
  private readonly light: string;

  constructor(private apiKey: string) {
    this.base = (process.env.QWEN_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
    this.heavy = process.env.QWEN_MODEL ?? 'qwen3.5-plus';
    this.light = process.env.QWEN_MODEL_LIGHT ?? 'qwen3.5-flash';
  }

  private async call(system: string, user: string, light = false): Promise<string> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
      try {
        return await this.once(system, user, light);
      } catch (err) {
        lastErr = err as Error;
        // 429/5xx/超时值得重试；4xx 参数或鉴权错误重试无意义，直接抛
        const retryable = /HTTP (429|5\d\d)|超时|fetch failed|network/i.test(lastErr.message);
        if (!retryable || attempt === MAX_RETRY) throw lastErr;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastErr ?? new Error('千问调用失败');
  }

  private async once(system: string, user: string, light: boolean): Promise<string> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), CALL_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.base}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          model: light ? this.light : this.heavy,
          // temperature 0：摘要与查重判定必须可复现，否则同一对输入会在 0.85 阈值两侧翻转
          temperature: 0,
          // 关思考模式：本台全是确定性批处理，开着输出 token 会涨约 60 倍
          enable_thinking: false,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`千问 API 错误（HTTP ${res.status}）${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (data.error) throw new Error(`千问 API 错误：${data.error.message ?? '未知'}`);
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('千问返回为空');
      return text;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw new Error(`千问调用超时（${CALL_TIMEOUT_MS}ms）`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]> {
    const raw = await this.call(
      '你是 COOLFLY 客服知识库的中译英译者。逐段翻译为北美用户可读的英文，保持政策口径与数字不变。只输出 JSON 数组，元素为 {"paragraphId":"...","en":"..."}，不要任何解释或代码围栏。',
      JSON.stringify(segments),
    );
    return JSON.parse(extractJson(raw)) as TranslateResult[];
  }

  async extractTopics(conversations: string[]): Promise<DerivedTopic[]> {
    if (conversations.length === 0) return [];
    const raw = await this.call(
      '你在为 COOLFLY 智能硬件（喂鸟器/户外摄像头）客服团队做会话挖掘。从下列客服会话中归纳用户反复问的问题主题，同一件事合并为一条。只输出 JSON 数组，元素为 {"topic":"一句话主题","summary":"该主题的现象与用户诉求概括","count":命中会话数}，按 count 降序，最多 10 条，不要任何解释或代码围栏。',
      conversations
        .slice(0, 200)
        .map((c, i) => `#${i + 1} ${c.replace(/\s+/g, ' ').slice(0, 400)}`)
        .join('\n'),
    );
    const parsed = JSON.parse(extractJson(raw)) as DerivedTopic[];
    return parsed
      .filter((t) => t.topic?.trim())
      .map((t) => ({
        topic: t.topic.trim(),
        summary: t.summary?.trim() ?? '',
        count: Math.max(1, Number(t.count) || 1),
      }));
  }

  async draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult> {
    const raw = await this.call(
      '你是知识库编辑。根据客服会话聚类结果起草一条知识条目草稿，正文分点写明现象、处理步骤、例外与升级路径。只输出 JSON：{"title":"...","body":"...","summary":"..."}，不要任何解释或代码围栏。',
      `主题：${topic}\n来源摘要：${sourceSummary}`,
    );
    return JSON.parse(extractJson(raw)) as DraftResult;
  }

  async suggestOrganize(
    title: string,
    body: string,
    chapters: string[],
    scenes: string[],
  ): Promise<OrganizeSuggestion> {
    const raw = await this.call(
      '你在给客服知识条目做归类建议。基于标题与正文，给出：不超过 5 个中文检索标签、一级问题场景（必须从给定清单里选）、二级问题场景（自拟简短词）、最合适的归属章节（必须从给定清单里选）。只输出 JSON：{"labels":[],"sceneL1":"","sceneL2":"","chapterName":"","reason":"一句中文理由"}，不要任何解释或代码围栏。',
      `标题：${title}\n正文：${body.slice(0, 1500)}\n可选一级场景：${scenes.join(' / ')}\n可选章节：${chapters.join(' / ')}`,
      true,
    );
    const p = JSON.parse(extractJson(raw)) as Omit<OrganizeSuggestion, 'degraded'>;
    return {
      labels: (p.labels ?? []).slice(0, 5),
      // 模型可能自由发挥，落回给定清单内，防止产出库里不存在的场景/章节
      sceneL1: scenes.includes(p.sceneL1) ? p.sceneL1 : (scenes[0] ?? ''),
      sceneL2: p.sceneL2 ?? '',
      chapterName: chapters.includes(p.chapterName) ? p.chapterName : (chapters[0] ?? ''),
      reason: p.reason ?? '',
      degraded: false,
    };
  }

  async summarizeEntry(title: string, body: string): Promise<string> {
    const raw = await this.call(
      '你是 COOLFLY 客服知识库编辑。用 2–3 句简体中文概括这条知识的适用场景与核心口径，供内部语义查重比对使用。只输出 JSON：{"summary":"..."}，不要任何解释或代码围栏。',
      `标题：${title}\n正文：${body.slice(0, 3000)}`,
    );
    const parsed = JSON.parse(extractJson(raw)) as { summary: string };
    return parsed.summary;
  }

  async judgeDuplicate(topic: string, sourceSummary: string, candidates: DedupeCandidate[]): Promise<DedupeVerdict> {
    if (candidates.length === 0) {
      return { code: null, similarity: 0, reason: '无可比对的既有条目', degraded: false };
    }
    const raw = await this.call(
      '你在给客服知识库做查重。判断待沉淀的新主题是否与某条既有条目讲的是同一件事。相似度 0–1：1=同一问题同一口径，0=完全无关。只输出 JSON：{"code":"KB-xxxx 或 null","similarity":0.0,"reason":"一句中文理由"}，不要任何解释或代码围栏。',
      `新主题：${topic}\n来源摘要：${sourceSummary}\n既有条目：\n${candidates
        .map((c) => `- ${c.code}｜${c.title}｜${c.summary}`)
        .join('\n')}`,
    );
    const parsed = JSON.parse(extractJson(raw)) as { code: string | null; similarity: number; reason: string };
    return {
      code: parsed.code,
      similarity: Number(Math.max(0, Math.min(1, parsed.similarity)).toFixed(4)),
      reason: parsed.reason,
      degraded: false,
    };
  }
}

function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1]! : text;
  const m = body.match(/[[{][\s\S]*[\]}]/);
  return m ? m[0] : body;
}

let provider: LlmProvider | null = null;

export function getLlm(): LlmProvider {
  if (provider) return provider;
  // 强制本地：同 ZENDESK_FORCE_SANDBOX，供 E2E 与离线开发使用（避免真金白银的调用）
  if (process.env.LLM_FORCE_LOCAL === '1') {
    provider = new LocalProvider();
    return provider;
  }
  const key = process.env.QWEN_API_KEY;
  provider = key ? new QwenProvider(key) : new LocalProvider();
  return provider;
}

/** 测试用：切换 provider 后需重置单例 */
export function resetLlmCache(): void {
  provider = null;
}
