import { useState } from 'react';
import { PERMISSION_DENIED_TEXT, zhCN } from '@kb/contracts';
import { api } from '../api';
import { L, StatusPill, useApp, useAsync } from '../shared';

/** 视图④ AI 对话挖掘（页面 MD §5.4）：批次 → 三重准入 → 候选处置，无任何直接入库路径 */
interface Batch {
  id: string;
  batchDate: string;
  emailCount: number;
  chatCount: number;
  candidateCount: number;
  status: string;
  failReason: string | null;
}

interface Candidate {
  id: string;
  batchId: string;
  type: string;
  title: string;
  sourceSummary: string;
  frequency: number;
  dedupeScore: number;
  dedupeReason: string;
  dedupeDegraded: boolean;
  gapVerdict: string;
  aiSummary: string;
  admissionNote: string;
  targetEntryCode: string | null;
  disposition: string;
  canCreateNew: boolean;
}

type CandidateAction = 'draft' | 'attach_revision' | 'merge' | 'discard' | 'suggest';

const ACTION_TOAST: Record<CandidateAction, string> = {
  draft: '已起草并提交审核（进审核队列，无直接入库路径）',
  attach_revision: '已挂为修订建议（进审核队列）',
  merge: '已发起合并（进审核队列）',
  suggest: '已提交优化建议（进审核队列）',
  discard: zhCN.mine.discarded,
};

const DISPOSITION_LABELS: Record<string, string> = {
  drafted: '已起草并提交审核',
  attached: '已挂为修订建议',
  merged: '已发起合并',
  suggested: '已提交优化建议',
  discarded: '已丢弃（留痕）',
};

function batchKind(status: string): 'ok' | 'info' | 'bad' {
  if (status === 'completed') return 'ok';
  if (status === 'failed') return 'bad';
  return 'info';
}

function candidateKind(type: string): 'accent' | 'warn' | 'info' {
  if (type === 'new') return 'accent';
  if (type === 'revision') return 'warn';
  return 'info';
}

/** 主处置动作：查重 ≥0.85（canCreateNew=false）不给「起草」；无提交权限降级为「提交优化建议」 */
function primaryAction(c: Candidate, canSubmit: boolean): { action: CandidateAction; label: string } {
  if (!canSubmit) return { action: 'suggest', label: '提交优化建议' };
  if (!c.canCreateNew) return { action: 'attach_revision', label: '挂为修订建议' };
  if (c.type === 'merge') return { action: 'merge', label: '发起合并（进审核）' };
  if (c.type === 'revision') return { action: 'attach_revision', label: '挂为修订建议' };
  return { action: 'draft', label: '起草并提交审核' };
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MiningView() {
  const { can, toast, refreshNav } = useApp();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const batches = useAsync<{ batches: Batch[]; admissionNote: string }>(
    () => api.get('/api/mine/batches'),
    [],
  );
  const candidates = useAsync<Candidate[]>(
    () => api.get(`/api/mine/candidates${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ''}`),
    [batchId],
  );

  const canSubmit = can('entry.submit');
  const canSuggest = can('suggestion.submit');
  const selected = batches.data?.batches.find((b) => b.id === batchId) ?? null;

  async function dispose(c: Candidate, action: CandidateAction) {
    setBusyId(c.id);
    try {
      await api.post<{ disposition: string }>(`/api/mine/candidates/${c.id}/dispose`, { action });
      toast(ACTION_TOAST[action]);
      candidates.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function runBatch() {
    const batchDate = todayLocal();
    setRunning(true);
    try {
      const r = await api.post<{ batchId: string; status: string }>('/api/mine/batches/run', { batchDate });
      toast(`${batchDate} 批次已执行：${L.batchStatus(r.status)}`);
      batches.reload();
      candidates.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="note">
        {zhCN.mine.admission}
        {(candidates.data ?? []).some((c) => c.dedupeDegraded) && (
          <div className="note note--warn" style={{ marginTop: 8 }}>{zhCN.mine.dedupeDegraded}</div>
        )}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'minmax(320px, 5fr) minmax(0, 7fr)', alignItems: 'start', marginTop: 12 }}
      >
        <div className="card">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 className="card__title" style={{ margin: 0 }}>抓取批次</h2>
              <div className="meta">每日 06:00 增量拉取 Zendesk 邮件工单 + 在线聊天 · 会话脱敏后入库</div>
            </div>
            {canSubmit && (
              <button type="button" className="btn btn--sm" onClick={runBatch} disabled={running}>
                {running ? '跑批次中…' : '手动跑批次'}
              </button>
            )}
          </div>

          {batches.error && <div className="note note--bad">{batches.error}</div>}
          {batches.loading && <div className="empty">加载中…</div>}

          {batchId && (
            <button type="button" className="btn btn--sm" style={{ marginBottom: 10 }} onClick={() => setBatchId(null)}>
              查看全部候选
            </button>
          )}

          <div className="grid" style={{ gap: 10 }}>
            {batches.data?.batches.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`stat${batchId === b.id ? ' stat--active' : ''}`}
                onClick={() => setBatchId(batchId === b.id ? null : b.id)}
                data-batch={b.batchDate}
              >
                <div className="btn-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <span className="strong">
                    {b.batchDate} 批次：{b.emailCount + b.chatCount} 个会话 → {b.candidateCount} 条候选
                  </span>
                  <StatusPill kind={batchKind(b.status)} text={L.batchStatus(b.status)} />
                </div>
                <div className="stat__hint">
                  邮件工单 {b.emailCount} · 在线聊天 {b.chatCount}
                </div>
                {b.status === 'failed' && b.failReason && (
                  <div className="note note--bad" style={{ marginTop: 8 }}>拉取失败 · {b.failReason}</div>
                )}
                {b.status === 'empty' && (
                  <div className="note" style={{ marginTop: 8 }}>{zhCN.mine.emptyBatch}</div>
                )}
              </button>
            ))}
            {batches.data && batches.data.batches.length === 0 && <div className="empty">暂无抓取批次</div>}
          </div>

          <div className="note" style={{ marginTop: 12 }}>
            空批次与失败批次如实标注；AI 起草不可用时人工录入与审核照常。挖掘产出分「新增 / 修订 / 合并」三类，全部经审核队列。
          </div>
        </div>

        <div>
          <div className="card">
            <h2 className="card__title" style={{ margin: 0 }}>
              {selected ? `${selected.batchDate} 候选清单` : '全部候选'}
            </h2>
            <div className="meta">起草 / 挂修订 / 合并全部进审核队列——无任何候选直接入库路径。</div>
          </div>

          {candidates.error && <div className="note note--bad">{candidates.error}</div>}
          {candidates.loading && <div className="empty">加载中…</div>}

          {candidates.data?.map((c) => {
            const primary = primaryAction(c, canSubmit);
            const primaryDenied = primary.action === 'suggest' && !canSuggest;
            const pending = c.disposition === 'pending';
            return (
              <div className="card" key={c.id} data-candidate={c.id}>
                <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                  <div className="btn-row">
                    <StatusPill kind={candidateKind(c.type)} text={L.candidateType(c.type)} />
                    <span className="strong" style={{ fontSize: 15 }}>{c.title}</span>
                  </div>
                  <span className="meta mono">{c.sourceSummary}</span>
                </div>

                <div className="grid grid--3" style={{ gap: 8, marginTop: 10 }}>
                  <div className="note">
                    <div className="meta">① 频次</div>
                    <div className="mono strong">{c.frequency} 次</div>
                  </div>
                  <div className="note">
                    <div className="meta">② LLM 语义查重</div>
                    <div className="mono strong" style={c.canCreateNew ? undefined : { color: 'var(--bad-fg)' }}>
                      {c.dedupeScore.toFixed(2)}
                      {c.targetEntryCode ? ` · ${c.targetEntryCode}` : ''}
                    </div>
                  </div>
                  <div className="note">
                    <div className="meta">③ 缺口判定</div>
                    <div className="strong">{c.gapVerdict}</div>
                  </div>
                </div>

                {c.dedupeReason && (
                  <div className="note" style={{ marginTop: 10 }} data-testid={`dedupe-reason-${c.id}`}>
                    <span className="strong">查重判定理由：</span>{c.dedupeReason}
                  </div>
                )}
                {c.dedupeDegraded && <div className="note note--warn">{zhCN.mine.dedupeDegraded}</div>}

                <p style={{ marginBottom: 0 }}>{c.aiSummary}</p>
                <div className={c.canCreateNew ? 'note' : 'note note--warn'}>准入结论：{c.admissionNote}</div>

                <div className="btn-row" style={{ marginTop: 12 }}>
                  {pending ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => dispose(c, primary.action)}
                        disabled={busyId === c.id || primaryDenied}
                        title={primaryDenied ? PERMISSION_DENIED_TEXT['suggestion.submit'] : undefined}
                      >
                        {primary.label}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => dispose(c, 'discard')}
                        disabled={busyId === c.id}
                      >
                        丢弃
                      </button>
                      {primaryDenied && <span className="meta">{PERMISSION_DENIED_TEXT['suggestion.submit']}</span>}
                    </>
                  ) : (
                    <StatusPill kind="info" text={DISPOSITION_LABELS[c.disposition] ?? c.disposition} />
                  )}
                </div>
              </div>
            );
          })}
          {candidates.data && candidates.data.length === 0 && (
            <div className="card">
              <div className="empty">{selected?.status === 'empty' ? zhCN.mine.emptyBatch : '该批次暂无候选'}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
