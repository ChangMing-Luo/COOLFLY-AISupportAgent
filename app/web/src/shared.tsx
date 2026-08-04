import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ENTRY_STATUS_LABELS,
  EN_STATUS_LABELS,
  SYNC_STATUS_LABELS,
  VECTOR_STATUS_LABELS,
  VISIBILITY_LABELS,
  REVIEW_SOURCE_LABELS,
  BATCH_STATUS_LABELS,
  CANDIDATE_TYPE_LABELS,
  SIGNAL_CERTAINTY_LABELS,
  ROLE_LABELS,
  type Permission,
  type SessionUser,
} from '@kb/contracts';

/** 会话上下文：权限门控与 toast 统一入口 */
interface AppCtx {
  user: SessionUser;
  refreshNav: () => void;
  navCounts: NavCounts;
  toast: (msg: string) => void;
  can: (p: Permission) => boolean;
  goto: (view: ViewKey, entryId?: string) => void;
}

export interface NavCounts {
  kb: number;
  review: number;
  sync: number;
  mine: number;
  feedback: number;
}

export type ViewKey =
  | 'work' | 'kb' | 'entry' | 'mine' | 'review' | 'sync' | 'dash' | 'feedback' | 'logs' | 'rbac';

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext 未就绪');
  return ctx;
}

/** 状态徽章：语义色与原型一致（已发布绿 / 驳回下线失败红 / 待审临期黄 / 信息中性） */
export function StatusPill({ kind, text }: { kind: 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'plain'; text: string }) {
  return <span className={`pill${kind === 'plain' ? '' : ` pill--${kind}`}`}>{text}</span>;
}

export function entryStatusKind(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'published') return 'ok';
  if (status === 'rejected' || status === 'offline') return 'bad';
  if (status === 'pending_review' || status === 'reviewing' || status === 'approved') return 'warn';
  return 'info';
}

export function syncStatusKind(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'synced') return 'ok';
  if (status === 'failed' || status === 'blocked') return 'bad';
  if (status === 'queued' || status === 'running') return 'warn';
  return 'info';
}

export function enStatusKind(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'confirmed' || status === 'synced') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'pending_human' || status === 'stale' || status === 'translating') return 'warn';
  return 'info';
}

export function vectorStatusKind(status: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (status === 'ready') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'stale' || status === 'building') return 'warn';
  return 'info';
}

export const L = {
  entryStatus: (s: string) => ENTRY_STATUS_LABELS[s as keyof typeof ENTRY_STATUS_LABELS] ?? s,
  enStatus: (s: string) => EN_STATUS_LABELS[s as keyof typeof EN_STATUS_LABELS] ?? s,
  syncStatus: (s: string) => SYNC_STATUS_LABELS[s as keyof typeof SYNC_STATUS_LABELS] ?? s,
  vectorStatus: (s: string) => VECTOR_STATUS_LABELS[s as keyof typeof VECTOR_STATUS_LABELS] ?? s,
  visibility: (s: string) => VISIBILITY_LABELS[s as keyof typeof VISIBILITY_LABELS] ?? s,
  reviewSource: (s: string) => REVIEW_SOURCE_LABELS[s as keyof typeof REVIEW_SOURCE_LABELS] ?? s,
  batchStatus: (s: string) => BATCH_STATUS_LABELS[s as keyof typeof BATCH_STATUS_LABELS] ?? s,
  candidateType: (s: string) => CANDIDATE_TYPE_LABELS[s as keyof typeof CANDIDATE_TYPE_LABELS] ?? s,
  certainty: (s: string) => SIGNAL_CERTAINTY_LABELS[s as keyof typeof SIGNAL_CERTAINTY_LABELS] ?? s,
  role: (s: string) => ROLE_LABELS[s as keyof typeof ROLE_LABELS] ?? s,
};

export function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dueText(iso: string | null, level: string): string {
  if (!iso) return '首次发布后起算';
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (level === 'bad') return `复核已到期 ${Math.abs(days)} 天`;
  return `复核到期 ${new Date(iso).toISOString().slice(0, 10)}（剩 ${days} 天）`;
}

/** 二次确认弹窗：危险动作统一列明后果 */
export function ConfirmModal({
  title, consequences, confirmText, onConfirm, onCancel, children, danger,
}: {
  title: string;
  consequences?: string[];
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="modal__mask" role="dialog" aria-modal="true">
      <div className="modal">
        <h3 className="modal__title">{title}</h3>
        {consequences && consequences.length > 0 && (
          <ul className="note" style={{ paddingLeft: 24 }}>
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {children}
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            data-testid="confirm-ok"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
