import { createHash } from 'node:crypto';

/**
 * v4 正文是富文本 HTML 字符串（原型编辑器用 contenteditable，产出 <p>/<h4>/<ul>）。
 * 这里只做纯函数：文本 ↔ HTML、取纯文本、内容哈希、按段落切分。
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 纯文本 → HTML：空行分段，段内换行为 <br>。已是 HTML 的原样返回（原型 htmlOf 同口径） */
export function toHtml(text: string): string {
  if (!text) return '';
  if (/<[a-z]/i.test(text)) return text;
  return text
    .split('\n\n')
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** HTML → 纯文本（版本 diff、翻译、哈希的基准） */
export function toPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 详情页「内容」页签按段渲染用 */
export function toParagraphs(html: string): string[] {
  const plain = toPlainText(html);
  if (!plain) return [];
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
}

/**
 * 脱敏管道：从 Zendesk 拉回的客诉原文落库前必须过这层。
 */
export function desensitize(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[邮箱已脱敏]')
    .replace(/\b(?:\+?\d{1,3}[- ]?)?1[3-9]\d{9}\b/g, '[手机号已脱敏]')
    .replace(/\b\d{15,19}\b/g, '[卡号已脱敏]');
}

/** 逐行 diff（审核页「内容对比」用）。返回带类型的行序列 */
export type DiffLineType = 'same' | 'del' | 'add';
export interface DiffLine {
  n: number;
  text: string;
  type: DiffLineType;
}

export function diffLines(oldHtml: string, newHtml: string): DiffLine[] {
  const a = toParagraphs(oldHtml);
  const b = toParagraphs(newHtml);
  const out: DiffLine[] = [];
  let n = 0;
  // 最长公共子序列，保证「未改动段」判为 same 而不是全删全增
  const m = a.length;
  const k = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(k + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = k - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < m && j < k) {
    if (a[i] === b[j]) {
      n += 1;
      out.push({ n, text: a[i], type: 'same' });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      n += 1;
      out.push({ n, text: a[i], type: 'del' });
      i += 1;
    } else {
      n += 1;
      out.push({ n, text: b[j], type: 'add' });
      j += 1;
    }
  }
  while (i < m) {
    n += 1;
    out.push({ n, text: a[i], type: 'del' });
    i += 1;
  }
  while (j < k) {
    n += 1;
    out.push({ n, text: b[j], type: 'add' });
    j += 1;
  }
  return out;
}
