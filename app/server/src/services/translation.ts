import type { SessionUser } from '@kb/contracts';
import { query } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { toHtml, toParagraphs } from '../core/content.js';
import { getLlm } from '../integrations/llm.js';
import { actorOf, findEntry, type EntryRow } from './entries.js';

export interface TranslateOutcome {
  entry: EntryRow;
  degraded: boolean;
  mode: string;
}

/**
 * 中文 → 英文：标题与正文同批送模型（标题走 `__title__` 段）。
 * 失败时保留上一次英文版本，不把半成品写进库。
 */
export async function translateEntry(user: SessionUser, code: string): Promise<TranslateOutcome> {
  const entry = await findEntry(code);
  const paragraphs = toParagraphs(entry.body_zh);
  const llm = getLlm();
  const segments = [
    { paragraphId: '__title__', zh: entry.title_zh },
    ...paragraphs.map((p, i) => ({ paragraphId: `p${i}`, zh: p })),
  ];
  const results = await llm.translateToEnglish(segments);
  const map = new Map(results.map((r) => [r.paragraphId, r.en]));
  const titleEn = (map.get('__title__') ?? '').trim();
  const bodyEn = paragraphs.map((_, i) => (map.get(`p${i}`) ?? '').trim()).filter(Boolean);

  if (!titleEn || bodyEn.length === 0) {
    throw new Error('翻译未返回可用结果，已保留上一次英文版本');
  }

  await query(
    `UPDATE entries SET title_en=$2, body_en=$3, translated=TRUE, en_edited=FALSE, updated_at=now()
     WHERE code=$1`,
    [code, titleEn, toHtml(bodyEn.join('\n\n'))],
  );
  await writeAudit(actorOf(user), {
    action: '大模型翻译',
    objectCode: code,
    objectLabel: `${code} 英文标题与正文（${llm.mode}）`,
    version: entry.version,
  });
  return { entry: await findEntry(code), degraded: llm.mode !== 'qwen', mode: llm.mode };
}

/** 编辑器 AI 助手：结构缺口 + 重复内容，两条都基于真实计算 */
export async function editorSuggestions(entry: EntryRow): Promise<Array<{ id: string; text: string; insert: string }>> {
  const { literalSimilarity } = await import('../integrations/llm.js');
  const { listEntries } = await import('./entries.js');
  const { toPlainText } = await import('../core/content.js');
  const out: Array<{ id: string; text: string; insert: string }> = [];

  const plain = toPlainText(entry.body_zh);
  if (plain && !/特殊情形|不可抗力/.test(plain)) {
    out.push({
      id: 'structure',
      text: '正文缺少「特殊情形」段落，建议补充不可抗力场景的处理口径。',
      insert: '五、补充说明（AI 建议已采纳）。不可抗力情形以航司当次公告为准，坐席须引用公告编号并说明生效时间。',
    });
  }

  const pool = await listEntries(`WHERE e.status='published' AND e.id <> $1`, [entry.id]);
  let best = { code: '', score: 0 };
  for (const p of pool) {
    const s = literalSimilarity(plain, toPlainText(p.body_zh));
    if (s > best.score) best = { code: p.code, score: s };
  }
  if (best.score >= 0.3) {
    out.push({
      id: 'dedupe',
      text: `检测到与 ${best.code} 有 ${Math.round(best.score * 100)}% 内容重叠，可考虑互相引用而非重复描述。`,
      insert: '',
    });
  }
  return out;
}
