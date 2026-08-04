/**
 * LLM 能力层（技术方案 §6）——用途：中→英翻译 / 挖掘聚类起草 / 切条与标签建议。
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

export interface LlmProvider {
  readonly mode: 'anthropic' | 'local';
  translateToEnglish(segments: TranslateSegment[]): Promise<TranslateResult[]>;
  draftCandidate(topic: string, sourceSummary: string): Promise<DraftResult>;
  suggestLabels(title: string, body: string): Promise<string[]>;
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
