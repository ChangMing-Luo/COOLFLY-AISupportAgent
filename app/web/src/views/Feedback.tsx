import { useState } from 'react';
import { PERMISSION_DENIED_TEXT } from '@kb/contracts';
import { api } from '../api';
import { L, StatusPill, useApp, useAsync } from '../shared';

/** 视图⑧ 反馈回流（页面 MD §5.8）：四渠道信号矩阵 + 五来源修订候选，全部进审核队列 */
interface SignalRow {
  id: string;
  scene: string;
  channel: string;
  hitSignal: string;
  solveSignal: string;
  certainty: string;
}

interface RevisionCandidate {
  id: string;
  source: string;
  topic: string;
  signalNote: string;
  countLabel: string;
  disposition: string;
  entryCode: string | null;
  entryId: string | null;
}

const SOURCE_KIND: Record<string, 'warn' | 'bad' | 'accent'> = {
  '客服 flag': 'warn',
  '文章被踩': 'bad',
};

const DISPOSITION_LABELS: Record<string, string> = {
  suggested: '已转为修订建议',
  drafted: '已起草',
};

function certaintyKind(certainty: string): 'ok' | 'warn' | 'bad' {
  if (certainty === 'certain') return 'ok';
  if (certainty === 'tier_dependent') return 'warn';
  return 'bad';
}

export function FeedbackView() {
  const { can, toast, refreshNav } = useApp();
  const [collecting, setCollecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const signals = useAsync<SignalRow[]>(() => api.get('/api/feedback/signals'), []);
  const candidates = useAsync<RevisionCandidate[]>(() => api.get('/api/feedback/candidates'), []);

  const canSuggest = can('suggestion.submit');

  async function suggest(c: RevisionCandidate) {
    setBusyId(c.id);
    try {
      await api.post<{ ok: boolean }>(`/api/feedback/candidates/${c.id}/suggest`);
      toast('已转为修订建议，进入审核队列（来源：反馈修订）');
      candidates.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={collecting}
          data-testid="collect-signals"
          onClick={() => {
            setCollecting(true);
            api
              .post<{ articles: number; signals: number; gaps: number; keywords: number; scenes: number; degraded: string[] }>(
                '/api/data/signals/collect',
              )
              .then((r) => {
                toast(
                  `采集完成：条目 ${r.articles} / 信号 ${r.signals} / 缺口 ${r.gaps} / 关键词 ${r.keywords} / 场景 ${r.scenes}` +
                    (r.degraded.length ? `；${r.degraded.length} 项降级（详见操作日志）` : ''),
                );
                candidates.reload();
                signals.reload();
              })
              .catch((e: Error) => toast(e.message))
              .finally(() => setCollecting(false));
          }}
        >
          {collecting ? '采集中…' : '立即采集信号'}
        </button>
        <span className="meta">四渠道信号按小时自动采集；此处为手动补采。待核实档位不进达标判定，只做趋势参考。</span>
      </div>
      <div className="note">AI 运营可提交建议（进审核队列），不可直接改库；处置动作全部留痕。</div>

      <div className="card">
        <h2 className="card__title">信号矩阵</h2>
        <div className="meta" style={{ marginBottom: 12 }}>
          按消费场景拆开看「是否命中知识 / 是否解决问题」· 信号落到条目 + 版本
        </div>
        {signals.error && <div className="note note--bad">{signals.error}</div>}
        {signals.loading && <div className="empty">加载中…</div>}
        <table>
          <thead>
            <tr>
              <th>消费场景</th>
              <th>渠道</th>
              <th>「命中知识」信号</th>
              <th>「是否解决」信号</th>
              <th>确定性档位</th>
            </tr>
          </thead>
          <tbody>
            {signals.data?.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.scene}</td>
                <td className="muted">{s.channel}</td>
                <td>{s.hitSignal}</td>
                <td>{s.solveSignal}</td>
                <td>
                  <StatusPill kind={certaintyKind(s.certainty)} text={L.certainty(s.certainty)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 12 }}>待核实信号核实前不进达标判定，如实标注。</div>
      </div>

      <div className="card">
        <h2 className="card__title">修订候选队列（五来源）</h2>
        <div className="meta" style={{ marginBottom: 12 }}>五源触发 · 转为修订建议后进统一审核队列，来源标注「反馈修订」</div>
        {candidates.error && <div className="note note--bad">{candidates.error}</div>}
        {candidates.loading && <div className="empty">加载中…</div>}
        <div className="grid" style={{ gap: 10 }}>
          {candidates.data?.map((c) => (
            <div className="note" key={c.id} data-candidate={c.id}>
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <div className="btn-row">
                  <StatusPill kind={SOURCE_KIND[c.source] ?? 'accent'} text={c.source} />
                  <span className="strong" style={{ fontSize: 15, color: 'var(--fg)' }}>{c.topic}</span>
                  {c.entryCode && <span className="meta mono">{c.entryCode}</span>}
                </div>
                <span className="mono strong">{c.countLabel}</span>
              </div>
              <div style={{ marginTop: 6 }}>{c.signalNote}</div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                {c.disposition === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => suggest(c)}
                      disabled={!canSuggest || busyId === c.id}
                      title={canSuggest ? undefined : PERMISSION_DENIED_TEXT['suggestion.submit']}
                    >
                      转为修订建议
                    </button>
                    {!canSuggest && <span className="meta">{PERMISSION_DENIED_TEXT['suggestion.submit']}</span>}
                  </>
                ) : (
                  <StatusPill kind="ok" text={DISPOSITION_LABELS[c.disposition] ?? c.disposition} />
                )}
              </div>
            </div>
          ))}
        </div>
        {candidates.data && candidates.data.length === 0 && <div className="empty">暂无修订候选</div>}
      </div>
    </>
  );
}
