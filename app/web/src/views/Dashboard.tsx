import { useEffect, useState } from 'react';
import { api, type DashboardDto, type EntryDto } from '../api.js';
import { useApp } from '../shell.js';
import { C, Card, KpiRow, kickerStyle, tnum } from '../ui.js';

export function Dashboard() {
  const app = useApp();
  const [d, setD] = useState<DashboardDto | null>(null);

  useEffect(() => {
    api.get<DashboardDto>('/dashboard').then(setD).catch(() => undefined);
  }, [app.rev]);

  if (!d) return null;

  async function newDraft() {
    const r = await api.post<{ entry: EntryDto }>('/entries', { titleZh: '未命名知识' });
    app.refreshShell();
    app.go('author.editor', r.entry.code);
  }

  async function onTodo(t: DashboardDto['todos'][number]) {
    if (t.kind === 'review') {
      app.openDrawer({ kind: 'review', code: t.code });
    } else if (t.kind === 'feedback') {
      const r = await api.post<{ entry: EntryDto }>(`/feedback/${t.code}/fix`);
      app.refreshShell();
      app.toast(
        '已进入修复',
        `${r.entry.code} ${r.entry.version} 草稿已生成（线上仍为上一版本）。修改并翻译后重新提交审核。`,
      );
      app.go('author.editor', r.entry.code);
    } else {
      app.go('author.editor', t.code);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div style={kickerStyle}>工作台 · {d.today}</div>
          <h1 style={{ margin: '8px 0 0', fontWeight: 400, fontSize: 38 }}>{d.greeting}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => app.go('collect.extract')}>
            查看抽取候选
          </button>
          <button className="btn btn-primary" onClick={newDraft}>
            撰写新知识
          </button>
        </div>
      </div>
      <hr className="hr" />

      <KpiRow items={d.kpis} columns={5} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 372px',
          gap: 28,
          marginTop: 26,
          alignItems: 'start',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>我的待办</h4>
            <span style={{ fontSize: 11.5, color: C.muted }}>按知识生命周期归集，处理后自动流入下一环节</span>
          </div>
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.divider}` }}>
            {d.todos.map((t) => (
              <div
                key={`${t.kind}-${t.code}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 2px',
                  borderBottom: `1px solid ${C.divider}`,
                }}
              >
                <div
                  style={{
                    width: 78,
                    flex: 'none',
                    fontSize: 10.5,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: t.step === '草稿' ? C.muted : C.accent,
                  }}
                >
                  {t.step}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{t.meta}</div>
                </div>
                <span className={`tag ${t.tagClass}`}>{t.tagText}</span>
                <button
                  className="btn btn-primary"
                  onClick={() => void onTodo(t)}
                  style={{ fontSize: 12.5, padding: '5px 12px' }}
                >
                  {t.cta}
                </button>
              </div>
            ))}
            {d.todos.length === 0 ? (
              <div style={{ padding: '46px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: C.muted }}>待办已清空</div>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                  审核与反馈队列均无积压。可前往反馈回流从 Zendesk 拉取最新客诉。
                </p>
                <button className="btn btn-secondary" onClick={() => app.go('feedback.list')}>
                  查看反馈回流
                </button>
              </div>
            ) : null}
          </div>

          <h4 style={{ margin: '30px 0 0' }}>知识生命周期</h4>
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              marginTop: 12,
              border: `1px solid ${C.divider}`,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {d.lifecycle.map((s) => (
              <button
                key={s.label}
                onClick={() => app.go(s.route)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  background: 'transparent',
                  border: 0,
                  borderRight: `1px solid ${C.divider}`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 24,
                    fontWeight: 400,
                    ...tnum,
                    color: s.n > 0 ? C.accent : C.muted,
                  }}
                >
                  {s.n}
                </div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Card kicker="Zendesk 连接" style={{ background: C.surface }}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}
            >
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 19 }}>已连接</span>
              <span className="tag tag-accent">正常</span>
            </div>
            {d.zendesk.map((z) => (
              <div
                key={z.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '6px 0',
                  borderTop: `1px solid ${C.divider}`,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: C.muted }}>{z.k}</span>
                <span style={{ ...tnum, color: z.accent ? C.accent : C.text }}>{z.v}</span>
              </div>
            ))}
            <button
              className="btn btn-secondary btn-block"
              style={{ marginTop: 10 }}
              onClick={async () => {
                const r = await api.post<{ created: number; note: string }>('/feedback/pull');
                app.refreshShell();
                app.toast(
                  r.created ? `已从 Zendesk 拉取 ${r.created} 条客诉` : '本次没有新客诉',
                  r.note,
                  r.created ? { label: '前往反馈回流', route: 'feedback.list' } : undefined,
                );
              }}
            >
              从 Zendesk 拉取客诉
            </button>
          </Card>

          <h4 style={{ margin: '26px 0 0' }}>最近动态</h4>
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.divider}` }}>
            {d.recent.map((a, i) => (
              <div
                key={i}
                style={{ padding: '9px 0', borderBottom: `1px solid ${C.divider}`, fontSize: 12.5 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>
                    {a.who} · {a.act}
                  </span>
                  <span style={{ ...tnum, color: C.muted, flex: 'none' }}>{a.at}</span>
                </div>
                <div style={{ color: C.muted, marginTop: 1 }}>{a.obj}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
