import { useState } from 'react';
import { zhCN } from '@kb/contracts';
import { api } from '../api';
import { L, StatusPill, useApp, useAsync, vectorStatusKind } from '../shared';

/** 视图⑦ 数据看板（页面 MD §5.7）：知识库效果 / 知识缺口 / 客服工作数据（不重建 Explore） */
interface CoverageScene {
  name: string;
  entryCount: number;
  coveragePct: number;
  low: boolean;
}

interface EntryEffect {
  entryId: string;
  code: string;
  title: string;
  versionLabel: string;
  chapter: string;
  botRefs: number;
  agentRefs: number;
  downvotes: number;
  flags: number;
  solveRate: number | null;
  sampleShort: boolean;
  sampleLabel: string | null;
  low: boolean;
  vectorStatus: string;
}

interface Gap {
  id: string;
  topic: string;
  weeklyCount: string;
  sourceSplit: string;
  coverageVerdict: string;
  action: string;
  disposition: string;
}

interface NoResult {
  id: string;
  keyword: string;
  weeklyCount: number;
  verdict: string;
  level: string;
}

type DashTab = 'kb' | 'gap' | 'cs';

const TABS: Array<{ key: DashTab; label: string }> = [
  { key: 'kb', label: '知识库效果' },
  { key: 'gap', label: '知识缺口' },
  { key: 'cs', label: '客服工作数据' },
];

const GAP_DISPOSITION_LABELS: Record<string, string> = {
  drafted: '已起草',
  attached: '已挂修订',
  suggested: '已转建议',
};

export function DashboardView() {
  const { toast, goto } = useApp();
  const [tab, setTab] = useState<DashTab>('kb');

  const coverage = useAsync<CoverageScene[]>(() => api.get('/api/metrics/coverage'), []);
  const entries = useAsync<EntryEffect[]>(() => api.get('/api/metrics/entries'), []);
  const gaps = useAsync<Gap[]>(() => api.get('/api/metrics/gaps'), []);
  const noResults = useAsync<NoResult[]>(() => api.get('/api/metrics/no-results'), []);
  const exploreNote = useAsync<{ note: string }>(() => api.get('/api/metrics/explore-note'), []);

  /** 缺口动作统一在反馈回流处置（服务端唯一处置入口 = /api/feedback/candidates/:id/suggest） */
  function handleGapAction() {
    toast('已在反馈回流视图统一处置');
    goto('feedback');
  }

  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' tab--active' : ''}`}
            onClick={() => setTab(t.key)}
            data-tab={t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kb' && (
        <>
          <div className="card">
            <h2 className="card__title">场景覆盖</h2>
            {coverage.error && <div className="note note--bad">{coverage.error}</div>}
            {coverage.loading && <div className="empty">加载中…</div>}
            <div className="grid" style={{ gap: 8 }}>
              {coverage.data?.map((s) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{ flex: '0 0 88px', color: s.low ? 'var(--bad-fg)' : undefined, fontWeight: s.low ? 700 : undefined }}
                  >
                    {s.name}
                  </span>
                  <div className="bar" style={{ flex: 1 }}>
                    <div
                      className={`bar__fill${s.low ? ' bar__fill--bad' : ''}`}
                      style={{ width: `${s.coveragePct}%` }}
                    />
                  </div>
                  <span className="mono" style={{ flex: '0 0 110px', textAlign: 'right' }}>
                    {s.coveragePct}% · {s.entryCount} 条
                  </span>
                </div>
              ))}
            </div>
            <div className="note" style={{ marginTop: 12 }}>
              分母 = Zendesk 工单分类分布直拉；红条 = 有工单量、无条目覆盖。
            </div>
          </div>

          <div className="card">
            <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="card__title" style={{ margin: 0 }}>条目效果列表</h2>
              <StatusPill kind="warn" text="标红加粗：解决率 < 60%（最差浮顶）" />
            </div>
            {entries.error && <div className="note note--bad">{entries.error}</div>}
            {entries.loading && <div className="empty">加载中…</div>}
            <table>
              <thead>
                <tr>
                  <th>条目</th>
                  <th>版本</th>
                  <th>归属章节</th>
                  <th>bot 引用</th>
                  <th>agent 引用</th>
                  <th>被踩</th>
                  <th>客服 flag</th>
                  <th>解决率</th>
                  <th>向量化</th>
                </tr>
              </thead>
              <tbody>
                {entries.data?.map((e) => (
                  <tr
                    key={e.entryId}
                    className={`row--click${e.low ? ' row--alert' : ''}`}
                    onClick={() => goto('entry', e.entryId)}
                    data-entry={e.code}
                  >
                    <td>
                      <span className="strong">{e.title}</span>
                      <div className="meta mono">{e.code}</div>
                    </td>
                    <td className="mono">{e.versionLabel}</td>
                    <td className="muted">{e.chapter}</td>
                    <td className="mono">{e.botRefs}</td>
                    <td className="mono">{e.agentRefs}</td>
                    <td className="mono">{e.downvotes}</td>
                    <td className="mono">{e.flags}</td>
                    <td>
                      {e.sampleShort ? (
                        <StatusPill kind="info" text={e.sampleLabel ?? zhCN.dash.sampleShort} />
                      ) : (
                        <span className="mono" style={e.low ? { fontWeight: 700, color: 'var(--bad-fg)' } : undefined}>
                          {e.solveRate === null ? '—' : `${e.solveRate}%`}
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusPill kind={vectorStatusKind(e.vectorStatus)} text={L.vectorStatus(e.vectorStatus)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.data && entries.data.length === 0 && <div className="empty">暂无条目效果数据</div>}
          </div>
        </>
      )}

      {tab === 'gap' && (
        <>
          <div className="card">
            <h2 className="card__title">缺口 → 动作</h2>
            {gaps.error && <div className="note note--bad">{gaps.error}</div>}
            {gaps.loading && <div className="empty">加载中…</div>}
            <div className="grid" style={{ gap: 10 }}>
              {gaps.data?.map((g) => (
                <div className="note" key={g.id} data-gap={g.id}>
                  <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                    <span className="strong" style={{ fontSize: 15, color: 'var(--fg)' }}>{g.topic}</span>
                    <span className="mono strong">{g.weeklyCount}</span>
                  </div>
                  <div className="btn-row" style={{ marginTop: 6 }}>
                    <StatusPill kind="info" text={g.sourceSplit} />
                    <StatusPill kind={g.coverageVerdict.includes('未覆盖') ? 'bad' : 'warn'} text={g.coverageVerdict} />
                  </div>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    {g.disposition === 'pending' ? (
                      <button type="button" className="btn btn--sm" onClick={handleGapAction}>
                        {g.action === '新增' ? '起草新条目' : '挂为修订建议'}
                      </button>
                    ) : (
                      <StatusPill kind="ok" text={GAP_DISPOSITION_LABELS[g.disposition] ?? g.disposition} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="note" style={{ marginTop: 12 }}>
              缺口动作与反馈回流共用同一条处置通路：全部转为建议进审核队列，来源标注「反馈修订」。
            </div>
          </div>

          <div className="card">
            <h2 className="card__title">搜索无结果关键词</h2>
            {noResults.error && <div className="note note--bad">{noResults.error}</div>}
            {noResults.loading && <div className="empty">加载中…</div>}
            <table>
              <thead>
                <tr>
                  <th>关键词</th>
                  <th>周次数</th>
                  <th>判定</th>
                </tr>
              </thead>
              <tbody>
                {noResults.data?.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">{r.keyword}</td>
                    <td className="mono">{r.weeklyCount}</td>
                    <td>
                      <StatusPill kind={r.level === 'bad' ? 'bad' : 'warn'} text={r.verdict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="note" style={{ marginTop: 12 }}>
              「有条目但没搜到」是命名 / 标签问题——改标题与 labels，不新建条目。
            </div>
          </div>
        </>
      )}

      {tab === 'cs' && (
        <div className="card">
          <h2 className="card__title">客服工作数据</h2>
          {exploreNote.error && <div className="note note--bad">{exploreNote.error}</div>}
          {exploreNote.loading && <div className="empty">加载中…</div>}
          {exploreNote.data && <div className="note">{exploreNote.data.note}</div>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn--primary" onClick={() => setTab('gap')}>
              去知识缺口
            </button>
          </div>
        </div>
      )}
    </>
  );
}
