import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ENTRY_STATUS_LABELS,
  EN_STATUS_LABELS,
  SYNC_STATUS_LABELS,
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
  | 'work' | 'kb' | 'entry' | 'mine' | 'review' | 'sync' | 'dash' | 'feedback' | 'logs' | 'rbac' | 'meta';

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

export const L = {
  entryStatus: (s: string) => ENTRY_STATUS_LABELS[s as keyof typeof ENTRY_STATUS_LABELS] ?? s,
  enStatus: (s: string) => EN_STATUS_LABELS[s as keyof typeof EN_STATUS_LABELS] ?? s,
  syncStatus: (s: string) => SYNC_STATUS_LABELS[s as keyof typeof SYNC_STATUS_LABELS] ?? s,
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

/**
 * 问号说明弹窗：提示信息不进主内容容器（信息密度优先），
 * 统一收进标题旁「?」图标，点击弹窗展示。
 */
export function HelpModal({
  title,
  sections,
  onClose,
}: {
  title: string;
  sections: Array<{ heading: string; items: string[] }>;
  onClose: () => void;
}) {
  return (
    <div className="modal__mask" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        {sections.map((s) => (
          <div key={s.heading} className="field" style={{ marginTop: 12 }}>
            <div className="field__label">{s.heading}</div>
            <ul className="note" style={{ paddingLeft: 20, marginBottom: 0 }}>
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 数据加载 hook：以 deps 序列化值 + tick 作为唯一依赖键。
 * loader 每次渲染都是新函数引用，故用 ref 持有最新实现——
 * 依赖数组保持静态长度与完整依赖，无需关闭 lint 规则。
 */
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
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loaderRef
      .current()
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
  }, [depsKey, tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
