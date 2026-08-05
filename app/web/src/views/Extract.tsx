import { useEffect, useState } from 'react';
import { api, type CandidateDto, type CollectTaskDto, type EntryDto } from '../api.js';
import { useApp } from '../shell.js';
import { C, Card, Empty, kickerStyle, tnum } from '../ui.js';

interface Payload {
  task: CollectTaskDto | null;
  candidates: CandidateDto[];
  config: Array<{ k: string; v: string }>;
}

export function Extract() {
  const app = useApp();
  const [d, setD] = useState<Payload | null>(null);

  useEffect(() => {
    api.get<Payload>('/collect/task').then(setD).catch(() => undefined);
  }, [app.rev]);

  if (!d) return null;
  const t = d.task;

  async function accept(c: CandidateDto) {
    const r = await api.post<{ entry: EntryDto }>(`/collect/candidates/${c.code}/accept`);
    setD(await api.get<Payload>('/collect/task'));
    app.refreshShell();
    app.toast(
      '已生成草稿',
      `${r.entry.code} 已建，来源 ${t?.code ?? '抽取任务'}。补全正文并翻译为英文后即可提交审核。`,
      { label: '编辑该草稿', route: 'author.editor', sel: r.entry.code },
    );
  }

  async function drop(c: CandidateDto) {
    await api.post(`/collect/candidates/${c.code}/drop`);
    setD(await api.get<Payload>('/collect/task'));
    app.toast('已丢弃候选', `${c.code} 不再进入草稿箱，本次抽取记录仍保留在审计中。`);
  }

  return (
    <>
      <div style={kickerStyle}>知识采集 · AI 抽取工作台</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          marginTop: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 400 }}>
            定时抽取 · {t ? t.title : '暂无抽取任务'}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted700 }}>
            后台定时任务 · 每日 07:00 自动运行 · 来源 {t?.source ?? 'Zendesk 客服会话'} · 最近运行{' '}
            {t?.ranAt ?? '—'}
          </p>
        </div>
      </div>
      <hr className="hr" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>抽取候选</h4>
            <span style={{ fontSize: 12, color: C.muted }}>
              {d.candidates.length} 条待确认，人工确认后才会生成草稿（抽取由后台定时任务完成，无需手动创建）
            </span>
          </div>

          {t?.state === 'failed' && t.failReason ? (
            <div
              style={{
                marginBottom: 10,
                borderLeft: `2px solid ${C.accent}`,
                background: 'var(--color-accent-100)',
                padding: '10px 14px',
                fontSize: 12.5,
                color: 'var(--color-accent-900)',
              }}
            >
              上次抽取失败：{t.failReason}
            </div>
          ) : null}

          {d.candidates.map((c) => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: C.muted,
                        ...tnum,
                      }}
                    >
                      {c.code}
                    </span>
                    <span className={`tag ${c.tagClass}`}>{c.state}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, marginTop: 6 }}>{c.title}</div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted700, textWrap: 'pretty' }}>
                    {c.answer}
                  </p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <span className="tag tag-neutral">场景 · {c.sceneZh}</span>
                    {c.tags.map((tag) => (
                      <span className="tag tag-outline" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ width: 112, flex: 'none', textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      letterSpacing: '.1em',
                      textTransform: 'uppercase',
                      color: C.muted,
                    }}
                  >
                    置信度
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 26,
                      ...tnum,
                      color: c.confidence > 0.8 ? C.accent : C.muted,
                    }}
                  >
                    {c.confidencePct}
                  </div>
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
                  相似度 {c.dupScore}，生成草稿后会作为该知识的新版本处理。
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
                <button className="btn btn-primary" onClick={() => void accept(c)}>
                  生成草稿
                </button>
              </div>
            </div>
          ))}

          {d.candidates.length === 0 ? (
            <Empty
              dashed
              title="候选已全部处理"
              desc="本次抽取的候选已生成草稿或丢弃。下一步请到「我的草稿」补全内容并提交审核。"
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
          </Card>
        </div>
      </div>
    </>
  );
}
