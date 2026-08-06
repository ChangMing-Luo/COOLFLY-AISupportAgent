import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type CatalogCategory, type SessionUser } from './api.js';
import {
  AppCtx,
  BESPOKE,
  NAV,
  type Ctx,
  type DrawerState,
  type ModalState,
  type ProgressState,
  type ToastNext,
} from './shell.js';
import { Progress } from './views/Progress.js';
import { Importer } from './views/Importer.js';
import { C, Skeleton, tnum } from './ui.js';
import { Login } from './views/Login.js';
import { ChangePassword } from './views/ChangePassword.js';
import { Dashboard } from './views/Dashboard.js';
import { ListPage } from './views/ListPage.js';
import { Extract } from './views/Extract.js';
import { Editor } from './views/Editor.js';
import { Detail } from './views/Detail.js';
import { ReviewPage } from './views/ReviewPage.js';
import { Health } from './views/Health.js';
import { Drawer } from './views/Drawer.js';
import { Modal } from './views/Modal.js';
import { Adopt } from './views/Adopt.js';

interface ToastItem {
  id: number;
  title: string;
  detail: string;
  next?: ToastNext;
}

interface Badges {
  review: number;
  feedback: number;
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booted, setBooted] = useState(false);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [route, setRoute] = useState('dash');
  const [openGroup, setOpenGroup] = useState('dash');
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<{ code: string; title: string; meta: string }>>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [rev, setRev] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [stat, setStat] = useState({ total: 0, publishedToday: 0, todo: 0 });
  const [badges, setBadges] = useState<Badges>({ review: 0, feedback: 0 });
  const toastSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadShell = useCallback(async () => {
    const d = await api.get<{
      stat: { total: number; publishedToday: number; todo: number };
      kpis: Array<{ label: string; value: number }>;
    }>('/dashboard');
    setStat(d.stat);
    setBadges({
      review: d.kpis.find((k) => k.label === '待我审核')?.value ?? 0,
      feedback: d.kpis.find((k) => k.label === '待处理反馈')?.value ?? 0,
    });
  }, []);

  useEffect(() => {
    api
      .get<{ user: SessionUser; catalog: CatalogCategory[] }>('/bootstrap')
      .then((d) => {
        setUser(d.user);
        setCatalog(d.catalog);
        return loadShell();
      })
      .catch(() => undefined)
      .finally(() => setBooted(true));
  }, [loadShell]);

  const refreshShell = useCallback(() => {
    setRev((n) => n + 1);
    void loadShell();
    api
      .get<{ catalog: CatalogCategory[] }>('/bootstrap')
      .then((d) => setCatalog(d.catalog))
      .catch(() => undefined);
  }, [loadShell]);

  const go = useCallback((next: string, nextSel?: string | null) => {
    setRoute(next);
    setOpenGroup(next.split('.')[0]);
    if (nextSel !== undefined) setSel(nextSel);
    setQuery('');
    setHits([]);
    // 抽屉与弹窗必须随路由关掉：它们浮在新页面上、里面的动作却还指向上一页的对象
    // （toast 的「前往 →」按钮 zIndex 高于抽屉，开着抽屉也能点到）
    setDrawer(null);
    setModal(null);
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), 380);
  }, []);

  const runWithProgress = useCallback(
    async (
      title: string,
      steps: Array<{ label: string; run: (c: { setDetail: (d: string) => void }) => Promise<unknown> }>,
      onCancel?: () => void,
    ) => {
      setProgress({
        title,
        steps: steps.map((s) => ({ label: s.label, state: 'pending' })),
        done: false,
        onCancel,
      });
      for (let i = 0; i < steps.length; i += 1) {
        setProgress((p) =>
          p ? { ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, state: 'running' } : s)) } : p,
        );
        const setDetail = (d: string): void =>
          setProgress((p) => (p ? { ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, detail: d } : s)) } : p));
        try {
          await steps[i].run({ setDetail });
          setProgress((p) =>
            p ? { ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, state: 'done' } : s)) } : p,
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : '未知错误';
          setProgress((p) =>
            p
              ? {
                  ...p,
                  done: true,
                  steps: p.steps.map((s, j) =>
                    j === i ? { ...s, state: 'failed', detail: message } : j > i ? { ...s, state: 'pending' } : s,
                  ),
                }
              : p,
          );
          return;
        }
      }
      setProgress((p) => (p ? { ...p, done: true } : p));
    },
    [],
  );

  const toast = useCallback((title: string, detail: string, next?: ToastNext) => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((list) => [...list, { id, title, detail, next }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 9000);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get<{ hits: Array<{ code: string; title: string; meta: string }> }>(
          `/search?q=${encodeURIComponent(query.trim())}`,
        )
        .then((d) => {
          if (!cancelled) setHits(d.hits);
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  if (!booted) return null;
  if (!user) {
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          if (u.mustChangePassword) return;
          void api.get<{ catalog: CatalogCategory[] }>('/bootstrap').then((d) => setCatalog(d.catalog));
          void loadShell();
        }}
      />
    );
  }
  // 服务端会把未改初始密码的账号拦成 428，界面必须先把改密这一步走完
  if (user.mustChangePassword) {
    return (
      <ChangePassword
        user={user}
        onDone={(u) => {
          setUser(u);
          void api.get<{ catalog: CatalogCategory[] }>('/bootstrap').then((d) => setCatalog(d.catalog));
          void loadShell();
        }}
      />
    );
  }

  const denied = route.startsWith('admin') && user.role !== 'super';
  const bespoke = BESPOKE[route];
  const ctx: Ctx = {
    user,
    catalog,
    route,
    sel,
    go,
    toast,
    openDrawer: setDrawer,
    openModal: setModal,
    runWithProgress,
    refreshShell,
    rev,
  };

  const badgeOf = (key: string): number | null => {
    const n = key === 'review' ? badges.review : key === 'feedback' ? badges.feedback : 0;
    return n > 0 ? n : null;
  };

  async function switchLogout() {
    setModal({ type: 'switch' });
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div
        style={{
          width: 1440,
          minHeight: 960,
          display: 'flex',
          background: C.bg,
          color: C.text,
          fontFamily: 'var(--font-body)',
          ['--rp' as string]: '11px',
          ['--mp' as string]: '26px',
          ['--fs' as string]: '14px',
        }}
      >
        {/* ══ 左侧栏 236px ══ */}
        <aside
          style={{
            width: 236,
            flex: 'none',
            borderRight: `1px solid ${C.divider}`,
            background: C.surface,
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: 960,
          }}
        >
          <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, letterSpacing: '.02em' }}>COOLFLY</div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: C.accent,
                marginTop: 3,
              }}
            >
              知识运营中台
            </div>
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0 24px' }}>
            {NAV.map((g, i) => {
              const active = openGroup === g.key;
              const badge = badgeOf(g.key);
              return (
                <div key={g.key} style={{ marginBottom: 2 }}>
                  <button
                    onClick={() => go(g.children.length ? g.children[0][0] : g.key)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 9,
                      padding: '8px 20px',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      fontSize: 14.5,
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: '.06em',
                        ...tnum,
                        color: C.muted500,
                        width: 14,
                        flex: 'none',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ flex: 1, color: active ? C.accent : C.text }}>{g.label}</span>
                    {badge ? (
                      <span
                        style={{
                          fontSize: 10,
                          ...tnum,
                          color: C.accent700,
                          border: '1px solid var(--color-accent-300)',
                          borderRadius: 2,
                          padding: '0 4px',
                        }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </button>
                  {active && g.children.length > 0 ? (
                    <div style={{ padding: '2px 0 8px 43px', display: 'flex', flexDirection: 'column' }}>
                      {g.children.map(([r, label]) => {
                        const on =
                          route === r ||
                          (r === 'kb.list' && route === 'kb.detail') ||
                          (r === 'author.drafts' && route === 'author.editor') ||
                          (r === 'review.queue' && route === 'review.detail');
                        return (
                          <button
                            key={r}
                            onClick={() => go(r)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                              padding: '5px 14px 5px 0',
                              background: 'transparent',
                              border: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: 13,
                              fontFamily: 'var(--font-body)',
                              color: 'inherit',
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                height: 1,
                                flex: 'none',
                                background: route === r ? C.accent : C.divider,
                              }}
                            />
                            <span style={{ flex: 1, color: on ? C.accent : C.muted }}>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div
            style={{
              padding: '14px 20px',
              borderTop: `1px solid ${C.divider}`,
              fontSize: 11,
              color: C.muted,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>知识总量</span>
              <span style={tnum}>{stat.total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span>今日发布</span>
              <span style={tnum}>{stat.publishedToday}</span>
            </div>
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* ══ 顶栏 ══ */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '14px 28px',
              borderBottom: `1px solid ${C.divider}`,
              background: C.bg,
              position: 'sticky',
              top: 0,
              zIndex: 20,
            }}
          >
            <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
              <input
                className="input"
                placeholder="搜索知识、场景、分类或知识 ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 30 }}
              />
              <span style={{ position: 'absolute', left: 10, top: 8, color: C.muted500, fontSize: 13 }}>⌕</span>
            </div>
            {query ? (
              <div
                style={{
                  position: 'absolute',
                  top: 56,
                  left: 28,
                  width: 400,
                  background: C.surface,
                  border: `1px solid ${C.divider}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 40,
                  padding: 6,
                }}
              >
                {hits.map((h) => (
                  <button
                    key={h.code}
                    onClick={() => {
                      setQuery('');
                      go('kb.detail', h.code);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 9px',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      color: 'inherit',
                    }}
                  >
                    <div>{h.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{h.meta}</div>
                  </button>
                ))}
                {hits.length === 0 ? (
                  <div style={{ padding: '14px 9px', fontSize: 12.5, color: C.muted }}>
                    未匹配到知识。可在反馈回流登记为未命中问题，进入采集闭环。
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-secondary"
              onClick={() => go(badges.review ? 'review.queue' : 'feedback.list')}
              style={{ fontSize: 13 }}
            >
              待办 <span style={{ ...tnum, color: C.accent700, marginLeft: 4 }}>{stat.todo}</span>
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 16,
                borderLeft: `1px solid ${C.divider}`,
              }}
            >
              <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                <div style={{ fontSize: 13 }}>{user.name}</div>
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: C.accent,
                  }}
                >
                  {user.roleLabel}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={switchLogout} style={{ fontSize: 12 }}>
                切换
              </button>
            </div>
          </header>

          {/* ══ 主区 ══ */}
          <main style={{ flex: 1, padding: 'var(--mp,26px) 28px 60px', minWidth: 0 }}>
            {denied ? (
              <div style={{ maxWidth: 520, margin: '120px auto', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: C.accent,
                  }}
                >
                  403 · 权限不足
                </div>
                <h2 style={{ margin: '12px 0 10px' }}>该模块仅超级管理员可见</h2>
                <p style={{ fontSize: 13.5, color: C.muted700, textWrap: 'pretty' }}>
                  当前登录角色为「知识运营」。系统管理下的用户与角色、权限矩阵、操作审计需要超管权限。如需查看，请联系管理员授权或切换角色。
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                  <button className="btn btn-primary" onClick={switchLogout}>
                    切换为超管
                  </button>
                  <button className="btn btn-secondary" onClick={() => go('dash')}>
                    返回工作台
                  </button>
                </div>
              </div>
            ) : loading ? (
              <Skeleton />
            ) : route === 'dash' ? (
              <Dashboard />
            ) : bespoke === 'extract' ? (
              <Extract />
            ) : bespoke === 'editor' ? (
              <Editor />
            ) : bespoke === 'detail' ? (
              <Detail />
            ) : bespoke === 'reviewPage' ? (
              <ReviewPage />
            ) : bespoke === 'health' ? (
              <Health />
            ) : route === 'author.import' ? (
              <Importer />
            ) : (
              <ListPage />
            )}
          </main>
        </div>

        {drawer ? <Drawer state={drawer} onClose={() => setDrawer(null)} /> : null}
        {modal?.type === 'adopt' ? (
          <Adopt code={modal.code} onClose={() => setModal(null)} />
        ) : modal ? (
          <Modal state={modal} onClose={() => setModal(null)} />
        ) : null}
        {progress ? <Progress state={progress} onClose={() => setProgress(null)} /> : null}

        {/* ══ Toast ══ */}
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'flex-end',
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                width: 392,
                background: C.surface,
                border: `1px solid ${C.divider}`,
                borderLeft: `2px solid ${C.accent}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: '14px 16px',
                animation: 'toastIn .2s ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 12.5, color: C.muted700, marginTop: 3, textWrap: 'pretty' }}>
                    {t.detail}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}
                  style={{ fontSize: 13, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
              {t.next ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 9,
                    paddingTop: 9,
                    borderTop: `1px solid ${C.divider}`,
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setToasts((l) => l.filter((x) => x.id !== t.id));
                      go(t.next!.route, t.next!.sel ?? undefined);
                    }}
                    style={{ fontSize: 12.5, padding: '4px 12px' }}
                  >
                    {t.next.label} →
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AppCtx.Provider>
  );
}

export { ApiError };
