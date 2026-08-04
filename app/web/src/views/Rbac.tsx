import { useState } from 'react';
import { ROLES, ROLE_LABELS, zhCN, type Permission, type Role } from '@kb/contracts';
import { api } from '../api';
import { ConfirmModal, StatusPill, fmtTime, useApp, useAsync } from '../shared';

/** 视图⑩ 用户与权限（页面 MD §5.10）：用户管理 / 角色管理 / 权限矩阵三页签 */
type RbacTab = 'users' | 'roles' | 'matrix';

const TABS: Array<{ key: RbacTab; label: string }> = [
  { key: 'users', label: '用户管理' },
  { key: 'roles', label: '角色管理' },
  { key: 'matrix', label: '权限矩阵' },
];

const NO_MANAGE_NOTE =
  '当前角色只读本页：创建用户、启停账号与修改权限矩阵仅系统管理员可执行（管人不管内容）。';

interface RbacUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  scopeLabel: string;
  enabled: boolean;
  lastActiveAt: string | null;
}

interface RoleCard {
  role: Role;
  label: string;
  note: string;
  userCount: number;
  allowed: string[];
  denied: string[];
}

interface MatrixData {
  roles: Array<{ role: Role; label: string }>;
  rows: Array<{ permission: Permission; label: string; values: boolean[] }>;
}

interface LibraryOption {
  id: string;
  name: string;
}

export function RbacView() {
  const [tab, setTab] = useState<RbacTab>('users');
  const { can } = useApp();
  const manage = can('rbac.manage');

  return (
    <>
      {!manage && <div className="note note--warn">{NO_MANAGE_NOTE}</div>}

      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab${tab === t.key ? ' tab--active' : ''}`}
            onClick={() => setTab(t.key)}
            data-testid={`rbac-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab manage={manage} />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'matrix' && <MatrixTab manage={manage} />}
    </>
  );
}

function UsersTab({ manage }: { manage: boolean }) {
  const { toast } = useApp();
  const users = useAsync(() => api.get<RbacUser[]>('/api/rbac/users'), []);
  const libs = useAsync(() => api.get<LibraryOption[]>('/api/kb/libraries'), []);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(ROLES[0]);
  const [scope, setScope] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDisable, setPendingDisable] = useState<RbacUser | null>(null);

  const rows = users.data ?? [];
  const libraries = libs.data ?? [];

  async function createUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!manage) return;
    if (scope.length === 0) {
      setFormError('知识库范围必选至少一个（可授单库）');
      return;
    }
    if (password.length < 8) {
      setFormError('初始密码至少 8 位');
      return;
    }
    setBusy(true);
    try {
      await api.post<{ id: string }>('/api/rbac/users', {
        name,
        email,
        role,
        libraryScope: scope,
        initialPassword: password,
      });
      toast('已创建用户（首次登录强制改密）');
      setName('');
      setEmail('');
      setRole(ROLES[0]);
      setScope([]);
      setPassword('');
      setFormError('');
      users.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(target: RbacUser, enabled: boolean): Promise<void> {
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`/api/rbac/users/${target.id}/toggle`, { enabled });
      toast(r.message);
      setPendingDisable(null);
      users.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="card__title">用户列表 {rows.length > 0 && <span className="meta">共 {rows.length} 人</span>}</h2>
        {users.error && <div className="note note--bad">{users.error}</div>}
        {users.loading ? (
          <div className="empty">加载中…</div>
        ) : rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>知识库范围</th>
                  <th>最后活跃</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} data-testid={`user-${u.email}`} style={{ opacity: u.enabled ? 1 : 0.62 }}>
                    <td className="strong">{u.name}</td>
                    <td className="mono muted">{u.email}</td>
                    <td>
                      <StatusPill kind="accent" text={u.roleLabel} />
                    </td>
                    <td>{u.scopeLabel}</td>
                    <td className="mono muted">{fmtTime(u.lastActiveAt)}</td>
                    <td>
                      <StatusPill kind={u.enabled ? 'ok' : 'bad'} text={u.enabled ? '启用' : '已禁用'} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={u.enabled ? 'btn btn--sm btn--danger' : 'btn btn--sm'}
                        disabled={!manage}
                        title={manage ? undefined : NO_MANAGE_NOTE}
                        onClick={() => (u.enabled ? setPendingDisable(u) : toggle(u, true))}
                        data-testid={`toggle-${u.email}`}
                      >
                        {u.enabled ? '禁用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : users.error ? null : (
          <div className="empty">暂无用户</div>
        )}
        <div className="meta" style={{ marginTop: 10 }}>
          禁用用户会话即时失效，其历史操作日志与已发布内容全部保留；权限范围按知识库粒度授权（可授单库）。
        </div>
      </div>

      <form className="card" onSubmit={createUser}>
        <h2 className="card__title">创建用户</h2>
        {!manage && <div className="note note--warn">{NO_MANAGE_NOTE}</div>}
        <div className="grid grid--2" style={{ marginTop: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="ru-name">姓名</label>
            <input
              id="ru-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!manage}
              placeholder="例如：周凛"
              data-testid="new-user-name"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="ru-email">邮箱</label>
            <input
              id="ru-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!manage}
              placeholder="例如：zhoulin@coolfly.com"
              data-testid="new-user-email"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="ru-role">角色</label>
            <select
              id="ru-role"
              className="select"
              value={role}
              disabled={!manage}
              onChange={(e) => {
                const next = ROLES.find((r) => r === e.target.value);
                if (next) setRole(next);
              }}
              data-testid="new-user-role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="ru-pwd">初始密码（至少 8 位）</label>
            <input
              id="ru-pwd"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!manage}
              autoComplete="new-password"
              data-testid="new-user-password"
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <span className="field__label">知识库范围（必选至少一个）</span>
          {libs.error && <div className="note note--bad">{libs.error}</div>}
          {libraries.length === 0 && !libs.error ? (
            <div className="meta">{libs.loading ? '知识库加载中…' : '暂无可授权的知识库'}</div>
          ) : (
            <div className="btn-row">
              {libraries.map((lib) => (
                <label key={lib.id} className="pill" style={{ padding: '4px 10px', cursor: manage ? 'pointer' : 'not-allowed' }}>
                  <input
                    type="checkbox"
                    checked={scope.includes(lib.id)}
                    disabled={!manage}
                    onChange={() => {
                      setScope((s) => (s.includes(lib.id) ? s.filter((x) => x !== lib.id) : [...s, lib.id]));
                      setFormError('');
                    }}
                    style={{ marginRight: 6 }}
                    data-testid={`scope-${lib.id}`}
                  />
                  {lib.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {formError && <div className="note note--bad" style={{ marginTop: 10 }} data-testid="new-user-error">{formError}</div>}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!manage || busy}
            title={manage ? undefined : NO_MANAGE_NOTE}
            data-testid="new-user-submit"
          >
            {busy ? '创建中…' : '创建用户'}
          </button>
          <span className="meta">创建即写审计日志；新用户首次登录强制改密。</span>
        </div>
      </form>

      {pendingDisable && (
        <ConfirmModal
          title={`禁用「${pendingDisable.name}」`}
          confirmText="确认禁用"
          danger
          onCancel={() => setPendingDisable(null)}
          onConfirm={() => toggle(pendingDisable, false)}
          consequences={[
            '该账号当前会话即时失效，需重新登录才能继续操作',
            '历史操作日志与已发布内容全部保留（审计只增不改不删）',
            '可随时重新启用，账号数据不丢失',
          ]}
        />
      )}
    </>
  );
}

function RolesTab() {
  const roles = useAsync(() => api.get<RoleCard[]>('/api/rbac/roles'), []);
  const cards = roles.data ?? [];

  if (roles.error) return <div className="note note--bad">{roles.error}</div>;
  if (roles.loading) return <div className="empty">加载中…</div>;

  return (
    <>
      <div className="grid grid--2">
        {cards.map((c) => (
          <div key={c.role} className="card" style={{ marginTop: 0 }} data-testid={`role-card-${c.role}`}>
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="card__title" style={{ margin: 0 }}>{c.label}</h2>
              <span className="meta">{c.userCount} 人</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 10px' }}>{c.note}</p>
            <div className="field" style={{ marginBottom: 8 }}>
              <span className="field__label">允许</span>
              <div className="btn-row">
                {c.allowed.length === 0 ? (
                  <span className="meta">无</span>
                ) : (
                  c.allowed.map((a) => (
                    <span key={a} className="pill pill--ok">{a}</span>
                  ))
                )}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">禁止</span>
              <div className="btn-row">
                {c.denied.length === 0 ? (
                  <span className="meta">无</span>
                ) : (
                  c.denied.map((d) => (
                    <span key={d} className="pill pill--bad">{d}</span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="note" style={{ marginTop: 16 }}>
        角色定位：知识管理员管生产不管发布、知识审核员是审核发布回滚的唯一执行者、AI 运营只读加建议、系统管理员管人不管内容。
      </div>
    </>
  );
}

function MatrixTab({ manage }: { manage: boolean }) {
  const { toast } = useApp();
  const matrix = useAsync(() => api.get<MatrixData>('/api/rbac/matrix'), []);
  const data = matrix.data;

  async function flip(permission: Permission, role: Role, allowed: boolean): Promise<void> {
    try {
      await api.put<{ ok: boolean }>('/api/rbac/matrix', { permission, role, allowed });
      toast('已更新权限矩阵（改动已写审计日志）');
      matrix.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <>
      {!manage && <div className="note note--warn" data-testid="matrix-readonly">{zhCN.ironLaw.matrixAdminOnly}</div>}
      <div className="card" style={{ marginTop: manage ? 0 : 12 }}>
        <h2 className="card__title">权限矩阵 · 10 项 × 4 角色{manage && <span className="meta"> 点格子切换，改动即写审计日志</span>}</h2>
        {matrix.error && <div className="note note--bad">{matrix.error}</div>}
        {!data ? (
          <div className="empty">加载中…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>权限 / 角色</th>
                  {data.roles.map((c) => (
                    <th key={c.role} style={{ textAlign: 'center' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.permission}>
                    <td className="strong">{row.label}</td>
                    {data.roles.map((col, i) => {
                      const allowed = row.values[i];
                      return (
                        <td key={col.role} style={{ textAlign: 'center' }}>
                          {manage ? (
                            <button
                              type="button"
                              className={allowed ? 'btn btn--sm btn--primary' : 'btn btn--sm btn--danger'}
                              onClick={() => flip(row.permission, col.role, !allowed)}
                              title={`${col.label}：${row.label} — 点击切换为${allowed ? '禁止' : '允许'}`}
                              data-testid={`matrix-${row.permission}-${col.role}`}
                            >
                              {allowed ? '✓' : '✗'}
                            </button>
                          ) : (
                            <StatusPill kind={allowed ? 'ok' : 'bad'} text={allowed ? '✓' : '✗'} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="meta" style={{ marginTop: 10 }}>
          硬约束（不可通过矩阵放开）：①提交人不能审核自己提交的版本；②任何角色都不能跳过审核直接同步 Zendesk；③AI 运营始终不可写内容。
        </div>
      </div>
    </>
  );
}
