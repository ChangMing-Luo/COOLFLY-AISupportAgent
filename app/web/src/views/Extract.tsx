import { useEffect, useMemo, useState } from 'react';
import { api, type CandidateDto, type CollectTaskDto } from '../api.js';
import { useApp } from '../shell.js';
import { C, Card, Empty, kickerStyle, tnum } from '../ui.js';

interface Payload {
  task: CollectTaskDto | null;
  candidates: CandidateDto[];
  config: Array<{ k: string; v: string }>;
}

type SortKey = 'mentions' | 'recent' | 'sentiment' | 'confidence';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'mentions', label: '会话数' },
  { key: 'recent', label: '最近' },
  { key: 'sentiment', label: '情绪' },
  { key: 'confidence', label: '置信度' },
];

const SENTIMENT_RANK: Record<string, number> = { negative: 2, neutral: 1, positive: 0 };

export function Extract() {
  const app = useApp();
  const [d, setD] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortKey>('mentions');
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    api.get<Payload>('/collect/task').then(setD).catch(() => undefined);
  }, [app.rev]);

  const sorted = useMemo(() => {
    const list = [...(d?.candidates ?? [])];
    const val = (c: CandidateDto): number =>
      sort === 'mentions'
        ? c.mentionCount
        : sort === 'confidence'
          ? c.confidence
          : sort === 'sentiment'
            ? (SENTIMENT_RANK[c.sentiment] ?? 1)
            : c.createdAtTs;
    list.sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
    return list;
  }, [d, sort, desc]);

  if (!d) return null;
  const t = d.task;

  async function drop(c: CandidateDto) {
    try {
      setD(await api.post<Payload>(`/collect/candidates/${c.code}/drop`, { reason: '人工丢弃' }));
      app.toast('已移入垃圾箱', `${c.code} 的摘要会成为自动丢弃指纹，下次抽到同类问题将直接进垃圾箱。`, {
        label: '查看垃圾箱',
        route: 'collect.trash',
      });
    } catch (e) {
      app.toast('丢弃失败', e instanceof Error ? e.message : '未知错误');
    }
  }

  /** 主动拉取：不等每日 07:00 的定时任务，立刻从 Zendesk 拉会话跑一遍抽取 */
  async function runNow() {
    setBusy(true);
    let next: Payload | null = null;
    await app.runWithProgress('立即从 Zendesk 拉取并抽取', [
      {
        label: '拉取近 7 日工单与会话正文',
        run: async ({ setDetail }) => {
          setDetail('正在读取 Zendesk 工单与 comments…');
          next = await api.post<Payload>('/collect/run');
          setDetail(next.task?.sourceMeta ?? '已完成');
        },
      },
      {
        label: '大模型按场景聚合并起草候选',
        run: async ({ setDetail }) => {
          const n = next?.candidates.length ?? 0;
          setDetail(
            n > 0
              ? `产出 ${n} 条聚合候选`
              : (next?.task?.failReason ?? 'Zendesk 近 7 日没有可用会话语料，本批次未产出候选'),
          );
        },
      },
    ]);
    if (next) setD(next);
    app.refreshShell();
    setBusy(false);
  }

  async function clearAll(mode: 'discard' | 'purge') {
    // 「彻底清空」是物理删除（连垃圾箱与去重指纹一起没），必须二次确认——
    // 批量删除、批量下架都有确认弹窗，只有这里点一下就执行
    if (mode === 'purge' && !window.confirm('彻底清空会物理删除全部候选（含垃圾箱），去重指纹一并失效，不可恢复。确认继续？')) {
      return;
    }
    setBusy(true);
    // 失败必须放开 busy：原来抛错就再也走不到 setBusy(false)，
    // 「彻底清空 / 清空工作台 / 立即拉取」三个按钮一起灰死，只能切走路由再回来
    try {
      const r = await api.post<Payload & { moved: number; purged: number }>('/collect/clear', { mode });
      setD({ task: r.task, candidates: r.candidates, config: d!.config });
      app.refreshShell();
      app.toast(
        '工作台已清空',
        mode === 'purge'
          ? `已物理删除 ${r.purged} 条候选（含垃圾箱），不再作为去重指纹。`
          : `已把 ${r.moved} 条候选移入垃圾箱；它们的摘要会作为自动丢弃指纹，同类问题不会再冒出来。`,
      );
    } catch (e) {
      app.toast('清空失败', e instanceof Error ? e.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={kickerStyle}>知识采集 · AI 抽取工作台</div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginTop: 8 }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 400 }}>定时抽取 · {t ? t.title : '暂无抽取任务'}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted700 }}>
            后台定时任务 · 每日 07:00 自动运行 · 来源 {t?.source ?? 'Zendesk 客服会话'} · 最近运行 {t?.ranAt ?? '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <button className="btn btn-ghost" onClick={() => void clearAll('purge')} disabled={busy}>
            彻底清空
          </button>
          <button className="btn btn-secondary" onClick={() => void clearAll('discard')} disabled={busy}>
            清空工作台
          </button>
          <button className="btn btn-primary" onClick={() => void runNow()} disabled={busy}>
            {busy ? '拉取中…' : '立即拉取'}
          </button>
        </div>
      </div>
      <hr className="hr" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0 }}>抽取候选</h4>
            <span style={{ fontSize: 12, color: C.muted }}>
              {d.candidates.length} 条待确认 · 同一场景的多条会话已合并为一条
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: C.muted }}>排序</span>
            <div className="seg">
              {SORTS.map((s) => (
                <label className="seg-opt" key={s.key}>
                  <input type="radio" name="candsort" checked={sort === s.key} onChange={() => setSort(s.key)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDesc(!desc)}>
              {desc ? '倒序 ↓' : '正序 ↑'}
            </button>
          </div>

          {t?.state === 'failed' && t.failReason ? (
            <Banner text={`上次抽取失败：${t.failReason}`} />
          ) : t?.failReason ? (
            <Banner text={t.failReason} />
          ) : null}

          {sorted.map((c) => (
            <div
              key={c.code}
              style={{
                border: `1px solid ${C.divider}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, ...tnum }}
                    >
                      {c.code}
                    </span>
                    <span className={`tag ${c.tagClass}`}>{c.state}</span>
                    <span className={`tag ${c.sentiment === 'negative' ? 'tag-accent-2' : 'tag-neutral'}`}>
                      {c.sentimentLabel}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.muted, ...tnum }}>{c.createdAt}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, marginTop: 6 }}>{c.title}</div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted700, textWrap: 'pretty' }}>{c.answer}</p>

                  {c.summary ? (
                    <div
                      style={{
                        marginTop: 10,
                        border: `1px solid ${C.divider}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 11px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10.5,
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: C.accent,
                          marginBottom: 3,
                        }}
                      >
                        AI 摘要 · 去重与自动丢弃的依据
                      </div>
                      <div style={{ fontSize: 12.5, color: C.muted700, lineHeight: 1.7 }}>{c.summary}</div>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="tag tag-neutral">
                      分类 · {c.categoryZh || (c.categoryHint ? `${c.categoryHint}（库内暂无）` : '未匹配')}
                    </span>
                    <span className="tag tag-neutral">
                      场景 · {c.sceneZh || (c.sceneHint ? `${c.sceneHint}（库内暂无）` : '未匹配')}
                    </span>
                    {c.tags.map((tag) => (
                      <span className="tag tag-outline" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ width: 122, flex: 'none', textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted }}>
                    关联会话
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, ...tnum, color: C.accent }}>
                    {c.mentionCount}
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '2px 6px' }}
                    onClick={() => app.openDrawer({ kind: 'sources', code: c.code })}
                  >
                    查看会话 →
                  </button>
                  <div
                    style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, marginTop: 8 }}
                  >
                    置信度
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, ...tnum }}>{c.confidencePct}</div>
                  <div style={{ height: 2, background: 'var(--color-neutral-200)', marginTop: 4 }}>
                    <div style={{ height: 2, background: C.accent, width: c.confidencePct }} />
                  </div>
                </div>
              </div>

              {c.dup ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: '9px 12px',
                    borderLeft: `2px solid ${C.accent}`,
                    background: 'var(--color-accent-100)',
                    fontSize: 12.5,
                  }}
                >
                  查重命中：与{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (c.dupCode) app.go('kb.detail', c.dupCode);
                    }}
                  >
                    {c.dupTitle}
                  </a>{' '}
                  相似度 {c.dupScore}，采纳后会作为该知识的新版本处理。
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  justifyContent: 'flex-end',
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${C.divider}`,
                }}
              >
                <button className="btn btn-ghost" onClick={() => void drop(c)}>
                  丢弃
                </button>
                <button className="btn btn-primary" onClick={() => app.openModal({ type: 'adopt', code: c.code })}>
                  采纳
                </button>
              </div>
            </div>
          ))}

          {d.candidates.length === 0 ? (
            <Empty
              dashed
              title="候选已全部处理"
              desc="本次抽取的候选已采纳或丢弃。可点右上角「立即拉取」再跑一次，或到「我的草稿」补全内容。"
              cta="前往我的草稿"
              onCta={() => app.go('author.drafts')}
            />
          ) : null}
        </div>

        <div>
          <Card kicker="来源原文 · Zendesk" style={{ background: C.surface }}>
            <div
              style={{
                fontSize: 12.5,
                color: C.muted700,
                lineHeight: 1.75,
                maxHeight: 300,
                overflowY: 'auto',
                textAlign: 'justify',
              }}
            >
              {t?.sourceText || '本批次未保存来源原文（抽取任务未产出候选或来源为空）。'}
            </div>
            <div className="card-meta" style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 8 }}>
              {t?.sourceMeta || '—'}
            </div>
          </Card>
          <Card kicker="抽取配置" style={{ marginTop: 14 }}>
            {d.config.map((c) => (
              <div
                key={c.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  padding: '5px 0',
                  borderBottom: `1px solid ${C.divider}`,
                }}
              >
                <span style={{ color: C.muted }}>{c.k}</span>
                <span>{c.v}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, textWrap: 'pretty' }}>
              候选全部来自 Zendesk 近 7 日的真实工单与会话（含 Messaging 的 comments），不是示例数据。丢弃的候选进垃圾箱，其
              AI 摘要会成为后续自动丢弃的匹配指纹。
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div
      style={{
        marginBottom: 10,
        borderLeft: `2px solid ${C.accent}`,
        background: 'var(--color-accent-100)',
        padding: '10px 14px',
        fontSize: 12.5,
        color: 'var(--color-accent-900)',
        textWrap: 'pretty',
      }}
    >
      {text}
    </div>
  );
}
