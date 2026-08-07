import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type CatalogCategory, type EntryDto, type TagDto } from '../api.js';
import { useApp } from '../shell.js';
import { RichText } from '../richtext.js';
import { C, Card, Crumb, tnum, twoCol } from '../ui.js';

interface EditorPayload {
  entry: EntryDto;
  bodyZh: string;
  bodyEn: string;
  categoryId: string | null;
  sceneId: string | null;
  suggestions: Array<{ id: string; text: string; insert: string }>;
  catalog: CatalogCategory[];
  offlineCategories: number;
  llmLabel: string;
}

interface LocalBackup {
  at: number;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  note: string;
  categoryId: string;
  sceneId: string;
  tags: string[];
}

const backupKey = (code: string | null): string => `coolfly.kb.draft.${code ?? '__new__'}`;

export function Editor() {
  const app = useApp();
  /** null = 新建态：还没落库，首次保存才建条目（避免草稿箱堆「未命名知识」空壳） */
  const [code, setCode] = useState<string | null>(app.sel);
  const [d, setD] = useState<EditorPayload | null>(null);
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyZh, setBodyZh] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sceneId, setSceneId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState<TagDto[]>([]);
  const [catalog, setCatalog] = useState<CatalogCategory[]>(app.catalog);
  const [offlineCats, setOfflineCats] = useState(app.offlineCategories);
  const [translated, setTranslated] = useState(false);
  const [enEdited, setEnEdited] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const [suggestions, setSuggestions] = useState<EditorPayload['suggestions']>([]);
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<LocalBackup | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const loadedKey = useRef('');

  /* ── 装载 ── */
  useEffect(() => {
    setCode(app.sel);
  }, [app.sel]);

  useEffect(() => {
    void api
      .get<{ tags: TagDto[] }>('/meta/tags')
      .then((r) => setAllTags(r.tags.filter((t) => t.active)))
      .catch(() => undefined);
  }, [app.rev]);

  useEffect(() => {
    const key = code ?? '__new__';
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setShowErr(false);
    setDirty(false);
    setLoadError('');

    const readBackup = (): LocalBackup | null => {
      try {
        const raw = localStorage.getItem(backupKey(code));
        return raw ? (JSON.parse(raw) as LocalBackup) : null;
      } catch {
        return null;
      }
    };

    if (!code) {
      setD(null);
      setTitle('');
      setTitleEn('');
      setBodyZh('');
      setBodyEn('');
      setNote('');
      setCategoryId('');
      setSceneId('');
      setTags([]);
      setTranslated(false);
      setEnEdited(false);
      setSuggestions([]);
      setSavedAt('');
      setBackup(readBackup());
      return;
    }
    void api
      .get<EditorPayload>(`/entries/${code}/editor`)
      .then((p) => {
        setD(p);
        setTitle(p.entry.titleZh === '未命名知识' ? '' : p.entry.titleZh);
        setTitleEn(p.entry.titleEn);
        setBodyZh(p.bodyZh);
        setBodyEn(p.bodyEn);
        setNote(p.entry.note);
        setCategoryId(p.categoryId ?? '');
        setSceneId(p.sceneId ?? '');
        setTags(p.entry.tags);
        setTranslated(p.entry.translated);
        setEnEdited(p.entry.enEdited);
        setSuggestions(p.suggestions);
        setCatalog(p.catalog);
        setOfflineCats(p.offlineCategories);
        setSavedAt(p.entry.updatedAt);
        const b = readBackup();
        // 本地备份与服务端任一字段不同就提示恢复。原来只比中文标题与中文正文，
        // 于是「翻译完只润色了英文」「只改了标签或场景」的备份会被当成无差异直接删掉
        const differs =
          b &&
          (b.titleZh !== p.entry.titleZh ||
            b.bodyZh !== p.bodyZh ||
            b.titleEn !== p.entry.titleEn ||
            b.bodyEn !== p.bodyEn ||
            b.note !== p.entry.note ||
            b.categoryId !== (p.categoryId ?? '') ||
            b.sceneId !== (p.sceneId ?? '') ||
            b.tags.join('') !== p.entry.tags.join(''));
        if (differs) setBackup(b);
        else {
          setBackup(null);
          localStorage.removeItem(backupKey(code));
        }
      })
      .catch((e: unknown) => {
        // 装载失败必须让用户知道。原来静默吞掉，表单保持全空但 code 仍指向该条目，
        // 用户没察觉就点「保存草稿」，会用空内容覆盖掉正文与已翻译的英文版本
        setLoadError(e instanceof Error ? e.message : '装载失败');
      });
  }, [code, reloadTick]);

  /* ── 本地备份：改动后 800ms 落 localStorage，防刷新/误退丢内容 ── */
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      const b: LocalBackup = { at: Date.now(), titleZh: title, titleEn, bodyZh, bodyEn, note, categoryId, sceneId, tags };
      try {
        localStorage.setItem(backupKey(code), JSON.stringify(b));
      } catch {
        /* 配额满则放弃备份，不影响编辑 */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, title, titleEn, bodyZh, bodyEn, note, categoryId, sceneId, tags, code]);

  /* ── 离开前提醒 ── */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const touch = useCallback(() => setDirty(true), []);

  const errors = useMemo(() => {
    const out: string[] = [];
    if (!sceneId) out.push('未选择问题场景（必填）');
    if (!title.trim() || title === '未命名知识') out.push('中文标题为空或仍为默认值');
    if (!translated) out.push('尚未翻译为英文（Zendesk 同步需要英文版本）');
    return out;
  }, [sceneId, title, translated]);

  const cat = catalog.find((c) => c.id === categoryId);
  const scene = cat?.scenes.find((s) => s.id === sceneId);
  const entry = d?.entry;

  function payload() {
    return {
      titleZh: title.trim() || '未命名知识',
      titleEn,
      bodyZh,
      bodyEn,
      categoryId: categoryId || null,
      sceneId: sceneId || null,
      tags,
      note,
      enEdited,
    };
  }

  /** 首次保存才建条目；返回条目号 */
  async function persist(): Promise<string> {
    let target = code;
    if (!target) {
      const r = await api.post<{ entry: EntryDto }>('/entries', {
        titleZh: title.trim() || '未命名知识',
        bodyZh,
        categoryId: categoryId || undefined,
        sceneId: sceneId || undefined,
        tags,
      });
      target = r.entry.code;
      loadedKey.current = target;
      setCode(target);
    }
    await api.put(`/entries/${target}`, payload());
    localStorage.removeItem(backupKey(code));
    localStorage.removeItem(backupKey(target));
    setDirty(false);
    const fresh = await api.get<EditorPayload>(`/entries/${target}/editor`);
    setD(fresh);
    setSavedAt(fresh.entry.updatedAt);
    setSuggestions(fresh.suggestions);
    return target;
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const c = await persist();
      app.refreshShell();
      app.toast('草稿已保存', `${c} 已保存（中 + EN），未提交审核，线上不受影响。`);
    } catch (e) {
      app.toast('保存失败', e instanceof Error ? e.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  async function saveAndSubmit() {
    if (errors.length) {
      setShowErr(true);
      app.toast('无法提交', `有 ${errors.length} 项未通过校验，请先修正（含英文翻译）。`);
      return;
    }
    setBusy(true);
    let target = code;
    await app.runWithProgress('保存并提交审核', [
      {
        label: '保存到中台',
        run: async ({ setDetail }) => {
          target = await persist();
          setDetail(`${target} 已入库`);
        },
      },
      {
        label: '提交审核队列',
        run: async ({ setDetail }) => {
          await api.post(`/entries/${target}/submit`);
          setDetail('已进入待审队列，审核通过后英文版本写入 Zendesk');
        },
      },
    ]);
    setBusy(false);
    app.refreshShell();
    const fresh = await api.get<EditorPayload>(`/entries/${target}/editor`).catch(() => null);
    if (fresh?.entry.status === 'pending') app.go('author.drafts');
  }

  async function translate() {
    setBusy(true);
    type TransOut = { entry: EntryDto; bodyEn: string; degraded: boolean; mode: string };
    let out: TransOut | null = null;
    // 用 persist() 的返回值而不是闭包里的 code：新建态进来时 code 还是 null，
    // 第一步刚建的条目号要到下次渲染才写回，直接读 code 会打到 /entries//translate（404）
    let target = code;
    await app.runWithProgress('翻译为英文', [
      {
        label: '保存当前内容',
        run: async () => {
          target = await persist();
        },
      },
      {
        label: '调用大模型翻译标题与正文',
        run: async ({ setDetail }) => {
          setDetail(`引擎：${d?.llmLabel ?? '大模型'}`);
          out = await api.post(`/entries/${target}/translate`);
        },
      },
    ]);
    const o = out as TransOut | null;
    if (o) {
      setTitleEn(o.entry.titleEn);
      setBodyEn(o.bodyEn);
      setTranslated(true);
      setEnEdited(false);
      loadedKey.current = `${loadedKey.current}!`;
      if (o.degraded) {
        app.toast('翻译完成（本地模式）', `当前为 ${o.mode} 模式，输出仅供占位，请人工改写后再提交。`);
      }
    }
    setBusy(false);
  }

  const statusTag = entry ? (
    <span className={`tag ${entry.statusTagClass}`}>{entry.statusLabel}</span>
  ) : (
    <span className="tag tag-neutral">新建</span>
  );

  // 装载失败时不能进编辑态：表单是空的，一保存就会把正文和英文版本清掉
  if (loadError) {
    return (
      <>
        <Crumb onBack={() => app.go('author.drafts')} label="知识编辑" />
        <div
          style={{
            marginTop: 24,
            border: `1px solid ${C.divider}`,
            borderLeft: '2px solid var(--color-accent-600)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            background: C.surface,
          }}
        >
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>无法打开这条知识</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.8 }}>
            {loadError}
            <br />
            为避免用空白内容覆盖已有正文，编辑器暂不打开。请重试，或返回草稿列表。
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                loadedKey.current = '';
                setLoadError('');
                setReloadTick((n) => n + 1);
              }}
            >
              重试
            </button>
            <button className="btn btn-secondary" onClick={() => app.go('author.drafts')}>
              返回草稿列表
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Crumb onBack={() => app.go('author.drafts')} label={`知识编辑 / ${title || '新建知识'}`} />
      <div
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginTop: 10 }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {statusTag}
            <span style={{ fontSize: 12, color: C.muted, ...tnum }}>
              {entry ? `${entry.code} · ${entry.version}` : '尚未入库 · 保存后生成知识编号'}
            </span>
            <span className={`tag ${translated ? 'tag-accent' : 'tag-outline'}`}>
              {translated ? '中 / EN 已翻译' : '仅中文 · 未翻译'}
            </span>
            <span style={{ fontSize: 12, color: dirty ? 'var(--color-accent-700)' : C.muted }}>
              {dirty ? '有未保存改动 · 已存本地备份' : savedAt ? `最近保存 ${savedAt}` : '尚未保存'}
            </span>
          </div>
          <h2 style={{ margin: '8px 0 0', fontWeight: 400 }}>编辑知识</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={saveDraft} disabled={busy}>
            保存草稿
          </button>
          <button className="btn btn-primary" onClick={saveAndSubmit} disabled={busy}>
            保存草稿并提交审核
          </button>
        </div>
      </div>
      <hr className="hr" />

      {backup ? (
        <div
          style={{
            border: '1px solid var(--color-accent-600)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 18,
            background: 'var(--color-accent-100)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--color-accent-900)' }}>
            检测到本地未保存的备份（{new Date(backup.at).toLocaleString('zh-CN')}），可能是上次刷新或误退时留下的。
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => {
              setTitle(backup.titleZh);
              setTitleEn(backup.titleEn);
              setBodyZh(backup.bodyZh);
              setBodyEn(backup.bodyEn);
              setNote(backup.note);
              setCategoryId(backup.categoryId);
              setSceneId(backup.sceneId);
              setTags(backup.tags);
              setBackup(null);
              setDirty(true);
              loadedKey.current = `${loadedKey.current}!`;
            }}
          >
            恢复备份
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => {
              localStorage.removeItem(backupKey(code));
              setBackup(null);
            }}
          >
            丢弃
          </button>
        </div>
      ) : null}

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
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
              placeholder="一句话说清这条知识回答什么问题"
              style={{ fontSize: 16, minHeight: 42 }}
            />
          </div>
          <div className="field">
            <label>正文（中文）· 富文本，支持标题 / 列表 / 引用 / 图片 / 视频 / 表格</label>
            <RichText
              editorKey={`${loadedKey.current}:zh`}
              value={bodyZh}
              minHeight={280}
              placeholder="输入知识正文…"
              onChange={(html) => {
                setBodyZh(html);
                touch();
              }}
            />
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
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.accent }}>
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
              disabled={busy || !bodyZh}
            >
              {translated ? '重新翻译' : '翻译为英文'}
            </button>
          </div>

          {translated ? (
            <>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Title (English) · 可编辑</label>
                <input
                  className="input"
                  value={titleEn}
                  onChange={(e) => {
                    setTitleEn(e.target.value);
                    setEnEdited(true);
                    touch();
                  }}
                  style={{ fontSize: 15, minHeight: 42 }}
                />
              </div>
              <div className="field">
                <label>Body (English) · 可编辑</label>
                <RichText
                  editorKey={`${loadedKey.current}:en`}
                  value={bodyEn}
                  minHeight={220}
                  placeholder="English body…"
                  onChange={(html) => {
                    setBodyEn(html);
                    setEnEdited(true);
                    touch();
                  }}
                />
              </div>
            </>
          ) : (
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
          )}

          <h4 style={{ margin: '26px 0 8px' }}>变更说明</h4>
          <input
            className="input"
            placeholder="本次修改了什么？将写入版本历史，审核人可见"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              touch();
            }}
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
                  const next = catalog.find((c) => c.id === e.target.value);
                  if (!next?.scenes.some((s) => s.id === sceneId)) setSceneId('');
                  touch();
                }}
              >
                <option value="">请选择一级分类</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.zh}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                EN · {cat ? cat.en : '选择分类后显示'}
              </div>
              {offlineCats > 0 ? (
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                  另有 {offlineCats} 个分类已下架未列出，可在元数据中心上架后选用
                </div>
              ) : null}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                问题场景（二级）<span style={{ color: C.accent700 }}>*</span>
              </label>
              <select
                className="input"
                value={sceneId}
                onChange={(e) => {
                  setSceneId(e.target.value);
                  touch();
                }}
              >
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
              {cat && cat.offlineScenes > 0 ? (
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                  该分类下另有 {cat.offlineScenes} 个场景已下架未列出
                </div>
              ) : null}
              {showErr && !sceneId ? (
                <div style={{ fontSize: 11.5, color: C.accent700, marginTop: 4 }}>
                  未选择问题场景，无法进入审核队列
                </div>
              ) : null}
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, textWrap: 'pretty' }}>
                分类与场景在 Zendesk 是**目录**（Category / Section），不是文章；本条知识发布后会作为文章挂到所选场景的
                Section 下。
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>知识标签（仅本地适配，不翻译）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {tags.map((t) => (
                  <button
                    key={t}
                    className="tag tag-accent"
                    onClick={() => {
                      setTags(tags.filter((x) => x !== t));
                      touch();
                    }}
                    style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    {t} ×
                  </button>
                ))}
                {tags.length === 0 ? <span style={{ fontSize: 12, color: C.muted }}>尚未添加标签</span> : null}
              </div>
              <input
                className="input"
                value={tagInput}
                placeholder="输入标签后回车新增"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const v = tagInput.trim();
                  if (v && !tags.includes(v)) {
                    setTags([...tags, v]);
                    touch();
                  }
                  setTagInput('');
                }}
              />
              {allTags.length > 0 ? (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {allTags
                    .filter((t) => !tags.includes(t.name))
                    .slice(0, 6)
                    .map((t) => (
                      <button
                        key={t.id}
                        className="tag tag-outline"
                        onClick={() => {
                          setTags([...tags, t.name]);
                          touch();
                        }}
                        style={{ cursor: 'pointer', fontFamily: 'var(--font-body)', background: 'transparent' }}
                      >
                        + {t.name}
                      </button>
                    ))}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>
                  标签库还是空的，这里输入的新标签会自动入库，之后可在「元数据中心 · 知识标签」维护。
                </div>
              )}
            </div>
          </Card>

          <Card kicker="翻译控制台" style={{ marginTop: 14, background: C.surface }}>
            <ConsoleRow k="翻译引擎" v={d?.llmLabel ?? '保存后显示'} />
            <ConsoleRow
              k="中文 → 英文"
              v={translated ? '已完成' : '未执行'}
              color={translated ? C.accent700 : C.muted}
            />
            <ConsoleRow k="英文人工修订" v={enEdited ? '有' : '无'} />
            <ConsoleRow k="Zendesk 同步语言" v="English" last />
          </Card>

          <Card
            kicker="AI 编辑助手"
            style={{ marginTop: 14, borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((s) => (
                <div key={s.id} style={{ borderTop: '1px solid var(--color-accent-200)', padding: '9px 0' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-accent-900)' }}>{s.text}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '3px 10px' }}
                      onClick={() => {
                        if (s.insert) {
                          setBodyZh(`${bodyZh}<p>${s.insert}</p>`);
                          loadedKey.current = `${loadedKey.current}!`;
                          touch();
                        }
                        setSuggestions(suggestions.filter((x) => x.id !== s.id));
                        app.toast(
                          '建议已采纳',
                          s.insert ? '内容已插入中文正文末尾。翻译需重新执行以同步到英文。' : '已标记为已处理。',
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
              ))
            ) : (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--color-accent-800)',
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-accent-200)',
                }}
              >
                {code ? '建议已全部处理。' : '保存草稿后，助手会基于正文给出结构与查重建议。'}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
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
