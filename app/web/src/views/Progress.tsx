import type { ProgressState } from '../shell.js';
import { C, tnum } from '../ui.js';

/**
 * 长操作进度模态：拉取 / 抽取 / 发布同步 / 导入都走它。
 * 每一步的状态与失败原因都摆在明面上，不让人对着卡住的页面猜。
 */
export function Progress({ state, onClose }: { state: ProgressState; onClose: () => void }) {
  const failed = state.steps.find((s) => s.state === 'failed');
  const total = state.steps.length;
  const doneCount = state.steps.filter((s) => s.state === 'done').length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="dialog-backdrop" style={{ zIndex: 90 }}>
      <div className="dialog" style={{ width: 'min(520px, 100%)' }}>
        <div className="dialog-title">{state.title}</div>

        <div style={{ height: 3, background: 'var(--color-neutral-200)', marginBottom: 4 }}>
          <div
            style={{
              height: 3,
              width: `${failed ? pct : state.done ? 100 : Math.max(pct, 8)}%`,
              background: failed ? 'var(--color-neutral-500)' : C.accent,
              transition: 'width .25s ease',
            }}
          />
        </div>

        <div>
          {state.steps.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0' }}>
              <span
                style={{
                  width: 18,
                  flex: 'none',
                  textAlign: 'center',
                  fontSize: 12,
                  ...tnum,
                  color:
                    s.state === 'done'
                      ? 'var(--color-accent-700)'
                      : s.state === 'failed'
                        ? 'var(--color-accent-800)'
                        : s.state === 'running'
                          ? C.accent
                          : C.muted500,
                }}
              >
                {s.state === 'done' ? '✓' : s.state === 'failed' ? '×' : s.state === 'running' ? '⋯' : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: s.state === 'pending' ? C.muted : C.text,
                  }}
                >
                  {s.label}
                </div>
                {s.detail ? (
                  <div
                    style={{
                      fontSize: 11.5,
                      marginTop: 2,
                      textWrap: 'pretty',
                      color: s.state === 'failed' ? 'var(--color-accent-800)' : C.muted,
                    }}
                  >
                    {s.detail}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {failed ? (
          <div
            style={{
              borderLeft: `2px solid ${C.accent}`,
              background: 'var(--color-accent-100)',
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--color-accent-900)',
            }}
          >
            「{failed.label}」失败，前面已完成的步骤不会回退。修正后可重试该步骤。
          </div>
        ) : null}

        <div className="dialog-actions">
          {!state.done && state.onCancel ? (
            <button className="btn btn-secondary" onClick={state.onCancel}>
              取消
            </button>
          ) : null}
          <button className="btn btn-primary" disabled={!state.done} onClick={onClose}>
            {state.done ? '完成' : '处理中…'}
          </button>
        </div>
      </div>
    </div>
  );
}
