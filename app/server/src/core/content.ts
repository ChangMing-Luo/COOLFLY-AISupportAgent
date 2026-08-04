import { createHash } from 'node:crypto';
import type { EntryBody, Paragraph } from '@kb/contracts';

/**
 * 内部段落剥离（纯函数）——RULE-04 数据泄漏级零容忍。
 * 混合可见性条目推送对外文章前必须经此函数；内部段落不进对外正文、不翻译、不同步。
 */
export function stripInternal(body: EntryBody): Paragraph[] {
  return body.paragraphs.filter((p) => !p.internal);
}

export function hasInternal(body: EntryBody): boolean {
  return body.paragraphs.some((p) => p.internal);
}

/** 对外 HTML：仅由非内部段落生成 */
export function toPublicHtml(body: EntryBody): string {
  return stripInternal(body)
    .map((p) => (p.heading ? `<h2>${escapeHtml(p.text)}</h2>` : `<p>${escapeHtml(p.text)}</p>`))
    .join('\n');
}

/** 全量 HTML（仅内部渠道使用：仅客服 segment） */
export function toInternalHtml(body: EntryBody): string {
  return body.paragraphs
    .map((p) => {
      const cls = p.internal ? ' class="internal"' : '';
      return p.heading ? `<h2${cls}>${escapeHtml(p.text)}</h2>` : `<p${cls}>${escapeHtml(p.text)}</p>`;
    })
    .join('\n');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 规范化纯文本（版本 diff 与 drift 哈希的基准） */
export function toPlainText(body: EntryBody): string {
  return body.paragraphs
    .map((p) => (p.internal ? `> 内部：${p.text}` : p.text))
    .join('\n');
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex');
}

/**
 * 脱敏管道（纯函数）——RULE-05：邮箱 / SN / 家庭 Wi-Fi 名 / 电话打码后才可落库。
 */
export function desensitize(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[邮箱已脱敏]')
    .replace(/\bSN[:：]?\s*[A-Za-z0-9-]{6,}/gi, 'SN:[已脱敏]')
    .replace(/\b(?:Wi-?Fi|SSID|无线网络)\s*[:："「]?\s*["「]?([A-Za-z0-9_一-龥-]{2,32})["」]?/gi, 'Wi-Fi:[已脱敏]')
    .replace(/\b(?:\+?\d{1,3}[- ]?)?1[3-9]\d{9}\b/g, '[手机号已脱敏]');
}
