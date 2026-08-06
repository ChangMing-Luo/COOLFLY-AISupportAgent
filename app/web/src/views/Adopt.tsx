import { useEffect, useMemo, useState } from 'react';
import { api, type AdoptPlanDto, type AdoptResultDto, type CatalogCategory } from '../api.js';
import { useApp } from '../shell.js';
import { RichText } from '../richtext.js';
import { C, tnum } from '../ui.js';

/**
 * 采纳向导（SPEC-v4 §3.3.2）：确认分类 → 确认场景 → 确认知识正文 → 总览与提交。
 * 候选已具备的维度直接跳过，节点数动态；AI 建议值预填，允许改写或从库里下拉选。
 * 提交后按分类、场景、正文三个维度各留一条审核记录。
 */
export function Adopt({ code, onClose }: { code: string; onClose: () => void }) {
  const app = useApp();
  const [plan, setPlan] = useState<AdoptPlanDto | null>(null);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<AdoptResultDto | null>(null);

  const [catId, setCatId] = useState<string | null>(null);
  const [catZh, setCatZh] = useState('');
  const [catEn, setCatEn] = useState('');
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [sceneZh, setSceneZh] = useState('');
  const [sceneEn, setSceneEn] = useState('');
  const [titleZh, setTitleZh] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyZh, setBodyZh] = useState('');
  const [bodyEn, setBodyEn] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get<{ plan: AdoptPlanDto; catalog: CatalogCategory[] }>(`/collect/candidates/${code}/adopt`)
      .then((d) => {
        if (!alive) return;
        setPlan(d.plan);
        setCatalog(d.catalog);
        setCatId(d.plan.category.id);
        setCatZh(d.plan.category.nameZh);
        setCatEn(d.plan.category.nameEn);
        setSceneId(d.plan.scene.id);
        setSceneZh(d.plan.scene.nameZh);
        setSceneEn(d.plan.scene.nameEn);
        setTitleZh(d.plan.body.titleZh);
        setBodyZh(d.plan.body.bodyZh);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : '加载失败'));
    return () => {
      alive = false;
    };
  }, [code]);

  const scenesOfCat = useMemo(
    () => catalog.find((c) => c.id === catId)?.scenes ?? [],
    [catalog, catId],
  );

  if (!plan) {
    return (
      <div className="dialog-backdrop" style={{ zIndex: 70 }}>
        <div className="dialog">
          <div className="dialog-title">采纳抽取候选</div>
          <div className="dialog-body">{err || '正在读取候选与库内分类…'}</div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nodes = plan.nodes;
  const cur = nodes[Math.min(step, nodes.length - 1)];
  const last = step >= nodes.length - 1;

  async function translate(): Promise<void> {
    setBusy(true);
    try {
      const r = await api.post<{ titleEn: string; bodyEn: string; degraded: boolean }>('/collect/translate', {
        titleZh,
        bodyZh,
      });
      setTitleEn(r.titleEn);
      setBodyEn(r.bodyEn);
      if (r.degraded) app.toast('翻译已降级', '未配置大模型，英文为确定性占位，请人工核对。');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '翻译失败');
    } finally {
      setBusy(false);
    }
  }

  async function translateName(kind: '分类' | '场景'): Promise<void> {
    const text = kind === '分类' ? catZh : sceneZh;
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post<{ en: string }>('/meta/translate', { text, kind });
      if (kind === '分类') setCatEn(r.en);
      else setSceneEn(r.en);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '翻译失败');
    } finally {
      setBusy(false);
    }
  }

  function next(): void {
    setErr('');
    if (cur.key === 'category' && !catId && !catZh.trim()) {
      setErr('请选择已有分类，或填写新分类的中文名。');
      return;
    }
    if (cur.key === 'scene' && !sceneId && !sceneZh.trim()) {
      setErr('请选择已有场景，或填写新场景的中文名。');
      return;
    }
    if (cur.key === 'body' && !titleZh.trim()) {
      setErr('标题不能为空。');
      return;
    }
    setStep(step + 1);
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<AdoptResultDto>(`/collect/candidates/${code}/adopt`, {
        category: { id: catId, nameZh: catZh, nameEn: catEn },
        scene: { id: sceneId, nameZh: sceneZh, nameEn: sceneEn },
        titleZh,
        titleEn,
        bodyZh,
        bodyEn,
      });
      setResult(r);
      app.refreshShell();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" style={{ zIndex: 70 }}>
      <div className="dialog" style={{ width: 720, maxWidth: '92vw' }}>
        <div className="dialog-title">
          采纳 · {code}
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 10, ...tnum }}>
            {plan.mentionCount} 个关联会话
          </span>
        </div>

        {result ? (
          <>
            <div className="dialog-body" style={{ textWrap: 'pretty' }}>
              {result.message}
            </div>
            <table className="table" style={{ marginTop: 4 }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>维度</th>
                  <th style={{ width: '18%' }}>审核编号</th>
                  <th style={{ width: '16%' }}>状态</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {result.reviews.map((v) => (
                  <tr key={`${v.dimension}-${v.code}`}>
                    <td style={{ padding: '9px 12px', fontSize: 13 }}>{v.dimension}</td>
                    <td style={{ padding: '9px 12px', fontSize: 13, ...tnum }}>{v.code}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span className={`tag ${v.status === '待审核' ? 'tag-outline' : 'tag-accent'}`}>{v.status}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12.5, color: C.muted700 }}>{v.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                关闭
              </button>
              {result.entryCode ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    app.go('kb.detail', result.entryCode);
                  }}
                >
                  查看 {result.entryCode}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    app.go('review.queue');
                  }}
                >
                  前往审核中心
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 节点指示：节点数由候选已有信息动态决定 */}
            <div style={{ display: 'flex', gap: 6, margin: '2px 0 14px', flexWrap: 'wrap' }}>
              {nodes.map((n, i) => (
                <span
                  key={n.key}
                  className={`tag ${i === step ? 'tag-accent' : i < step ? 'tag-neutral' : 'tag-outline'}`}
                  style={{ ...tnum }}
                >
                  {i + 1}. {n.title}
                </span>
              ))}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: C.muted700, textWrap: 'pretty' }}>{cur.hint}</p>

            {cur.key === 'category' ? (
              <>
                <div className="field">
                  <label>选择库内已发布分类</label>
                  <select
                    className="input"
                    value={catId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setCatId(v);
                      setSceneId(null);
                      if (v) {
                        const c = catalog.find((x) => x.id === v);
                        setCatZh(c?.zh ?? '');
                        setCatEn(c?.en ?? '');
                      }
                    }}
                  >
                    <option value="">— 新建分类（使用下方名称）—</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.zh} / {c.en || '未翻译'}
                      </option>
                    ))}
                  </select>
                </div>
                <NamePair
                  zh={catZh}
                  en={catEn}
                  disabled={Boolean(catId)}
                  onZh={setCatZh}
                  onEn={setCatEn}
                  onTranslate={() => void translateName('分类')}
                  busy={busy}
                  hint="AI 建议值已预填，可直接改写；英文用于写入 Zendesk 目录名。"
                />
              </>
            ) : null}

            {cur.key === 'scene' ? (
              <>
                <div className="field">
                  <label>选择库内已发布场景（{catZh || '未定分类'}）</label>
                  <select
                    className="input"
                    value={sceneId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setSceneId(v);
                      if (v) {
                        const s = scenesOfCat.find((x) => x.id === v);
                        setSceneZh(s?.zh ?? '');
                        setSceneEn(s?.en ?? '');
                      }
                    }}
                  >
                    <option value="">— 新建场景（使用下方名称）—</option>
                    {scenesOfCat.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.zh} / {s.en || '未翻译'}
                      </option>
                    ))}
                  </select>
                </div>
                <NamePair
                  zh={sceneZh}
                  en={sceneEn}
                  disabled={Boolean(sceneId)}
                  onZh={setSceneZh}
                  onEn={setSceneEn}
                  onTranslate={() => void translateName('场景')}
                  busy={busy}
                  hint="新场景会挂在上一步确认的分类下，与 Zendesk 的 Section 一一对应。"
                />
              </>
            ) : null}

            {cur.key === 'body' ? (
              <>
                <div className="field">
                  <label>中文标题</label>
                  <input className="input" value={titleZh} onChange={(e) => setTitleZh(e.target.value)} />
                </div>
                <div className="field">
                  <label>中文正文</label>
                  <RichText value={bodyZh} onChange={setBodyZh} editorKey={`adopt-${code}`} minHeight={160} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>英文版本用于写入 Zendesk</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-secondary" disabled={busy} onClick={() => void translate()}>
                    {busy ? '翻译中…' : '大模型翻译'}
                  </button>
                </div>
                <div className="field">
                  <label>English title</label>
                  <input className="input" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
                </div>
                <div className="field">
                  <label>English body</label>
                  <RichText value={bodyEn} onChange={setBodyEn} editorKey={`adopt-en-${code}`} minHeight={160} />
                </div>
              </>
            ) : null}

            {cur.key === 'overview' ? (
              <table className="table">
                <tbody>
                  {[
                    ['一级分类', `${catZh || '—'} / ${catEn || '未翻译'}${catId ? '（沿用库内）' : '（新建，将提交审核）'}`],
                    ['二级场景', `${sceneZh || '—'} / ${sceneEn || '未翻译'}${sceneId ? '（沿用库内）' : '（新建，将提交审核）'}`],
                    ['知识标题', `${titleZh} / ${titleEn || '未翻译'}`],
                    ['英文版本', titleEn.trim() && bodyEn.trim() ? '已就绪，可直接提交审核' : '缺失——提交后需在编辑器补翻译才能过审'],
                    ['审核记录', '提交后生成分类、场景、知识正文三条记录'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '9px 12px', width: '24%', fontSize: 12.5, color: C.muted }}>{k}</td>
                      <td style={{ padding: '9px 12px', fontSize: 13, textWrap: 'pretty' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {err ? (
              <div
                style={{
                  borderLeft: `2px solid ${C.accent}`,
                  background: 'var(--color-accent-100)',
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: 'var(--color-accent-900)',
                  textWrap: 'pretty',
                }}
              >
                {err}
              </div>
            ) : null}

            <div className="dialog-actions">
              {/* 提交中一并禁用：关掉弹窗并不会中止请求，候选照样被采纳、审核单照样生成，
                  但用户看不到结果页，只会以为什么都没发生 */}
              <button className="btn btn-secondary" disabled={busy} onClick={onClose}>
                取消
              </button>
              {step > 0 ? (
                <button className="btn btn-secondary" disabled={busy} onClick={() => setStep(step - 1)}>
                  上一步
                </button>
              ) : null}
              <button className="btn btn-primary" disabled={busy} onClick={() => (last ? void submit() : next())}>
                {last ? (busy ? '提交中…' : '确认并提交') : '下一步'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NamePair({
  zh,
  en,
  disabled,
  onZh,
  onEn,
  onTranslate,
  busy,
  hint,
}: {
  zh: string;
  en: string;
  disabled: boolean;
  onZh: (v: string) => void;
  onEn: (v: string) => void;
  onTranslate: () => void;
  busy: boolean;
  hint: string;
}) {
  return (
    <>
      <div className="field">
        <label>中文名</label>
        <input className="input" value={zh} disabled={disabled} onChange={(e) => onZh(e.target.value)} />
      </div>
      <div className="field">
        <label>English</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={en} disabled={disabled} onChange={(e) => onEn(e.target.value)} />
          <button
            className="btn btn-secondary"
            style={{ flex: 'none', whiteSpace: 'nowrap' }}
            disabled={disabled || busy}
            onClick={onTranslate}
          >
            翻译
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 11.5, color: C.muted, textWrap: 'pretty' }}>{hint}</p>
    </>
  );
}
