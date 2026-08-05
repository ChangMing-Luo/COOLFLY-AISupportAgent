import { useEffect, useState } from 'react';
import { api, type HealthDto } from '../api.js';
import { useApp } from '../shell.js';
import { C, KpiRow, kickerStyle, tnum } from '../ui.js';

export function Health() {
  const app = useApp();
  const [d, setD] = useState<HealthDto | null>(null);

  useEffect(() => {
    api.get<HealthDto>('/analytics/health').then(setD).catch(() => undefined);
  }, [app.rev]);

  if (!d) return null;

  return (
    <>
      <div style={kickerStyle}>数据分析 · 知识健康度</div>
      <h2 style={{ margin: '8px 0 6px', fontWeight: 400 }}>知识库体检</h2>
      <p style={{ margin: 0, fontSize: 13, color: C.muted700, maxWidth: 640, textWrap: 'pretty' }}>
        健康度由命中率、采纳率等指标加权得出。低分知识可一键建修订，走一遍编辑与审核闭环。
      </p>
      <hr className="hr" />

      <div style={{ marginBottom: 26 }}>
        <KpiRow items={d.kpis} columns={3} />
      </div>

      <h4 style={{ margin: '0 0 12px' }}>知识状态分布</h4>
      <div
        style={{
          display: 'flex',
          gap: 0,
          border: `1px solid ${C.divider}`,
          borderRadius: 'var(--radius-md)',
          marginBottom: 26,
        }}
      >
        {d.dist.map((x) => (
          <div key={x.label} style={{ flex: 1, padding: '12px 16px', borderRight: `1px solid ${C.divider}` }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, ...tnum }}>{x.n}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{x.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34, alignItems: 'start' }}>
        <div>
          <h4 style={{ margin: '0 0 12px' }}>场景覆盖率</h4>
          {d.scenes.map((s) => (
            <div key={s.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{s.label}</span>
                <span style={{ ...tnum, color: C.muted700 }}>{s.value}</span>
              </div>
              <div style={{ height: 3, background: 'var(--color-neutral-200)', marginTop: 5 }}>
                <div style={{ height: 3, background: C.accent, width: s.pct }} />
              </div>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ margin: '0 0 12px' }}>待修复知识</h4>
          <div style={{ borderTop: `1px solid ${C.divider}` }}>
            {d.risky.map((r) => (
              <div
                key={r.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '11px 2px',
                  borderBottom: `1px solid ${C.divider}`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 19,
                    ...tnum,
                    width: 34,
                    flex: 'none',
                    color: r.high ? C.accent : C.muted,
                  }}
                >
                  {r.score}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5 }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{r.reason}</div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={async () => {
                    const res = await api.post<{ entry: { code: string; version: string } }>(
                      `/entries/${r.code}/revise`,
                    );
                    app.refreshShell();
                    app.toast('修订草稿已创建', `${r.code} ${res.entry.version}，线上仍为上一版本。`);
                    app.go('author.editor', r.code);
                  }}
                >
                  建修订
                </button>
              </div>
            ))}
            {d.risky.length === 0 ? (
              <div style={{ padding: '30px 0', fontSize: 13, color: C.muted }}>
                暂无待修复知识：采纳率与召回置信均在阈值之上。
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
