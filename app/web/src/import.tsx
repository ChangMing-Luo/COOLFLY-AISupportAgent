/**
 * 一键批量导入（页面 MD §7.2）——把历史知识库文档一次性切成多条条目。
 *
 * 三步：① 粘贴或上传文档 → ② 自动切分并逐条预览确认（可改章节/可见性）→ ③ 一键导入。
 * 导入产物**全部进审核队列**（来源「批量导入」），没有直接入库路径——统一过审铁律不因导入而破例。
 *
 * 解析口径：
 *   - 以 Markdown 标题（`#` / `##` / `###`）切条目，一个标题 = 一条条目；
 *   - 文档开头无标题的内容归入「未命名条目」；
 *   - 正文按空行分段；`内部：` / `【内部】` 开头的段落识别为内部段落，
 *     该条目的可见性自动建议为「对外公开 + 内部段落」。
 */
import { useMemo, useState } from 'react';
import { VISIBILITIES, VISIBILITY_LABELS, TUNABLES, type Visibility } from '@kb/contracts';
import { api } from './api';
import { ConfirmModal, StatusPill, useApp } from './shared';

export interface ChapterOption {
  id: string;
  name: string;
  label: string;
}

interface ParsedEntry {
  key: string;
  title: string;
  paragraphs: string[];
  internalCount: number;
  chapterName: string;
  visibility: Visibility;
}

const INTERNAL_PREFIX = /^(内部[：:]|【内部】)/;

/** 文档 → 多条条目：按 Markdown 标题切，空行分段，内部段落按前缀识别 */
export function parseDocument(text: string, defaultChapter: string): ParsedEntry[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ParsedEntry[] = [];
  let title = '';
  let buffer: string[] = [];

  const flush = (): void => {
    const paragraphs = buffer
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/^[-*]\s+/gm, ''))
      .filter(Boolean);
    if (!title && paragraphs.length === 0) return;
    const internalCount = paragraphs.filter((p) => INTERNAL_PREFIX.test(p)).length;
    out.push({
      key: `e_${out.length}`,
      title: title || '未命名条目',
      paragraphs,
      internalCount,
      chapterName: defaultChapter,
      visibility: internalCount > 0 ? 'mixed' : 'public',
    });
    title = '';
    buffer = [];
  };

  for (const line of lines) {
    const h = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      title = h[1]!;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out.filter((e) => e.paragraphs.length > 0);
}

/** 条目 → 后端已验收的导入行格式：标题|章节|可见性|正文（段落用换行分隔） */
function toRow(e: ParsedEntry): string {
  return [e.title, e.chapterName, e.visibility, e.paragraphs.join('\n')].join('|');
}

interface ImportResult {
  total: number;
  succeeded: string[];
  failed: Array<{ line: number; reason: string; raw: string }>;
}

export function ImportPanel({
  libraryId,
  libraryName,
  chapters,
  onClose,
  onDone,
}: {
  libraryId: string;
  libraryName: string;
  chapters: ChapterOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useApp();
  const [raw, setRaw] = useState('');
  const [entries, setEntries] = useState<ParsedEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const defaultChapter = chapters[0]?.name ?? '';
  const overLimit = (entries?.length ?? 0) > TUNABLES.importMaxRows;

  const stats = useMemo(() => {
    const list = entries ?? [];
    return {
      total: list.length,
      paragraphs: list.reduce((n, e) => n + e.paragraphs.length, 0),
      internal: list.reduce((n, e) => n + e.internalCount, 0),
      noChapter: list.filter((e) => !e.chapterName).length,
    };
  }, [entries]);

  const parse = (): void => {
    if (!raw.trim()) {
      toast('先粘贴文档内容，或选择一个 .md / .txt 文件');
      return;
    }
    if (chapters.length === 0) {
      toast('当前知识库还没有章节——请先在结构树里新建章节，导入的条目需要落到具体章节');
      return;
    }
    const parsed = parseDocument(raw, defaultChapter);
    if (parsed.length === 0) {
      toast('没解析出任何条目：文档需要用 # / ## / ### 标题分隔条目，标题下是该条目正文');
      return;
    }
    setEntries(parsed);
    setResult(null);
  };

  const pickFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setRaw(await file.text());
    setEntries(null);
    setResult(null);
  };

  const patch = (key: string, p: Partial<ParsedEntry>): void => {
    setEntries((list) => (list ?? []).map((e) => (e.key === key ? { ...e, ...p } : e)));
  };

  const doImport = async (): Promise<void> => {
    if (!entries) return;
    setConfirming(false);
    setBusy(true);
    try {
      const res = await api.post<ImportResult>('/api/kb/import', {
        libraryId,
        rows: entries.map(toRow),
      });
      setResult(res);
      toast(`导入完成：成功 ${res.succeeded.length} 条已进审核队列，失败 ${res.failed.length} 条`);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal__mask" role="dialog" aria-modal="true">
      <div className="modal imp" style={{ width: 980, maxWidth: 'calc(100vw - 48px)' }}>
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 className="modal__title" style={{ margin: 0 }}>一键批量导入 · {libraryName}</h3>
          <button type="button" className="btn btn--sm" onClick={onClose}>关闭</button>
        </div>

        <div className="note" style={{ marginBottom: 12 }}>
          用 <span className="mono">#</span> / <span className="mono">##</span> / <span className="mono">###</span> 标题分隔条目——一个标题 = 一条条目，标题下的段落即正文（空行分段）。
          以 <span className="mono">内部：</span> 或 <span className="mono">【内部】</span> 开头的段落自动识别为**内部段落**，该条目可见性自动建议「对外公开 + 内部段落」。
          导入产物全部进审核队列（来源「批量导入」），**没有绕过审核的入库路径**；单次上限 {TUNABLES.importMaxRows} 条。
        </div>

        {/* ① 输入 */}
        {!result && (
          <>
            <div className="field">
              <div className="btn-row" style={{ marginBottom: 6 }}>
                <label className="field__label" style={{ margin: 0 }} htmlFor="imp-raw">文档内容</label>
                <label className="btn btn--sm" style={{ marginLeft: 'auto' }}>
                  选择文件（.md / .txt）
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,text/plain,text/markdown"
                    style={{ display: 'none' }}
                    onChange={(e) => void pickFile(e.target.files?.[0])}
                    data-testid="import-file"
                  />
                </label>
              </div>
              <textarea
                id="imp-raw"
                className="textarea"
                style={{ minHeight: 160 }}
                value={raw}
                placeholder={'## 退款政策\n质量问题：签收后 30 天内可申请全额退款。\n\n内部：超时个案走主管审批。\n\n## 保修期与凭证要求\n整机保修 12 个月，配件 6 个月。'}
                onChange={(e) => { setRaw(e.target.value); setEntries(null); }}
                data-testid="import-raw"
              />
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={parse} data-testid="import-parse">
                解析并预览
              </button>
              {entries && (
                <span className="meta">
                  解析出 {stats.total} 条条目 · {stats.paragraphs} 个段落 · 其中内部段落 {stats.internal} 段
                </span>
              )}
            </div>
          </>
        )}

        {/* ② 预览确认 */}
        {entries && !result && (
          <>
            {overLimit && (
              <div className="note note--bad" style={{ marginTop: 12 }}>
                解析出 {stats.total} 条，超过单次上限 {TUNABLES.importMaxRows} 条——请拆分文档后分批导入。
              </div>
            )}
            <div className="table-scroll" style={{ marginTop: 12, maxHeight: 320 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>标题</th>
                    <th>落到章节</th>
                    <th>可见性</th>
                    <th>段落</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.key} data-import-row={i}>
                      <td className="mono meta">{i + 1}</td>
                      <td>
                        <input
                          className="input"
                          value={e.title}
                          onChange={(ev) => patch(e.key, { title: ev.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="select"
                          value={e.chapterName}
                          onChange={(ev) => patch(e.key, { chapterName: ev.target.value })}
                        >
                          {chapters.map((c) => (
                            <option key={c.id} value={c.name}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={e.visibility}
                          onChange={(ev) => patch(e.key, { visibility: ev.target.value as Visibility })}
                        >
                          {VISIBILITIES.map((v) => (
                            <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="meta">
                        {e.paragraphs.length} 段
                        {e.internalCount > 0 && (
                          <StatusPill kind="warn" text={`内部 ${e.internalCount}`} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || overLimit}
                onClick={() => setConfirming(true)}
                data-testid="import-submit"
              >
                {busy ? '导入中…' : `一键导入 ${stats.total} 条`}
              </button>
              <button type="button" className="btn" onClick={() => setEntries(null)}>返回修改</button>
            </div>
          </>
        )}

        {/* ③ 结果 */}
        {result && (
          <>
            <div className={result.failed.length === 0 ? 'note note--ok' : 'note note--warn'} style={{ marginTop: 12 }}>
              共 {result.total} 条：成功 {result.succeeded.length} 条已进**审核队列**（来源「批量导入」），失败 {result.failed.length} 条。
              未过审的条目不会同步到 Zendesk，也不会出现在知识库总览。
            </div>
            {result.succeeded.length > 0 && (
              <div className="note" style={{ marginTop: 8 }}>
                新条目：<span className="mono">{result.succeeded.join('、')}</span>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="table-scroll" style={{ marginTop: 8, maxHeight: 240 }}>
                <table>
                  <thead>
                    <tr><th>行号</th><th>失败原因</th><th>原始内容</th></tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f) => (
                      <tr key={f.line} className="row--alert">
                        <td className="mono">{f.line}</td>
                        <td>{f.reason}</td>
                        <td className="meta">{f.raw.slice(0, 60)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn--primary" onClick={onClose}>完成</button>
              <button
                type="button"
                className="btn"
                onClick={() => { setResult(null); setEntries(null); setRaw(''); }}
              >
                再导一批
              </button>
            </div>
          </>
        )}

        {confirming && (
          <ConfirmModal
            title={`导入 ${stats.total} 条条目到「${libraryName}」`}
            consequences={[
              '全部条目进审核队列（来源「批量导入」），需人工逐条过审才会生效',
              '未过审条目不同步 Zendesk、不出现在知识库总览',
              `识别到 ${stats.internal} 个内部段落，所在条目已按「对外公开 + 内部段落」处理`,
              '导入动作写审计日志，成功与失败逐条留痕',
            ]}
            confirmText="确认导入"
            onConfirm={() => void doImport()}
            onCancel={() => setConfirming(false)}
          />
        )}
      </div>
    </div>
  );
}
