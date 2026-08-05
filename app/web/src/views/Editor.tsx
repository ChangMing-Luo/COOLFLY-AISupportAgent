import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type CatalogCategory, type EntryDto } from '../api.js';
import { useApp } from '../shell.js';
import { C, Card, Crumb, tnum, twoCol } from '../ui.js';

interface EditorPayload {
  entry: EntryDto;
  bodyZh: string;
  bodyEn: string;
  categoryId: string | null;
  sceneId: string | null;
  suggestions: Array<{ id: string; text: string; insert: string }>;
  catalog: CatalogCategory[];
  llmLabel: string;
}

const TOOLS: Array<{ l: string; ff: string; tip: string; cmd: string; val?: string }> = [
  { l: 'B', ff: 'var(--font-body)', tip: '加粗', cmd: 'bold' },
  { l: 'I', ff: 'var(--font-body)', tip: '斜体', cmd: 'italic' },
  { l: 'H', ff: 'var(--font-heading)', tip: '小标题', cmd: 'formatBlock', val: '<h4>' },
  { l: '•', ff: 'var(--font-body)', tip: '项目符号', cmd: 'insertUnorderedList' },
  { l: '¶', ff: 'var(--font-body)', tip: '正文段落', cmd: 'formatBlock', val: '<p>' },
];

const TAG_POOL = ['退票', '国际机票', '费率表', '不可抗力', '改签', '值机', '行李', '婴儿票'];

export function Editor() {
  const app = useApp();
  const code = app.sel;
  const [d, setD] = useState<EditorPayload | null>(null);
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [translated, setTranslated] = useState(false);
  const [enEdited, setEnEdited] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErr, setShowErr] = useState(false);
  const [suggestions, setSuggestions] = useState<EditorPayload['suggestions']>([]);
  const [busy, setBusy] = useState(false);
  const zhRef = useRef<HTMLDivElement | null>(null);
  const enRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!code) return;
    api
      .get<EditorPayload>(`/entries/${code}/editor`)
      .then((p) => {
        setD(p);
        setTitle(p.entry.titleZh);
        setTitleEn(p.entry.titleEn);
        setNote(p.entry.note);
        setCategoryId(p.categoryId ?? '');
        setSceneId(p.sceneId ?? '');
        setTags(p.entry.tags);
        setTranslated(p.entry.translated);
        setEnEdited(p.entry.enEdited);
        setSuggestions(p.suggestions);
        setShowErr(false);
        if (zhRef.current) zhRef.current.innerHTML = p.bodyZh;
        if (enRef.current) enRef.current.innerHTML = p.bodyEn;
      })
      .catch(() => undefined);
  }, [code]);

  const validate = useCallback((): string[] => {
    const out: string[] = [];
    if (!sceneId) out.push('未选择问题场景（必填）');
    if (!title || title === '未命名知识') out.push('中文标题为空或仍为默认值');
    if (!translated) out.push('尚未翻译为英文（Zendesk 同步需要英文版本）');
    return out;
  }, [sceneId, title, translated]);

  useEffect(() => {
    setErrors(validate());
  }, [validate]);

  if (!d || !code) return null;

  const cat = d.catalog.find((c) => c.id === categoryId);
  const scene = cat?.scenes.find((s) => s.id === sceneId);

  function payload() {
    return {
      titleZh: title,
      titleEn,
      bodyZh: zhRef.current?.innerHTML ?? d!.bodyZh,
      bodyEn: enRef.current?.innerHTML ?? d!.bodyEn,
      categoryId: categoryId || null,
      sceneId: sceneId || null,
      tags,
      note,
      enEdited,
    };
  }

  async function save() {
    setBusy(true);
    try {
      await api.put(`/entries/${code}`, payload());
      app.refreshShell();
      app.toast('草稿已保存', `${code} ${d!.entry.version} 已保存（中 + EN），未提交审核，线上不受影响。`);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const errs = validate();
    if (errs.length) {
      setShowErr(true);
      app.toast('无法提交', `有 ${errs.length} 项未通过校验，请先修正（含英文翻译）。`);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/entries/${code}`, payload());
      await api.post(`/entries/${code}/submit`);
      app.refreshShell();
      app.toast('已提交审核', `${code} 进入待审队列。审核通过后英文版本自动写入 Zendesk。`, {
        label: '前往审核中心',
        route: 'review.queue',
      });
      app.go('author.drafts');
    } catch (e) {
      const err = e as { status?: number; payload?: { errors?: string[] } };
      if (err.status === 422 && err.payload?.errors) {
        setShowErr(true);
        setErrors(err.payload.errors);
        app.toast('无法提交', `有 ${err.payload.errors.length} 项未通过校验，请先修正（含英文翻译）。`);
      } else {
        app.toast('提交失败', e instanceof Error ? e.message : '未知错误');
      }
    } finally {
      setBusy(false);
    }
  }

  async function translate() {
    setBusy(true);
    try {
      await api.put(`/entries/${code}`, payload());
      const r = await api.post<{ entry: EntryDto; bodyEn: string; degraded: boolean; mode: string }>(
        `/entries/${code}/translate`,
      );
      setTitleEn(r.entry.titleEn);
      setTranslated(true);
      setEnEdited(false);
      if (enRef.current) enRef.current.innerHTML = r.bodyEn;
      app.toast(
        '翻译完成',
        r.degraded
          ? `当前为本地确定性模式（${r.mode}），输出仅供占位，请人工改写后再提交。`
          : '大模型已生成英文标题与正文，可在下方二次编辑。',
      );
    } catch (e) {
      app.toast('翻译失败', e instanceof Error ? e.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
  }

  const st = d.entry;

  return (
    <>
      <Crumb onBack={() => app.go('author.drafts')} label={`知识编辑 / ${title || '新建知识'}`} />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          marginTop: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={`tag ${st.statusTagClass}`}>{st.statusLabel}</span>
            <span style={{ fontSize: 12, color: C.muted, ...tnum }}>
              {st.code} · {st.version}
            </span>
            <span className={`tag ${translated ? 'tag-accent' : 'tag-outline'}`}>
              {translated ? '中 / EN 已翻译' : '仅中文 · 未翻译'}
            </span>
            <span style={{ fontSize: 12, color: C.muted }}>最近保存 {st.updatedAt}</span>
          </div>
          <h2 style={{ margin: '8px 0 0', fontWeight: 400 }}>编辑知识</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={save} disabled={busy}>
            保存草稿
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            提交审核
          </button>
        </div>
      </div>
      <hr className="hr" />

      {showErr && errors.length > 0 ? (
        <div
          style={{
            border: '1px solid var(--color-accent-600)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 18,
            background: 'var(--color-accent-100)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: 'var(--color-accent-800)' }}>
            提交前有 {errors.length} 项未通过校验
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--color-accent-800)' }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={twoCol}>
        <div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>标题（中文）</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: 16, minHeight: 42 }}
            />
          </div>
          <div className="field">
            <label>正文（中文）· 富文本</label>
            <div style={{ border: `1px solid ${C.divider}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <Toolbar onCmd={exec} />
              <div
                ref={zhRef}
                contentEditable
                suppressContentEditableWarning
                data-ph="输入知识正文，可加粗、分小标题、加项目符号…"
                style={{ minHeight: 240, padding: '14px 16px', fontSize: 14.5, lineHeight: 1.85, textAlign: 'justify' }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              margin: '28px 0 12px',
              paddingTop: 22,
              borderTop: `1px solid ${C.divider}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.accent }}
              >
                English 版本 · 大模型翻译
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, textWrap: 'pretty' }}>
                {translated
                  ? enEdited
                    ? '英文版本已生成，且经过人工二次编辑。Zendesk 同步将使用此英文版本。'
                    : '英文版本已由大模型生成，可在下方二次编辑后再提交。'
                  : '用户以中文录入，点击右侧按钮由大模型同步翻译为英文。Zendesk 同步的是英文版本。'}
              </div>
            </div>
            <button
              className={`btn ${translated ? 'btn-secondary' : 'btn-primary'}`}
              onClick={translate}
              disabled={busy}
            >
              {busy ? '处理中…' : translated ? '重新翻译' : '翻译为英文'}
            </button>
          </div>

          <div style={{ display: translated ? 'block' : 'none' }}>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Title (English) · 可编辑</label>
              <input
                className="input"
                value={titleEn}
                onChange={(e) => {
                  setTitleEn(e.target.value);
                  setEnEdited(true);
                }}
                placeholder="Machine-translated, editable"
                style={{ fontSize: 15, minHeight: 42 }}
              />
            </div>
            <div className="field">
              <label>Body (English) · 可编辑</label>
              <div
                style={{ border: `1px solid ${C.divider}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
              >
                <Toolbar onCmd={exec} />
                <div
                  ref={enRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setEnEdited(true)}
                  data-ph="Click 翻译 to generate the English version, or type here…"
                  style={{ minHeight: 200, padding: '14px 16px', fontSize: 14, lineHeight: 1.8, textAlign: 'justify' }}
                />
              </div>
            </div>
          </div>
          {!translated ? (
            <div
              style={{
                border: `1px dashed ${C.divider}`,
                borderRadius: 'var(--radius-md)',
                padding: 26,
                textAlign: 'center',
                color: C.muted,
              }}
            >
              <div style={{ fontSize: 13.5 }}>尚未生成英文版本</div>
              <p style={{ fontSize: 12.5, margin: '6px auto 0', maxWidth: 400, textWrap: 'pretty' }}>
                用户以中文录入，系统调用大模型同步翻译为英文。Zendesk
                同步的是英文版本，因此提交审核前必须先翻译。翻译结果可在此二次编辑。
              </p>
            </div>
          ) : null}

          <h4 style={{ margin: '26px 0 8px' }}>变更说明</h4>
          <input
            className="input"
            placeholder="本次修改了什么？将写入版本历史，审核人可见"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div>
          <Card kicker="目录归属 · 必填">
            <div className="field">
              <label>
                知识分类（一级）<span style={{ color: C.accent700 }}>*</span>
              </label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const nextCat = d.catalog.find((c) => c.id === e.target.value);
                  if (!nextCat?.scenes.some((s) => s.id === sceneId)) setSceneId('');
                }}
              >
                <option value="">请选择一级分类</option>
                {d.catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.zh}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                EN · {cat ? cat.en : '选择分类后显示'}
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                问题场景（二级）<span style={{ color: C.accent700 }}>*</span>
              </label>
              <select className="input" value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
                <option value="">{categoryId ? '请选择二级场景' : '请先选择一级分类'}</option>
                {(cat?.scenes ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.zh}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                EN · {scene ? scene.en : '选择场景后显示'}
              </div>
              {showErr && !sceneId ? (
                <div style={{ fontSize: 11.5, color: C.accent700, marginTop: 4 }}>
                  未选择问题场景，无法进入审核队列
                </div>
              ) : null}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>知识标签（仅本地适配，不翻译）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {tags.map((t) => (
                  <button
                    key={t}
                    className="tag tag-accent"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    {t} ×
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {TAG_POOL.filter((t) => !tags.includes(t))
                  .slice(0, 4)
                  .map((t) => (
                    <button
                      key={t}
                      className="tag tag-outline"
                      onClick={() => setTags([...tags, t])}
                      style={{ cursor: 'pointer', fontFamily: 'var(--font-body)', background: 'transparent' }}
                    >
                      + {t}
                    </button>
                  ))}
              </div>
            </div>
          </Card>

          <Card kicker="翻译控制台" style={{ marginTop: 14, background: C.surface }}>
            <ConsoleRow k="翻译引擎" v={d.llmLabel} />
            <ConsoleRow
              k="中文 → 英文"
              v={translated ? '已完成' : '未执行'}
              color={translated ? C.accent700 : C.muted}
            />
            <ConsoleRow k="英文人工修订" v={enEdited ? '有' : '无'} />
            <ConsoleRow k="Zendesk 同步语言" v="English" last />
          </Card>

          {suggestions.length > 0 ? (
            <Card
              kicker="AI 编辑助手"
              style={{ marginTop: 14, borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}
            >
              {suggestions.map((s) => (
                <div key={s.id} style={{ borderTop: '1px solid var(--color-accent-200)', padding: '9px 0' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-accent-900)' }}>{s.text}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => {
                        if (s.insert && zhRef.current) {
                          zhRef.current.innerHTML += `<p>${s.insert}</p>`;
                        }
                        setSuggestions(suggestions.filter((x) => x.id !== s.id));
                        app.toast(
                          '建议已采纳',
                          s.insert
                            ? '内容已插入中文正文末尾。翻译需重新执行以同步到英文。'
                            : '已标记为已处理。',
                        );
                      }}
                    >
                      采纳
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => setSuggestions(suggestions.filter((x) => x.id !== s.id))}
                    >
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card
              kicker="AI 编辑助手"
              style={{ marginTop: 14, borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--color-accent-800)',
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-accent-200)',
                }}
              >
                建议已全部处理。
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Toolbar({ onCmd }: { onCmd: (cmd: string, val?: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '6px 8px',
        borderBottom: `1px solid ${C.divider}`,
        background: C.surface,
      }}
    >
      {TOOLS.map((t) => (
        <button
          key={t.l}
          title={t.tip}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onCmd(t.cmd, t.val)}
          style={{
            minWidth: 32,
            height: 28,
            border: `1px solid ${C.divider}`,
            background: C.bg,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: t.ff,
            fontSize: 13,
            color: 'inherit',
          }}
        >
          {t.l}
        </button>
      ))}
    </div>
  );
}

function ConsoleRow({ k, v, color, last }: { k: string; v: string; color?: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12.5,
        padding: '6px 0',
        borderBottom: last ? 'none' : `1px solid ${C.divider}`,
      }}
    >
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ color }}>{v}</span>
    </div>
  );
}
