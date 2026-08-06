import type { SessionUser } from '@kb/contracts';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { query } from '../db/pool.js';
import { toHtml, toPlainText } from '../core/content.js';
import { getLlm, literalSimilarity } from '../integrations/llm.js';
import { createEntry, findEntry, toDto, type EntryDto } from './entries.js';
import { listScenes } from './meta.js';

/**
 * 一键导入 + AI 整理。
 * 管道：解析（md/txt/csv/tsv/xlsx/docx）→ 切成候选条目 → 大模型逐条整理（标题/正文/分类/场景/标签）
 * → 前端预览可改 → 批量建**草稿**。绝不绕过审核：导入产物一律 draft，仍须走提交-审核-发布。
 */

export interface ParsedDraft {
  /** 前端行内 key */
  key: string;
  titleZh: string;
  bodyZh: string;
  categoryId: string | null;
  categoryZh: string;
  sceneId: string | null;
  sceneZh: string;
  tags: string[];
  /** AI 是否真的参与（本地模式如实标 false，界面据此提示） */
  aiApplied: boolean;
  /** 匹配理由，供人工复核 */
  reason: string;
  /** 解析告警：如内容过短、疑似目录页 */
  warning: string | null;
}

export interface ParseResult {
  fileName: string;
  format: string;
  rawCount: number;
  drafts: ParsedDraft[];
  aiMode: string;
  note: string;
  /** 文件去向说明：只在内存里解析，不落盘 */
  storage: string;
  /** 实际走了 AI 整理的条数（其余为字面匹配，避免大文件把接口拖到超时） */
  aiOrganized: number;
  elapsedMs: number;
}

/* ══════════ 解析 ══════════ */

interface RawItem {
  title: string;
  body: string;
}

/** Markdown / 纯文本：按 #/##/### 切条；无标题时按空行段落聚合为一条 */
function parseMarkdown(text: string): RawItem[] {
  const lines = text.split(/\r?\n/);
  const out: RawItem[] = [];
  let cur: RawItem | null = null;
  for (const line of lines) {
    const h = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (h) {
      if (cur && (cur.title || cur.body.trim())) out.push(cur);
      cur = { title: h[2].trim(), body: '' };
    } else if (cur) {
      cur.body += `${line}\n`;
    } else if (line.trim()) {
      cur = { title: '', body: `${line}\n` };
    }
  }
  if (cur && (cur.title || cur.body.trim())) out.push(cur);
  return out.map((x) => ({ title: x.title, body: x.body.trim() }));
}

/** 表格：优先找「标题/问题/Q」与「正文/答案/A」列；找不到就首列作标题、其余拼正文 */
function parseTable(rows: string[][]): RawItem[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => String(h ?? '').trim());
  const idxOf = (keys: string[]): number =>
    header.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k.toLowerCase())));
  const ti = idxOf(['标题', '问题', 'title', 'question', 'q']);
  const bi = idxOf(['正文', '答案', '内容', 'body', 'answer', 'content', 'a']);
  const body = rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
  return body.map((r) => {
    const cell = (i: number): string => String(r[i] ?? '').trim();
    if (ti >= 0) {
      const rest =
        bi >= 0
          ? cell(bi)
          : r
              .map((c, i) => (i === ti ? '' : `${header[i] ? `${header[i]}：` : ''}${String(c ?? '').trim()}`))
              .filter((x) => x && !x.endsWith('：'))
              .join('\n\n');
      return { title: cell(ti), body: rest };
    }
    return {
      title: cell(0),
      body: r
        .slice(1)
        .map((c, i) => `${header[i + 1] ? `${header[i + 1]}：` : ''}${String(c ?? '').trim()}`)
        .filter((x) => x && !x.endsWith('：'))
        .join('\n\n'),
    };
  });
}

async function parseFile(fileName: string, buf: Buffer): Promise<{ format: string; items: RawItem[] }> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (ext === 'docx') {
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    // 转成 markdown 式标题再复用切条逻辑
    const md = value
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '· $1\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
    return { format: 'Word 文档', items: parseMarkdown(md) };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const items: RawItem[] = [];
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, blankrows: false });
      items.push(...parseTable(rows.map((r) => (r ?? []).map((c) => String(c ?? '')))));
    }
    return { format: 'Excel 表格', items };
  }
  const text = buf.toString('utf8');
  if (ext === 'csv' || ext === 'tsv') {
    const sep = ext === 'tsv' ? '\t' : ',';
    const rows = text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => splitCsvLine(l, sep));
    return { format: ext === 'tsv' ? 'TSV 表格' : 'CSV 表格', items: parseTable(rows) };
  }
  return { format: ext === 'md' ? 'Markdown 文档' : '纯文本', items: parseMarkdown(text) };
}

/** 最小 CSV 行解析：支持双引号包裹与转义 */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/* ══════════ AI 整理 ══════════ */

/** AI 整理的并发与条数上限：串行逐条调大模型会把 50 行的表格拖成好几分钟 */
const AI_CONCURRENCY = 6;
const AI_MAX_ITEMS = Number(process.env.IMPORT_AI_MAX_ITEMS ?? 60);

/** 定长并发池 */
async function mapLimit<T, R>(list: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(list.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      for (;;) {
        const i = cursor;
        cursor += 1;
        if (i >= list.length) return;
        out[i] = await fn(list[i], i);
      }
    }),
  );
  return out;
}

export async function parseAndOrganize(fileName: string, buf: Buffer): Promise<ParseResult> {
  const started = Date.now();
  const { format, items } = await parseFile(fileName, buf);
  const usable = items.filter((x) => (x.title + x.body).replace(/\s/g, '').length >= 8);
  const scenes = await listScenes();
  const llm = getLlm();
  const aiApplied = llm.mode === 'qwen' && scenes.length > 0;
  // 超过上限的部分只做字面匹配，并在 note 里如实说明——宁可少做也不让接口挂住
  const aiCount = aiApplied ? Math.min(usable.length, AI_MAX_ITEMS) : 0;

  const suggestions = await mapLimit(usable.slice(0, aiCount), AI_CONCURRENCY, async (it) => {
    const title = it.title || it.body.split(/\n/)[0].slice(0, 40);
    const body = it.body || it.title;
    try {
      const sug = await llm.suggestOrganize(
        title,
        body,
        scenes.map((s) => s.categoryZh),
        scenes.map((s) => s.nameZh),
      );
      return {
        sceneName: sug.sceneL2 || sug.sceneL1 || '',
        tags: (sug.labels ?? []).slice(0, 4),
        reason: sug.reason || '',
        ok: true,
      };
    } catch {
      return { sceneName: '', tags: [] as string[], reason: 'AI 整理调用失败，已退回字面匹配', ok: false };
    }
  });

  const drafts: ParsedDraft[] = [];
  for (let i = 0; i < usable.length; i += 1) {
    const it = usable[i];
    const title = it.title || it.body.split(/\n/)[0].slice(0, 40);
    const body = it.body || it.title;

    const sug = suggestions[i];
    let sceneName = sug?.sceneName ?? '';
    let tags = sug?.tags ?? [];
    let reason = sug?.reason ?? (i >= aiCount && aiApplied ? `超出单次 AI 整理上限（${AI_MAX_ITEMS} 条），本条按字面匹配` : '');

    // AI 给的场景名要落到真实场景上；给不出就用字面相似度兜底
    let scene = scenes.find((s) => s.nameZh === sceneName);
    if (!scene) {
      const ranked = scenes
        .map((s) => ({ s, score: literalSimilarity(`${title} ${body.slice(0, 200)}`, `${s.categoryZh} ${s.nameZh}`) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0] && ranked[0].score >= 0.06) {
        scene = ranked[0].s;
        if (!reason) reason = `按字面相似度匹配到「${scene.categoryZh} / ${scene.nameZh}」`;
      }
    } else if (!reason) {
      reason = `AI 判定归入「${scene.categoryZh} / ${scene.nameZh}」`;
    }

    const plain = toPlainText(toHtml(body));
    drafts.push({
      key: `IM-${String(i + 1).padStart(3, '0')}`,
      titleZh: title.slice(0, 120),
      bodyZh: body,
      categoryId: scene?.categoryId ?? null,
      categoryZh: scene?.categoryZh ?? '',
      sceneId: scene?.id ?? null,
      sceneZh: scene?.nameZh ?? '',
      tags,
      aiApplied: aiApplied && i < aiCount,
      reason: reason || (scenes.length === 0 ? '库内还没有分类与场景，导入后请在编辑器里补选' : '未匹配到合适场景，请人工选择'),
      warning: plain.length < 30 ? '内容偏短，可能是目录行或标题页，建议核对后再导入' : null,
    });
  }

  const elapsedMs = Date.now() - started;
  const over = aiApplied && usable.length > aiCount ? `（超出上限的 ${usable.length - aiCount} 条按字面匹配）` : '';
  return {
    fileName,
    format,
    rawCount: items.length,
    drafts,
    aiMode: llm.mode,
    aiOrganized: aiCount,
    elapsedMs,
    storage: '文件只在服务端内存中解析，不落盘、不进数据库；解析完即释放。入库的只有你确认后的知识条目正文。',
    note: aiApplied
      ? `已解析 ${items.length} 段，其中 ${drafts.length} 条可入库；${aiCount} 条由大模型整理${over}，耗时 ${(elapsedMs / 1000).toFixed(1)} 秒。导入前可逐条修改。`
      : scenes.length === 0
        ? `已解析 ${items.length} 段，其中 ${drafts.length} 条可入库。**库内还没有分类与场景**，AI 无从匹配，请先在元数据中心建好分类与场景，或导入后在编辑器里补选。`
        : `已解析 ${items.length} 段，其中 ${drafts.length} 条可入库。**当前为本地模式，AI 整理未生效**，分类与场景仅按字面匹配，请逐条核对。`,
  };
}

/* ══════════ 落库 ══════════ */

export interface CommitItem {
  titleZh: string;
  bodyZh: string;
  categoryId?: string | null;
  sceneId?: string | null;
  tags?: string[];
}

export async function commitImport(
  user: SessionUser,
  fileName: string,
  items: CommitItem[],
): Promise<{ created: EntryDto[]; failed: Array<{ index: number; title: string; reason: string }> }> {
  const created: EntryDto[] = [];
  const failed: Array<{ index: number; title: string; reason: string }> = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    try {
      if (!it.titleZh.trim()) throw new Error('标题为空');
      const e = await createEntry(user, {
        titleZh: it.titleZh.trim(),
        bodyZh: it.bodyZh,
        categoryId: it.categoryId ?? null,
        sceneId: it.sceneId ?? null,
        tags: it.tags ?? [],
        source: `一键导入 · ${fileName}`,
        quality: 45,
      });
      created.push(toDto(await findEntry(e.code)));
    } catch (err) {
      failed.push({ index: i + 1, title: it.titleZh, reason: err instanceof Error ? err.message : '未知错误' });
    }
  }
  return { created, failed };
}

/** 导入后清理：把从未编辑过的空标题草稿收掉（配合「撰写新知识」不再点击即落库） */
export async function purgeEmptyDrafts(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM entries
     WHERE status='draft' AND title_zh='未命名知识' AND body_zh='' AND updated_at < now() - interval '1 hour'`,
  );
  return rowCount ?? 0;
}
