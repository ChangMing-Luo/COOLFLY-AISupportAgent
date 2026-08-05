import { useCallback, useEffect, useState } from 'react';
import { zhCN, type Permission, type SessionUser } from '@kb/contracts';
import { api, ApiError } from './api';
import { AppContext, type NavCounts, type ViewKey } from './shared';
import { LoginView } from './views/Login';
import { WorkbenchView } from './views/Workbench';
import { KbOverviewView } from './views/KbOverview';
import { EntryWorkbenchView } from './views/EntryWorkbench';
import { MiningView } from './views/Mining';
import { ReviewView } from './views/Review';
import { SyncView } from './views/Sync';
import { DashboardView } from './views/Dashboard';
import { FeedbackView } from './views/Feedback';
import { AuditView } from './views/Audit';
import { RbacView } from './views/Rbac';

const NAV: Array<{ group: string; items: Array<{ key: ViewKey; label: string; badge?: keyof NavCounts; perm?: Permission }> }> = [
  { group: zhCN.nav.groupWorkbench, items: [{ key: 'work', label: zhCN.nav.work }] },
  {
    group: zhCN.nav.groupProduction,
    items: [
      { key: 'kb', label: zhCN.nav.kb, badge: 'kb' },
      { key: 'entry', label: zhCN.nav.entry },
      { key: 'mine', label: zhCN.nav.mine, badge: 'mine' },
    ],
  },
  {
    group: zhCN.nav.groupQuality,
    items: [
      { key: 'review', label: zhCN.nav.review, badge: 'review' },
      { key: 'sync', label: zhCN.nav.sync, badge: 'sync' },
    ],
  },
  {
    group: zhCN.nav.groupData,
    items: [
      { key: 'dash', label: zhCN.nav.dash, perm: 'metrics.view' },
      { key: 'feedback', label: zhCN.nav.feedback, badge: 'feedback', perm: 'metrics.view' },
    ],
  },
  {
    group: zhCN.nav.groupGovernance,
    items: [
      { key: 'logs', label: zhCN.nav.logs },
      { key: 'rbac', label: zhCN.nav.rbac, perm: 'rbac.manage' },
    ],
  },
];

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<ViewKey>('work');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [counts, setCounts] = useState<NavCounts>({ kb: 0, review: 0, sync: 0, mine: 0, feedback: 0 });
  const [toastMsg, setToastMsg] = useState('');

  const refreshNav = useCallback(() => {
    api.get<NavCounts>('/api/nav/counts').then(setCounts).catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (user) refreshNav();
  }, [user, view, refreshNav]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(''), 3600);
  }, []);

  if (booting) return <div className="empty">加载中…</div>;
  if (!user) return <LoginView onLoggedIn={setUser} />;

  const can = (p: Permission): boolean => user.permissions.includes(p);
  const goto = (v: ViewKey, id?: string): void => {
    // 进入条目工作台不带 id = 新建；不清空会残留上一次打开的条目 id，
    // 使「新建条目」入口去加载旧条目（旧条目已删时直接报「条目不存在」）
    if (v === 'entry') setEntryId(id ?? null);
    else if (id) setEntryId(id);
    setView(v);
  };

  const currentTitle = zhCN.nav[view as keyof typeof zhCN.nav] as string;
  const crumb = zhCN.crumbs[view as keyof typeof zhCN.crumbs] as string;

  return (
    <AppContext.Provider value={{ user, refreshNav, navCounts: counts, toast, can, goto }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand__name">{zhCN.app.brand}</div>
            <div className="brand__title">{zhCN.app.title}</div>
            <div className="brand__sub">{zhCN.app.subtitle}</div>
          </div>
          <nav className="nav" aria-label="主导航">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="nav__group">{g.group}</div>
                {g.items.map((item) => {
                  const denied = item.perm ? !can(item.perm) : false;
                  const badge = item.badge ? counts[item.badge] : undefined;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav__item${view === item.key ? ' nav__item--active' : ''}`}
                      onClick={() => (denied ? toast(`当前角色（${user.role === 'ai_ops' ? 'AI 运营' : '本角色'}）无「${item.label}」权限`) : goto(item.key))}
                      disabled={denied}
                      data-view={item.key}
                      title={denied ? '当前角色无此视图权限' : undefined}
                    >
                      {item.label}
                      {badge !== undefined && badge > 0 && (
                        <span className={`nav__badge${item.badge === 'sync' ? ' nav__badge--alert' : ''}`}>{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="identity">
            当前身份：<span className="strong">{user.name}</span> · {roleLabel(user.role)}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => api.logout().then(() => setUser(null))}
              >
                退出登录
              </button>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div>
              <div className="topbar__crumb">{crumb}</div>
              <h1 className="topbar__title">{currentTitle}</h1>
            </div>
            <div className="topbar__right">
              <span className="pill pill--accent">{user.name} · {roleLabel(user.role)}</span>
              <span className="pill">待审 {counts.review}</span>
              <span className={counts.sync > 0 ? 'pill pill--bad' : 'pill'}>同步失败 {counts.sync}</span>
            </div>
          </header>
          <div className="content" data-current-view={view}>
            {view === 'work' && <WorkbenchView />}
            {view === 'kb' && <KbOverviewView />}
            {view === 'entry' && <EntryWorkbenchView entryId={entryId} />}
            {view === 'mine' && <MiningView />}
            {view === 'review' && <ReviewView />}
            {view === 'sync' && <SyncView />}
            {view === 'dash' && <DashboardView />}
            {view === 'feedback' && <FeedbackView />}
            {view === 'logs' && <AuditView />}
            {view === 'rbac' && <RbacView />}
          </div>
        </main>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppContext.Provider>
  );
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    kb_manager: '知识管理员',
    kb_reviewer: '知识审核员',
    ai_ops: 'AI 运营',
    sys_admin: '系统管理员',
  };
  return map[role] ?? role;
}

export { ApiError };
