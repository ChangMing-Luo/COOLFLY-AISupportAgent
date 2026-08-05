/**
 * LLM 能力层（技术方案 §6）——用途：中→英翻译 / 挖掘聚类起草 / 切条与标签建议 /
 * 条目 AI 摘要（发布时生成）/ 挖掘语义查重判定（08-05-2026 取代原向量相似度）。
 *
 * 供应商：Anthropic Claude（架构建议，DPA + 零留存为签约硬条件）。
 * ANTHROPIC_API_KEY 未配置时启用**本地确定性 provider**：产出带 `[local]` 前缀标记，
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
  readonly mode: 'anthropic' | 'local';
  translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]>;
  draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult>;
  suggestLabels(title: string, body: string): Promise<string[]>;
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

  async draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult> {
    return {
      title: topic,
      body: `[local] 针对「${topic}」的草稿：\n1. 现象说明。\n2. 处理步骤。\n3. 例外与升级路径。\n来源摘要：${sourceSummary}`,
      summary: `[local] 由 ${sourceSummary} 聚类生成的候选摘要`,
    };
  }

  async suggestLabels(title: string): Promise<string[]> {
    return title
      .split(/[\s，。、/]+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);
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

class AnthropicProvider implements LlmProvider {
  readonly mode = 'anthropic' as const;
  constructor(private apiKey: string) {}

  private async call(system: string, user: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
        max_tokens: 4096,
        // temperature 0：摘要与查重判定必须可复现，否则同一对输入会在 0.85 阈值两侧翻转
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API 错误（HTTP ${res.status}）`);
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content.map((c) => c.text ?? '').join('');
  }

  async translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]> {
    const raw = await this.call(
      '你是 COOLFLY 客服知识库的中译英译者。逐段翻译为北美用户可读的英文，保持政策口径与数字不变。只输出 JSON 数组，元素为 {"paragraphId":"...","en":"..."}。',
      JSON.stringify(segments),
    );
    return JSON.parse(extractJson(raw)) as TranslateResult[];
  }

  async draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult> {
    const raw = await this.call(
      '你是知识库编辑。根据客服会话聚类结果起草一条知识条目草稿。只输出 JSON：{"title":"...","body":"...","summary":"..."}。',
      `主题：${topic}\n来源摘要：${sourceSummary}`,
    );
    return JSON.parse(extractJson(raw)) as DraftResult;
  }

  async suggestLabels(title: string, body: string): Promise<string[]> {
    const raw = await this.call(
      '为知识条目生成不超过 5 个中文检索标签。只输出 JSON 字符串数组。',
      `标题：${title}\n正文：${body.slice(0, 1200)}`,
    );
    return JSON.parse(extractJson(raw)) as string[];
  }

  async summarizeEntry(title: string, body: string): Promise<string> {
    const raw = await this.call(
      '你是 COOLFLY 客服知识库编辑。用 2–3 句简体中文概括这条知识的适用场景与核心口径，供内部语义查重比对使用。只输出 JSON：{"summary":"..."}。',
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
      '你在给客服知识库做查重。判断待沉淀的新主题是否与某条既有条目讲的是同一件事。相似度 0–1：1=同一问题同一口径，0=完全无关。只输出 JSON：{"code":"KB-xxxx 或 null","similarity":0.0,"reason":"一句中文理由"}。',
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
  const m = text.match(/[[{][\s\S]*[\]}]/);
  return m ? m[0] : text;
}

let provider: LlmProvider | null = null;

export function getLlm(): LlmProvider {
  if (provider) return provider;
  const key = process.env.ANTHROPIC_API_KEY;
  provider = key ? new AnthropicProvider(key) : new LocalProvider();
  return provider;
}
