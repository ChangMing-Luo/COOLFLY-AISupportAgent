import { useEffect, useState } from 'react';
import { api, type ReviewDto } from '../api.js';
import { useApp, type Ctx } from '../shell.js';
import { C, Card, Crumb, KvRow, LoadFailed, kickerStyle, tnum, twoCol } from '../ui.js';

export const REJECT_QUICK = ['费率与新政策不符', '缺少生效日期', '英文翻译有误', '话术过长需精简'];

const DIFF_BG = { same: 'transparent', del: 'var(--color-neutral-100)', add: 'var(--color-accent-100)' };
const DIFF_COL = { same: 'var(--color-text)', del: 'var(--color-neutral-500)', add: 'var(--color-accent-800)' };
const DIFF_GUT = { same: 'transparent', del: 'var(--color-neutral-200)', add: 'var(--color-accent-200)' };

export function useReview(code: string | null): [ReviewDto | null, () => void, string] {
  const app = useApp();
  const [d, setD] = useState<ReviewDto | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!code) return;
    setErr('');
    api
      .get<ReviewDto>(`/entries/${code}/review`)
      .then(setD)
      .catch((e: unknown) => {
        // 真实业务路径：这条待审刚被另一位审核人处理掉，接口会 409。
        // 原来吞掉后整页空白，从工作台待办点进来就是一片白，没人知道发生了什么。
        setD(null);
        setErr(e instanceof Error ? e.message : '审核内容加载失败');
      });
  }, [code, tick, app.rev]);
  return [d, () => setTick((n) => n + 1), err];
}

export function DiffBlock({
  lines,
  compact,
}: {
  lines: ReviewDto['diff']['lines'];
  compact?: boolean;
}) {
  return (
    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {lines.map((d) => (
        <div key={d.n} style={{ display: 'flex', borderBottom: `1px solid ${C.divider}` }}>
          <div
            style={{
              width: compact ? 30 : 34,
              flex: 'none',
              textAlign: 'center',
              padding: compact ? '8px 0' : '9px 0',
              fontSize: 11,
              ...tnum,
              color: C.muted500,
              borderRight: `1px solid ${C.divider}`,
              background: DIFF_GUT[d.type],
            }}
          >
            {d.n}
          </div>
          <div
            style={{
              flex: 1,
              padding: compact ? '8px 12px' : '9px 14px',
              fontSize: compact ? 12.5 : 13,
              lineHeight: 1.7,
              textAlign: 'justify',
              background: DIFF_BG[d.type],
              color: DIFF_COL[d.type],
            }}
          >
            {d.text}
          </div>
        </div>
      ))}
      {lines.length === 0 ? (
        <div style={{ padding: '18px 14px', fontSize: 12.5, color: C.muted }}>
          与线上版本无文本差异（可能仅调整了分类、场景或标签）。
        </div>
      ) : null}
    </div>
  );
}

export function ChecksCard({ checks, compact }: { checks: ReviewDto['checks']; compact?: boolean }) {
  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--color-accent-300)',
        background: 'var(--color-accent-100)',
        marginBottom: compact ? 18 : 0,
      }}
    >
      <div className="card-kicker">AI 审核预检</div>
      {checks.map((c) => (
        <div
          key={c.label}
          style={{
            display: 'flex',
            gap: 9,
            alignItems: 'flex-start',
            padding: compact ? '6px 0' : '7px 0',
            borderTop: '1px solid var(--color-accent-200)',
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: c.mark === '✓' ? 'var(--color-accent-700)' : 'var(--color-accent-600)',
              flex: 'none',
              width: 14,
            }}
          >
            {c.mark}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'var(--color-accent-900)' }}>{c.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-accent-800)', marginTop: 1 }}>{c.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentBox({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <>
      <textarea
        className="input"
        style={{ minHeight: compact ? 80 : 90 }}
        placeholder={compact ? '驳回时必填' : '驳回时必填，将回写至提交人的草稿并记入审核记录'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {REJECT_QUICK.map((q) => (
          <button
            key={q}
            className="tag tag-outline"
            onClick={() => onChange(q)}
            style={{ cursor: 'pointer', fontFamily: 'var(--font-body)', background: 'transparent' }}
          >
            {q}
          </button>
        ))}
      </div>
    </>
  );
}

export async function doApprove(app: Ctx, code: string, comment: string): Promise<void> {
  const r = await api.post<{ entry: { code: string; version: string; syncLabel: string } }>(
    `/entries/${code}/approve`,
    { comment },
  );
  app.refreshShell();
  app.toast(
    '已发布，正在同步 Zendesk',
    `${code} ${r.entry.version} 已发布，英文版本写入 Zendesk：${r.entry.syncLabel}。`,
    { label: '查看渠道同步', route: 'publish.channels' },
  );
}

export async function doReject(app: Ctx, code: string, comment: string): Promise<boolean> {
  if (!comment.trim()) {
    app.toast('请填写驳回意见', '驳回必须说明原因，意见会回写到提交人的草稿。');
    return false;
  }
  await api.post(`/entries/${code}/reject`, { comment });
  app.refreshShell();
  app.toast('已驳回', `${code} 已退回提交人草稿箱，附审核意见。`, {
    label: '查看审核记录',
    route: 'review.log',
  });
  return true;
}

export function ReviewPage() {
  const app = useApp();
  const [d, , loadError] = useReview(app.sel);
  const [comment, setComment] = useState('');
  // 审核是最不该重复触发的动作：双击「通过并发布」会并发两次 approve（重复发布与同步），
  // 而失败（对象已被他人处理、门禁 409）原来完全没有反馈，按钮还能继续点
  const [busy, setBusy] = useState(false);

  if (loadError) {
    return (
      <>
        <Crumb onBack={() => app.go('review.queue')} backText="← 返回待审队列" label="审核" />
        <LoadFailed
          message={`${loadError}（这条可能已被其他审核人处理，返回队列刷新即可看到最新状态）`}
          onRetry={app.refreshShell}
        />
      </>
    );
  }
  if (!d) return null;
  const code = d.entry.code;

  const run = async (fn: () => Promise<boolean>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (await fn()) app.go('review.queue');
    } catch (e) {
      app.toast('操作未完成', e instanceof Error ? e.message : '未知错误');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Crumb
        onBack={() => app.go('review.queue')}
        backText="← 返回待审队列"
        label={`第 ${d.index} 条，共 ${d.total} 条`}
      />
      <div
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginTop: 10 }}
      >
        <div>
          <div style={kickerStyle}>审核 · {code}</div>
          <h2 style={{ margin: '8px 0 0', fontWeight: 400 }}>{d.entry.titleZh}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.muted }}>{d.meta}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void run(() => doReject(app, code, comment))}
          >
            {busy ? '处理中…' : '驳回'}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await doApprove(app, code, comment);
                return true;
              })
            }
          >
            {busy ? '处理中…' : '通过并发布'}
          </button>
        </div>
      </div>
      <hr className="hr" />
      <div style={twoCol}>
        <div>
          <h4 style={{ margin: '0 0 10px' }}>内容对比 · {d.diff.label}</h4>
          <DiffBlock lines={d.diff.lines} />
          <h4 style={{ margin: '24px 0 10px' }}>审核意见</h4>
          <CommentBox value={comment} onChange={setComment} />
        </div>
        <div>
          <ChecksCard checks={d.checks} />
          <Card kicker="提交信息" style={{ marginTop: 14 }}>
            {d.info.map((m, i) => (
              <KvRow key={m.k} k={m.k} v={m.v} last={i === d.info.length - 1} />
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
