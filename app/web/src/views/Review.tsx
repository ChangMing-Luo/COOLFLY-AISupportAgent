import { useState } from 'react';
import { zhCN, type GateResult } from '@kb/contracts';
import { api } from '../api';
import { ConfirmModal, L, StatusPill, entryStatusKind, fmtTime, useApp, useAsync } from '../shared';

interface QueueRow {
  id: string;
  code: string;
  title: string;
  source: string;
  submitterName: string | null;
  submittedAt: string | null;
  chapterPath: string;
  visibility: string;
  versionLabel: string;
  status: string;
  changeSummary: Array<{ field: string; before: string; after: string }>;
}

interface EntryDetail {
  entry: { id: string; code: string; title: string; body: { paragraphs: Array<{ id: string; text: string; internal: boolean; heading: boolean }> }; submitterId: string | null };
}

export function ReviewView() {
  const { can, user, toast, refreshNav, goto } = useApp();
  const queue = useAsync(() => api.get<QueueRow[]>('/api/review/queue'), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<QueueRow | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const rows = queue.data ?? [];
  const current = rows.find((r) => r.id === selected) ?? rows[0] ?? null;
  const detail = useAsync(
    () => (current ? api.get<EntryDetail>(`/api/kb/entries/${current.id}`) : Promise.resolve(null)),
    [current?.id],
  );
  const gate = useAsync(
    () => (current ? api.get<GateResult>(`/api/review/${current.id}/gate`) : Promise.resolve(null)),
    [current?.id],
  );

  const canDecide = can('review.decide');
  const isSelfSubmitted = current !== null && detail.data?.entry.submitterId === user.id;

  async function approve(): Promise<void> {
    if (!current) return;
    try {
      await api.post(`/api/review/${current.id}/approve`);
      toast(`已通过「${current.title}」，可执行发布并同步`);
      queue.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function doReject(): Promise<void> {
    if (!rejecting) return;
    if (!reason.trim()) {
      setReasonError(zhCN.ironLaw.rejectReasonRequired);
      return;
    }
    try {
      await api.post(`/api/review/${rejecting.id}/reject`, { reason: reason.trim() });
      toast(`已驳回「${rejecting.title}」，理由已回传提交人并留痕`);
      setRejecting(null);
      setReason('');
      setReasonError('');
      queue.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function publish(): Promise<void> {
    if (!current) return;
    try {
      const r = await api.post<{ status: string; gate: GateResult }>(`/api/review/${current.id}/publish`);
      if (r.status === 'published') {
        toast(`已发布「${current.title}」并写入同步队列`);
      } else {
        const blocked = r.gate.checks.filter((c) => c.hard && !c.passed).map((c) => c.detail).join('；');
        toast(`发布被门禁阻断：${blocked}`);
      }
      queue.reload();
      gate.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <>
      <div className="note">
        统一过审：全部新条目 / 修订 / 挖掘候选 / 优化建议一律经本中心，人工审核通过并过发布门禁后才生效同步；任何角色无绕过审核的发布路径。
      </div>

      <div className="grid grid--2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="card">
          <h2 className="card__title">待审 {rows.length} 条</h2>
          {queue.loading && <div className="empty">加载中…</div>}
          {!queue.loading && rows.length === 0 && <div className="empty">当前没有待审条目</div>}
          {rows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>来源</th>
                  <th>条目</th>
                  <th>版本</th>
                  <th>提交人</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`row--click${current?.id === r.id ? ' row--warn' : ''}`}
                    onClick={() => setSelected(r.id)}
                    data-testid={`queue-${r.code}`}
                  >
                    <td><StatusPill kind="accent" text={L.reviewSource(r.source)} /></td>
                    <td>
                      <div className="strong">{r.title}</div>
                      <div className="meta">{r.code} · {r.chapterPath} · {L.visibility(r.visibility)}</div>
                    </td>
                    <td>{r.versionLabel}</td>
                    <td>{r.submitterName ?? '—'}</td>
                    <td>{fmtTime(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card__title">{current ? `审核详情 · ${current.title}` : '审核详情'}</h2>
          {!current && <div className="empty">左侧选择一条待审条目</div>}
          {current && (
            <>
              <div className="btn-row" style={{ marginBottom: 12 }}>
                <StatusPill kind={entryStatusKind(current.status)} text={L.entryStatus(current.status)} />
                <StatusPill kind="info" text={`来源：${L.reviewSource(current.source)}`} />
              </div>

              <h3 style={{ fontSize: 13, margin: '12px 0 6px' }}>变更前后对照</h3>
              {current.changeSummary.length === 0 ? (
                <div className="meta">（无差异记录）</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>字段</th><th>变更前</th><th>变更后</th></tr>
                  </thead>
                  <tbody>
                    {current.changeSummary.map((c) => (
                      <tr key={c.field}>
                        <td className="muted">{c.field}</td>
                        <td><span className="pill pill--bad">{c.before}</span></td>
                        <td><span className="pill pill--ok">{c.after}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h3 style={{ fontSize: 13, margin: '16px 0 6px' }}>正文全文</h3>
              <div className="note" style={{ whiteSpace: 'pre-wrap' }}>
                {detail.data?.entry.body.paragraphs.map((p) => (
                  <div key={p.id} style={{ marginBottom: 6 }}>
                    {p.internal && <span className="pill pill--warn" style={{ marginRight: 6 }}>内部段落</span>}
                    <span className={p.heading ? 'strong' : ''}>{p.text}</span>
                  </div>
                )) ?? '加载中…'}
              </div>

              <h3 style={{ fontSize: 13, margin: '16px 0 6px' }}>发布门禁四查</h3>
              {gate.data ? (
                <>
                  <table>
                    <tbody>
                      {gate.data.checks.map((c) => (
                        <tr key={c.key}>
                          <td style={{ width: 32 }}>
                            <StatusPill kind={c.passed ? 'ok' : 'bad'} text={c.passed ? '✓' : '✗'} />
                          </td>
                          <td>
                            <div>{c.label}</div>
                            <div className="meta">{c.detail}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="meta" style={{ marginTop: 6 }}>{gate.data.proxyEvalNote}</div>
                </>
              ) : (
                <div className="meta">门禁检查加载中…</div>
              )}

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!canDecide || isSelfSubmitted}
                  title={!canDecide ? '审核权限仅知识审核员。' : isSelfSubmitted ? zhCN.ironLaw.fourEyes : undefined}
                  onClick={approve}
                  data-testid="approve"
                >
                  通过
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={!canDecide}
                  title={!canDecide ? '审核权限仅知识审核员。' : undefined}
                  onClick={() => setRejecting(current)}
                  data-testid="reject"
                >
                  驳回
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!can('publish') || current.status !== 'approved'}
                  title={!can('publish') ? zhCN.ironLaw.publishBlocked : current.status !== 'approved' ? '需先审核通过' : undefined}
                  onClick={publish}
                  data-testid="publish"
                >
                  发布并同步
                </button>
                <button type="button" className="btn btn--sm" onClick={() => goto('entry', current.id)}>
                  打开条目工作台
                </button>
              </div>
              {isSelfSubmitted && <div className="note note--warn" style={{ marginTop: 10 }}>{zhCN.ironLaw.fourEyes}</div>}
              {!canDecide && <div className="note note--warn" style={{ marginTop: 10 }}>当前角色只能查看，不能通过或驳回。</div>}
              <div className="note" style={{ marginTop: 10 }}>
                通过后自动跑发布门禁：静态检查 + 英文校验状态 + 代理评测，全过才入同步队列。
              </div>
            </>
          )}
        </div>
      </div>

      {rejecting && (
        <ConfirmModal
          title={`驳回「${rejecting.title}」`}
          confirmText="确认驳回"
          danger
          onCancel={() => { setRejecting(null); setReason(''); setReasonError(''); }}
          onConfirm={doReject}
          consequences={['条目回提交人草稿箱并标「已驳回」', '驳回理由回传提交人并写入审核历史', '提交人按意见修改后可重新提交']}
        >
          <div className="field" style={{ marginTop: 12 }}>
            <label className="field__label" htmlFor="reject-reason">驳回理由（必填）</label>
            <textarea
              id="reject-reason"
              className="textarea"
              style={{ minHeight: 90 }}
              placeholder="例如：计费周期与财务口径不符，请附财务确认截图"
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setReasonError(''); }}
              data-testid="reject-reason"
            />
            {reasonError && <div className="note note--bad" style={{ marginTop: 6 }} data-testid="reject-error">{reasonError}</div>}
          </div>
        </ConfirmModal>
      )}
    </>
  );
}
