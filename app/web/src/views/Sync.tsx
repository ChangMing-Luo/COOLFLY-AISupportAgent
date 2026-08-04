import { useState } from 'react';
import { zhCN } from '@kb/contracts';
import { api } from '../api';
import { ConfirmModal, L, StatusPill, fmtTime, syncStatusKind, useApp, useAsync } from '../shared';

interface SyncTask {
  id: string;
  entryCode: string;
  entryTitle: string;
  versionLabel: string;
  action: string;
  target: string;
  status: string;
  languages: string;
  retryCount: number;
  failReason: string | null;
  blockedReason: string | null;
  updatedAt: string;
}

interface DriftRow {
  id: string;
  entryCode: string;
  articleRef: string;
  title: string;
  changedBy: string;
  diffSummary: string;
  detectedAt: string;
  resolvedAction: string | null;
}

export function SyncView() {
  const { can, toast, refreshNav } = useApp();
  const [filter, setFilter] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ row: DriftRow; action: 'overwrite' | 'pull_back' } | null>(null);

  const tasks = useAsync(
    () => api.get<{ tasks: SyncTask[]; stats: Record<string, number>; stateMachineNote: string }>('/api/sync/tasks'),
    [],
  );
  const drift = useAsync(() => api.get<{ records: DriftRow[]; governanceNote: string }>('/api/sync/drift'), []);
  const mapping = useAsync(
    () => api.get<{ rows: Array<{ local: string; zendesk: string; visibility: string }>; note: string }>('/api/sync/mapping'),
    [],
  );

  const canOperate = can('publish');
  const stats = tasks.data?.stats ?? {};
  const rows = (tasks.data?.tasks ?? []).filter((t) => (filter ? t.status === filter : true));
  const unresolved = (drift.data?.records ?? []).filter((d) => !d.resolvedAction);

  async function retry(task: SyncTask): Promise<void> {
    try {
      const r = await api.post<{ status: string }>(`/api/sync/tasks/${task.id}/retry`);
      toast(`「${task.entryTitle}」重试结果：${L.syncStatus(r.status)}`);
      tasks.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function scan(): Promise<void> {
    try {
      const r = await api.post<{ detected: number }>('/api/sync/drift/scan');
      toast(r.detected > 0 ? zhCN.sync.driftAlert(r.detected) : '未检出内容漂移');
      drift.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function resolveDrift(): Promise<void> {
    if (!resolving) return;
    try {
      await api.post(`/api/sync/drift/${resolving.row.id}/resolve`, { action: resolving.action });
      toast(
        resolving.action === 'overwrite'
          ? `已以本台内容覆盖「${resolving.row.title}」（Zendesk 端修改丢弃，已留痕）`
          : `已拉回「${resolving.row.title}」进审核队列（作为待审来源）`,
      );
      setResolving(null);
      drift.reload();
      tasks.reload();
      refreshNav();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  const cards: Array<{ key: string; label: string; value: number; hint: string; alert?: boolean }> = [
    { key: 'queued', label: '待同步', value: stats.queued ?? 0, hint: '过审后入队，分钟级推送' },
    { key: 'running', label: '同步中', value: stats.running ?? 0, hint: '推送执行中' },
    { key: 'synced', label: '已同步', value: stats.synced ?? 0, hint: 'Zendesk 端内容与本台一致' },
    { key: 'failed', label: '失败 · 阻断', value: (stats.failed ?? 0) + (stats.blocked ?? 0), hint: '失败自动重试 3 次后告警', alert: true },
  ];

  return (
    <>
      <div className="grid grid--4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`stat${filter === c.key ? ' stat--active' : ''}`}
            onClick={() => setFilter(filter === c.key ? null : c.key)}
          >
            <div className="stat__label">{c.label}</div>
            <div className="stat__value" style={c.alert && c.value > 0 ? { color: 'var(--bad-fg)' } : undefined}>
              {c.value}
            </div>
            <div className="stat__hint">{c.hint}</div>
          </button>
        ))}
      </div>

      {unresolved.length > 0 && (
        <div className="note note--bad" style={{ marginTop: 16 }} data-testid="drift-alert">
          <div className="strong">{zhCN.sync.driftAlert(unresolved.length)}</div>
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr><th>文章</th><th>修改方</th><th>差异摘要</th><th>检出时间</th><th>处置</th></tr>
            </thead>
            <tbody>
              {unresolved.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="strong">{d.title}</div>
                    <div className="meta">{d.entryCode} · {d.articleRef}</div>
                  </td>
                  <td>{d.changedBy}</td>
                  <td>{d.diffSummary}</td>
                  <td>{fmtTime(d.detectedAt)}</td>
                  <td>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={!canOperate}
                        title={canOperate ? undefined : '覆盖动作仅审核员可执行'}
                        onClick={() => setResolving({ row: d, action: 'overwrite' })}
                        data-testid="drift-overwrite"
                      >
                        以本台内容覆盖
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={!canOperate}
                        title={canOperate ? undefined : '拉回动作仅审核员可执行'}
                        onClick={() => setResolving({ row: d, action: 'pull_back' })}
                        data-testid="drift-pullback"
                      >
                        拉回进审核队列
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note" style={{ marginTop: 12 }}>{drift.data?.governanceNote ?? zhCN.sync.driftGovernance}</div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <h2 className="card__title" style={{ margin: 0, flex: 1 }}>
            同步任务{filter ? ` · 已筛选「${L.syncStatus(filter)}」` : ''}
          </h2>
          <button type="button" className="btn btn--sm" disabled={!canOperate} onClick={scan} title={canOperate ? undefined : '仅审核员可触发'}>
            立即扫描 drift
          </button>
          {filter && <button type="button" className="btn btn--sm" onClick={() => setFilter(null)}>清除筛选</button>}
        </div>
        {tasks.loading && <div className="empty">加载中…</div>}
        {!tasks.loading && rows.length === 0 && <div className="empty">没有符合条件的同步任务</div>}
        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>条目</th><th>版本</th><th>动作</th><th>目标</th><th>状态</th><th>语言</th><th>更新时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className={t.status === 'failed' || t.status === 'blocked' ? 'row--alert' : undefined}>
                  <td>
                    <div className="strong">{t.entryTitle}</div>
                    <div className="meta">{t.entryCode}</div>
                  </td>
                  <td>{t.versionLabel}</td>
                  <td>{t.action}</td>
                  <td>{t.target}</td>
                  <td>
                    <StatusPill kind={syncStatusKind(t.status)} text={L.syncStatus(t.status)} />
                    {t.failReason && <div className="meta" style={{ color: 'var(--bad-fg)' }}>{t.failReason}</div>}
                    {t.blockedReason && <div className="meta" style={{ color: 'var(--bad-fg)' }}>{t.blockedReason}</div>}
                  </td>
                  <td>{t.languages}</td>
                  <td>{fmtTime(t.updatedAt)}</td>
                  <td>
                    {t.status === 'failed' && (
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={!canOperate}
                        title={canOperate ? undefined : '手动重试仅知识审核员可点'}
                        onClick={() => retry(t)}
                        data-testid="sync-retry"
                      >
                        手动重试
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note" style={{ marginTop: 12 }}>{tasks.data?.stateMachineNote ?? zhCN.sync.stateMachine}</div>
      </div>

      <div className="card">
        <h2 className="card__title">结构映射表</h2>
        <table>
          <thead><tr><th>本台结构</th><th>Zendesk 结构</th><th>可见性</th></tr></thead>
          <tbody>
            {(mapping.data?.rows ?? []).map((m) => (
              <tr key={m.local}>
                <td>{m.local}</td>
                <td className="mono">{m.zendesk}</td>
                <td><StatusPill kind={m.visibility === '对外公开' ? 'ok' : 'warn'} text={m.visibility} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 12 }}>{mapping.data?.note ?? zhCN.sync.mappingNote}</div>
      </div>

      {resolving && (
        <ConfirmModal
          title={resolving.action === 'overwrite' ? `以本台内容覆盖「${resolving.row.title}」` : `拉回「${resolving.row.title}」进审核队列`}
          confirmText={resolving.action === 'overwrite' ? '确认覆盖' : '确认拉回'}
          danger={resolving.action === 'overwrite'}
          onCancel={() => setResolving(null)}
          onConfirm={resolveDrift}
          consequences={
            resolving.action === 'overwrite'
              ? ['Zendesk 端的修改将被丢弃（本台版本重新推送）', '处置动作写入操作日志（含处置人与时间）', '本台仍为唯一权威源']
              : ['Zendesk 端内容作为待审来源进入审核中心', '过审后才会重新同步生效', '处置动作写入操作日志（含处置人与时间）']
          }
        />
      )}
    </>
  );
}
