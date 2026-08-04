import { useState } from 'react';
import { zhCN, type AuditRow } from '@kb/contracts';
import { api } from '../api';
import { L, StatusPill, fmtTime, useAsync } from '../shared';

/** 视图⑨ 操作日志（页面 MD §5.9）：全量审计流 + 四页签过滤，只增不改不删、长期保留 */
type AuditTab = keyof typeof zhCN.audit.tabs;

const TABS: AuditTab[] = ['all', 'content', 'review', 'admin'];

const SELF_SCOPE_NOTE = '当前角色仅可查看与自己相关的记录（全量审计需知识审核员或系统管理员）';

interface AuditFeed {
  scope: 'all' | 'self';
  appendOnlyNote: string;
  rows: AuditRow[];
}

export function AuditView() {
  const [tab, setTab] = useState<AuditTab>('all');
  const feed = useAsync(() => api.get<AuditFeed>(`/api/audit/logs?category=${tab}`), [tab]);
  const rows = feed.data?.rows ?? [];

  return (
    <>
      <div className="note">
        {feed.data?.appendOnlyNote ?? zhCN.audit.appendOnly}——谁 / 何时 / 对什么对象 / 做了什么 / 改前改后，全链留痕不可编辑不可删除。
      </div>
      {feed.data?.scope === 'self' && (
        <div className="note note--warn" data-testid="audit-scope-self">
          {SELF_SCOPE_NOTE}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`tab${tab === t ? ' tab--active' : ''}`}
              onClick={() => setTab(t)}
              data-testid={`audit-tab-${t}`}
            >
              {zhCN.audit.tabs[t]}
            </button>
          ))}
        </div>

        {feed.error && <div className="note note--bad">{feed.error}</div>}

        {feed.loading ? (
          <div className="empty">加载中…</div>
        ) : rows.length === 0 ? (
          <div className="empty">该分类下暂无操作记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人 / 角色</th>
                  <th>对象</th>
                  <th>动作</th>
                  <th>改前 → 改后 / 说明</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-testid="audit-row" data-category={r.category}>
                    <td className="mono muted">{fmtTime(r.at)}</td>
                    <td>
                      <span className="strong">{r.actorName}</span>
                      <span className="muted"> · {L.role(r.actorRole)}</span>
                    </td>
                    <td>{r.objectLabel}</td>
                    <td>
                      <StatusPill kind="accent" text={r.action} />
                    </td>
                    <td>
                      {r.field ? (
                        <div>
                          {r.field}：<span className="pill pill--bad">{r.before ?? '—'}</span>
                          <span className="muted" style={{ margin: '0 6px' }}>
                            →
                          </span>
                          <span className="pill pill--ok">{r.after ?? '—'}</span>
                        </div>
                      ) : (
                        <div className="muted">—</div>
                      )}
                      {r.note && <div className="meta">{r.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="meta" style={{ marginTop: 10 }}>
          四页签口径：内容变更（保存 / 创建版本 / 修订 / 翻译 / 丢弃 / 拉回）、审核与发布（提交 / 通过 / 驳回 / 发布 / 回滚 / 同步）、权限与系统（角色 / 用户 / 启停）；同步与回滚等系统动作以「系统」身份留痕，当前展示最近 300 条。
        </div>
      </div>
    </>
  );
}
