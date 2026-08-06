import { createHash } from 'node:crypto';
import sanitize from 'sanitize-html';

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

/**
 * 正文 HTML 白名单——与编辑器 TipTap 的节点集对齐（richtext.tsx 的 extensions）。
 *
 * 必须在**服务端**做：正文有三条不经 TipTap 的入库路径（一键导入的原始文档、
 * 采纳向导带进来的 Zendesk 会话原文、大模型译文），而详情页是
 * `dangerouslySetInnerHTML` 直渲。少了这层，`<img src=x onerror=...>`
 * 会在超管打开条目时以其会话身份执行任意请求（建超管账号、改权限矩阵）。
 * 同一份正文还会推去 Zendesk 帮助中心，污染面直达对客页面。
 */
const HTML_POLICY: sanitize.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 's', 'strike', 'del', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'a', 'img', 'iframe',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // TipTap Youtube 扩展产出 div[data-youtube-video] > iframe
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
    div: ['data-youtube-video'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    col: ['span'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // 视频只允许 YouTube 内嵌，杜绝把任意站点塞进后台与帮助中心
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'],
  allowIframeRelativeUrls: false,
  disallowedTagsMode: 'discard',
  // 外链一律新窗口打开并断开 opener，避免反向控制后台标签页
  transformTags: {
    a: sanitize.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  // 非白名单域名的 iframe 会被剥成空标签；空 iframe 无害但是垃圾节点，直接丢掉
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
};

/** 富文本净化：所有入库与外发的正文 HTML 都必须过这层 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  return sanitize(html, HTML_POLICY);
}

/** 纯文本 → HTML：空行分段，段内换行为 <br>。已是 HTML 的按白名单净化后返回 */
export function toHtml(text: string): string {
  if (!text) return '';
  if (/<[a-z]/i.test(text)) return sanitizeRichHtml(text);
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
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(p|h[1-6]|div|ul|ol)>/gi, '\n\n')
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
