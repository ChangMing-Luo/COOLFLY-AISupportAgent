import { useEffect, useState } from 'react';
import { PERMISSIONS, PERMISSION_DENIED_TEXT, PERMISSION_LABELS, ROLE_NOTES } from '@kb/contracts';
import { api } from '../api';
import { L, StatusPill, entryStatusKind, fmtTime, useApp, useAsync } from '../shared';

/** 分组四选一：与服务端 /api/workbench groups 键一一对应 */
type GroupKey = 'drafts' | 'submitted' | 'rejected' | 'toReview';

interface WorkRow {
  id: string;
  code: string;
  title: string;
  status: string;
  enStatus: string;
  path: string;
  updatedAt: string;
  rejectReason: string | null;
  nextAction: string;
  selfSubmitted: boolean;
}

interface WorkbenchData {
  canReview: boolean;
  cards: { drafts: number; submitted: number; rejected: number; toReview: number | null };
  groups: Record<GroupKey, WorkRow[]>;
  emptyHint: string | null;
}

const CARD_META: Array<{ key: GroupKey; label: string; hint: string }> = [
  { key: 'drafts', label: '我的草稿', hint: '未提交，仅自己可见' },
  { key: 'submitted', label: '我提交待审', hint: '等待审核员处理' },
  { key: 'rejected', label: '被驳回待改', hint: '带审核意见回退' },
  { key: 'toReview', label: '待我审核', hint: '含 AI 挖掘与人工提交' },
];

const TAB_META: Array<{ key: GroupKey; label: string }> = [
  { key: 'drafts', label: '我的草稿箱' },
  { key: 'submitted', label: '我提交的' },
  { key: 'rejected', label: '被驳回' },
  { key: 'toReview', label: '待我审核' },
];

const TAB_HINT: Record<GroupKey, string> = {
  drafts: '草稿仅本人可见，提交后进审核中心',
  submitted: '提交后由知识审核员处理，可在此看进度',
  rejected: '按审核意见修改后可重新提交',
  toReview: '状态与下一步动作由 RBAC 决定',
};

function emptyNote(group: GroupKey, data: WorkbenchData): string {
  if (group === 'toReview') return data.emptyHint ?? '待审队列已清空——当前没有等待你处理的条目。';
  if (group === 'submitted') return '你还没有提交待审的条目。';
  if (group === 'rejected') return '没有被驳回的条目——驳回会连同审核意见回退到这里。';
  return '换个分组，或新建一条知识条目。';
}

export function WorkbenchView() {
  const { user, can, goto, toast } = useApp();
  const [group, setGroup] = useState<GroupKey>('drafts');
  const { data, loading, error } = useAsync<WorkbenchData>(() => api.get<WorkbenchData>('/api/workbench'), []);

  useEffect(() => {
    if (error) toast(error);
  }, [error, toast]);

  const canCreate = can('entry.write');

  if (loading) return <div className="empty">加载中…</div>;
  if (error) return <div className="note note--bad">{error}</div>;
  if (!data) return <div className="empty">暂无工作台数据</div>;

  const rows = data.groups[group];

  return (
    <>
      <div className="grid grid--4">
        {CARD_META.map((c) => {
          const blocked = c.key === 'toReview' && !data.canReview;
          const value = blocked ? '—' : String(data.cards[c.key] ?? 0);
          return (
            <button
              key={c.key}
              type="button"
              className={`stat${group === c.key ? ' stat--active' : ''}`}
              onClick={() => setGroup(c.key)}
              data-card={c.key}
            >
              <div className="stat__label">{c.label}</div>
              <div className="stat__value">{value}</div>
              <div className="stat__hint">{blocked ? '（无审核权限）审核属于知识审核员' : c.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
            {TAB_META.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tab${group === t.key ? ' tab--active' : ''}`}
                onClick={() => setGroup(t.key)}
                aria-pressed={group === t.key}
              >
                {t.label}（{data.groups[t.key].length}）
              </button>
            ))}
          </div>
          <div className="btn-row">
            <span className="meta">{TAB_HINT[group]}</span>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canCreate}
              title={canCreate ? '进入条目工作台新建中文草稿' : PERMISSION_DENIED_TEXT['entry.write']}
              onClick={() => goto('entry')}
            >
              新建条目
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            这个分组暂无条目
            <div className="meta" style={{ marginTop: 6 }}>{emptyNote(group, data)}</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>条目</th>
                <th>所属结构</th>
                <th>状态</th>
                <th>中文 / 英文</th>
                <th>最近操作</th>
                <th>下一步动作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="row--click" onClick={() => goto('entry', r.id)}>
                  <td>
                    <div className="strong">{r.title}</div>
                    <div className="mono meta">{r.code}</div>
                    {r.status === 'rejected' && r.rejectReason && (
                      <div className="note note--bad" style={{ marginTop: 6 }}>驳回理由：{r.rejectReason}</div>
                    )}
                  </td>
                  <td>{r.path}</td>
                  <td>
                    <StatusPill kind={entryStatusKind(r.status)} text={L.entryStatus(r.status)} />
                  </td>
                  <td>中文 已保存 / 英文 {L.enStatus(r.enStatus)}</td>
                  <td className="meta">{fmtTime(r.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        goto('entry', r.id);
                      }}
                    >
                      {r.nextAction}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">你的角色能做什么（RBAC 生效范围）</h2>
        <div className="btn-row">
          {PERMISSIONS.map((p) => (
            <StatusPill
              key={p}
              kind={user.permissions.includes(p) ? 'ok' : 'bad'}
              text={`${user.permissions.includes(p) ? '可' : '禁'} ${PERMISSION_LABELS[p]}`}
            />
          ))}
        </div>
        <div className="meta" style={{ marginTop: 10 }}>
          {L.role(user.role)}：{ROLE_NOTES[user.role]}
        </div>
      </div>
    </>
  );
}
