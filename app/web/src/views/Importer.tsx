import { useRef, useState } from 'react';
import { api, type CatalogCategory, type ImportCommitResult, type ParsedDraft, type ParseResult } from '../api.js';
import { useApp } from '../shell.js';
import { C, Empty, kickerStyle, tnum } from '../ui.js';

const ACCEPT = '.md,.markdown,.txt,.csv,.tsv,.xlsx,.xls,.docx';

/**
 * 一键导入 + AI 整理：上传文档或表格 → 大模型理解并切成条目、匹配分类与场景 →
 * 逐条预览可改 → 批量建**草稿**（仍走提交-审核-发布，绝不绕过审核）。
 */
export function Importer() {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ParsedDraft[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // 取消上传：AbortController 断掉请求，进度模态里的当前步骤即刻标失败
  const abortRef = useRef<AbortController | null>(null);
  const catalog: CatalogCategory[] = app.catalog;

  async function pick(file: File) {
    setBusy(true);
    let parsed: ParseResult | null = null;
    await app.runWithProgress('导入并 AI 整理', [
      {
        label: `解析文件《${file.name}》`,
        run: async ({ setDetail }) => {
          setDetail(`${(file.size / 1024).toFixed(0)} KB，上传中…`);
          const fd = new FormData();
          fd.append('file', file);
          const ac = new AbortController();
          abortRef.current = ac;
          const res = await fetch('/api/import/parse', {
            method: 'POST',
            body: fd,
            credentials: 'include',
            signal: ac.signal,
          }).catch((e: Error) => {
            if (e.name === 'AbortError') throw new Error('已取消上传，文件未入库');
            throw e;
          });
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (!res.ok) throw new Error(String(data.message ?? `解析失败（${res.status}）`));
          parsed = data as ParseResult;
          setDetail(`${(parsed as ParseResult).format} · 切出 ${(parsed as ParseResult).rawCount} 段`);
        },
      },
      {
        label: '大模型理解与分类匹配',
        run: async ({ setDetail }) => {
          const p = parsed as ParseResult | null;
          if (!p) throw new Error('解析结果为空');
          setDetail(
            p.aiMode === 'qwen'
              ? `已整理 ${p.drafts.length} 条，自动匹配分类与场景`
              : '当前为本地模式，AI 整理未生效，仅按字面匹配',
          );
        },
      },
    ]);
    abortRef.current = null;
    const p = parsed as ParseResult | null;
    if (p) {
      setResult(p);
      setRows(p.drafts);
      setSkipped(new Set());
    }
    setBusy(false);
  }

  async function commit() {
    const items = rows.filter((r) => !skipped.has(r.key));
    if (items.length === 0) {
      app.toast('没有可导入的条目', '至少保留一条，或重新选择文件。');
      return;
    }
    setBusy(true);
    let out: ImportCommitResult | null = null;
    await app.runWithProgress('批量建草稿', [
      {
        label: `写入 ${items.length} 条草稿`,
        run: async ({ setDetail }) => {
          out = await api.post('/import/commit', {
            fileName: result?.fileName ?? '导入文件',
            items: items.map((r) => ({
              titleZh: r.titleZh,
              bodyZh: r.bodyZh,
              categoryId: r.categoryId,
              sceneId: r.sceneId,
              tags: r.tags,
            })),
          });
          const o = out as ImportCommitResult;
          setDetail(`成功 ${o.created.length} 条，失败 ${o.failed.length} 条`);
        },
      },
    ]);
    setBusy(false);
    app.refreshShell();
    const o = out as ImportCommitResult | null;
    if (o) {
      app.toast(
        `已导入 ${o.created.length} 条草稿`,
        o.failed.length
          ? `另有 ${o.failed.length} 条失败：${o.failed.map((f) => `第 ${f.index} 条（${f.reason}）`).join('；')}`
          : '全部进入「我的草稿」，补全并翻译后提交审核即可发布。',
        { label: '前往我的草稿', route: 'author.drafts' },
      );
      setResult(null);
      setRows([]);
    }
  }

  function patch(key: string, next: Partial<ParsedDraft>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  const kept = rows.filter((r) => !skipped.has(r.key)).length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={kickerStyle}>知识编辑 · 一键导入</div>
          <h2 style={{ margin: '8px 0 6px', fontWeight: 400 }}>一键导入 · AI 整理</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted700, maxWidth: 640, textWrap: 'pretty' }}>
            上传历史文档或表格（Markdown / 文本 / CSV / Excel / Word），大模型会理解内容、切成一条条知识，并自动匹配一级分类与二级场景。导入后一律为草稿，仍需补全翻译并走审核发布。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
              e.target.value = '';
            }}
          />
          {busy ? (
            <button
              className="btn btn-secondary"
              onClick={() => {
                abortRef.current?.abort();
                abortRef.current = null;
              }}
            >
              取消上传
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              {result ? '重新选择文件' : '选择文件'}
            </button>
          )}
          {result ? (
            <button className="btn btn-primary" onClick={commit} disabled={busy || kept === 0}>
              导入 {kept} 条为草稿
            </button>
          ) : null}
        </div>
      </div>
      <hr className="hr" />

      {!result ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 372px', gap: 28, alignItems: 'start' }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void pick(f);
            }}
            style={{
              border: `1px dashed ${C.divider}`,
              borderRadius: 'var(--radius-md)',
              padding: '70px 0',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 23, color: C.muted }}>
              把文件拖到这里，或点击「选择文件」
            </div>
            <p style={{ fontSize: 13, color: C.muted, margin: '8px auto 16px', maxWidth: 460, textWrap: 'pretty' }}>
              支持 .md / .txt（按 # 标题切条）、.csv / .tsv / .xlsx（按行切条，自动识别「标题·正文」或「问题·答案」列）、.docx（按标题层级切条）。单文件上限 20 MB。
              <br />
              文件只在服务端内存里解析，<b>不落盘、不入库</b>；入库的只有你确认后的知识条目。上传过程中可随时点「取消上传」。
            </p>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              选择文件
            </button>
          </div>
          <div className="card">
            <div className="card-kicker">导入会做什么</div>
            {[
              ['① 解析', '按文档标题层级或表格行切成候选条目'],
              ['② AI 整理', '大模型理解内容，给出标题、匹配一级分类与二级场景、建议标签'],
              ['③ 人工确认', '逐条预览，可改标题、换场景、剔除不要的条目'],
              ['④ 批量建草稿', '一次性写入「我的草稿」，随后照常翻译、提交、审核、发布'],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '8px 0', borderTop: `1px solid ${C.divider}` }}>
                <div style={{ fontSize: 12.5 }}>{k}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, textWrap: 'pretty' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              borderLeft: `2px solid ${C.accent}`,
              background: 'var(--color-accent-100)',
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--color-accent-900)',
              marginBottom: 14,
              textWrap: 'pretty',
            }}
          >
            《{result.fileName}》· {result.format} · {result.note}
            <div style={{ marginTop: 6, color: C.muted700 }}>{result.storage}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>导入预览</h4>
            <span style={{ fontSize: 12, color: C.muted, ...tnum }}>
              保留 {kept} / {rows.length} 条
            </span>
          </div>

          {rows.map((r) => {
            const off = skipped.has(r.key);
            const cat = catalog.find((c) => c.id === r.categoryId);
            return (
              <div
                key={r.key}
                style={{
                  border: `1px solid ${C.divider}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginBottom: 10,
                  opacity: off ? 0.45 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, ...tnum }}
                  >
                    {r.key}
                  </span>
                  <span className={`tag ${r.aiApplied ? 'tag-accent' : 'tag-outline'}`}>
                    {r.aiApplied ? 'AI 已整理' : '字面匹配'}
                  </span>
                  {r.warning ? <span className="tag tag-neutral">{r.warning}</span> : null}
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() =>
                      setSkipped((s) => {
                        const n = new Set(s);
                        if (n.has(r.key)) n.delete(r.key);
                        else n.add(r.key);
                        return n;
                      })
                    }
                  >
                    {off ? '恢复导入' : '不导入'}
                  </button>
                </div>

                <input
                  className="input"
                  value={r.titleZh}
                  onChange={(e) => patch(r.key, { titleZh: e.target.value })}
                  style={{ fontSize: 15, minHeight: 40, marginBottom: 8 }}
                />
                <div
                  style={{
                    fontSize: 12.5,
                    color: C.muted700,
                    lineHeight: 1.7,
                    maxHeight: 92,
                    overflow: 'hidden',
                    marginBottom: 10,
                    textWrap: 'pretty',
                  }}
                >
                  {r.bodyZh.slice(0, 260)}
                  {r.bodyZh.length > 260 ? '…' : ''}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    style={{ width: 190 }}
                    value={r.categoryId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const c = catalog.find((x) => x.id === id);
                      patch(r.key, {
                        categoryId: id,
                        categoryZh: c?.zh ?? '',
                        sceneId: null,
                        sceneZh: '',
                      });
                    }}
                  >
                    <option value="">未选分类</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.zh}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ width: 190 }}
                    value={r.sceneId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const s = cat?.scenes.find((x) => x.id === id);
                      patch(r.key, { sceneId: id, sceneZh: s?.zh ?? '' });
                    }}
                  >
                    <option value="">{r.categoryId ? '未选场景' : '请先选分类'}</option>
                    {(cat?.scenes ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.zh}
                      </option>
                    ))}
                  </select>
                  {r.tags.map((t) => (
                    <span className="tag tag-outline" key={t}>
                      {t}
                    </span>
                  ))}
                  <span style={{ fontSize: 11.5, color: C.muted, flex: 1, minWidth: 160, textWrap: 'pretty' }}>
                    {r.reason}
                  </span>
                </div>
              </div>
            );
          })}

          {rows.length === 0 ? (
            <Empty
              dashed
              title="这个文件没解析出可用内容"
              desc="确认文档里有标题层级（# / ## ）或表格有「标题 / 正文」列，再重新导入。"
              cta="重新选择文件"
              onCta={() => fileRef.current?.click()}
            />
          ) : null}
        </>
      )}
    </>
  );
}
