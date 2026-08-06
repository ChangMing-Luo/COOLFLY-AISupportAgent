import { useEffect, useState } from 'react';
import { api, type MissDto } from '../api.js';
import { useApp, type DrawerState } from '../shell.js';
import { C, tnum } from '../ui.js';
import { ChecksCard, CommentBox, DiffBlock, doApprove, doReject, useReview } from './ReviewPage.js';
import { draftFromMiss } from './ListPage.js';

const MISS_STEPS = [
  { l: '登记未命中问题', d: '召回为空或低置信的提问自动聚类到此，并生成 AI 摘要。' },
  { l: '新建条目 · 撰写新知识', d: '直接新建草稿，用新知识覆盖该未命中场景。' },
  { l: '补全正文并翻译', d: '补全中文正文、选择场景，翻译为英文。' },
  { l: '提交审核并发布', d: '审核通过后写入知识库并同步 Zendesk。' },
  { l: '回流验证', d: '在坐席 / 用户侧验证该问题已可命中。' },
];

const STEP_STYLE = {
  done: { ring: 'var(--color-accent)', fill: 'var(--color-accent)', fg: 'var(--color-bg)', titleCol: 'var(--color-text)' },
  current: {
    ring: 'var(--color-accent)',
    fill: 'var(--color-accent-100)',
    fg: 'var(--color-accent-800)',
    titleCol: 'var(--color-accent-800)',
  },
  todo: { ring: 'var(--color-divider)', fill: 'transparent', fg: 'var(--color-neutral-500)', titleCol: 'var(--color-neutral-600)' },
};

export function Drawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
  const app = useApp();
  const [comment, setComment] = useState('');
  const [review] = useReview(state?.kind === 'review' ? state.code : null);
  const [miss, setMiss] = useState<MissDto | null>(null);
  const [metaZh, setMetaZh] = useState('');
  const [metaEn, setMetaEn] = useState('');
  const [metaType, setMetaType] = useState('业务');
  const [metaParentId, setMetaParentId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userDept, setUserDept] = useState('客服运营');
  const [userRole, setUserRole] = useState<'super' | 'ops'>('ops');
  const [userReview, setUserReview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state?.kind === 'meta') {
      setMetaZh(state.zh);
      setMetaEn(state.en);
      setMetaType(state.type);
      setMetaParentId(state.parentId);
    }
    if (state?.kind === 'user') {
      setUserName(state.name ?? '');
      setUserEmail(state.email ?? '');
      setUserDept(state.department ?? '客服运营');
      setUserRole(state.role ?? 'ops');
      setUserReview(state.reviewGranted ?? false);
    }
    if (state?.kind === 'miss') {
      api
        .get<{ misses: MissDto[] }>('/misses')
        .then((d) => setMiss(d.misses.find((m) => m.code === state.code) ?? null))
        .catch(() => undefined);
    }
  }, [state]);

  if (!state) return null;

  let kicker = '';
  let title = '';
  let meta = '';
  let actions: Array<{ l: string; cls: string; on: () => void | Promise<void> }> = [];

  if (state.kind === 'review' && review) {
    kicker = `审核 · ${review.entry.code}`;
    title = review.entry.titleZh;
    meta = review.meta;
    actions = [
      {
        l: '驳回',
        cls: 'btn-secondary',
        on: async () => {
          if (await doReject(app, review.entry.code, comment)) onClose();
        },
      },
      {
        l: '通过并发布',
        cls: 'btn-primary',
        on: async () => {
          setBusy(true);
          try {
            await doApprove(app, review.entry.code, comment);
            onClose();
          } finally {
            setBusy(false);
          }
        },
      },
    ];
  } else if (state.kind === 'meta') {
    const isTag = state.metaKind === '标签';
    kicker = `${state.id ? '编辑' : '新增'}${state.metaKind}${isTag ? ' · 本地维护' : ' · 中英双语'}`;
    title = state.zh || `新增${state.metaKind}`;
    meta = isTag
      ? '仅本地，不同步 Zendesk'
      : state.metaKind === '场景'
        ? '对应 Zendesk Section'
        : '对应 Zendesk Category';
    actions = [
      { l: '取消', cls: 'btn-secondary', on: onClose },
      {
        l: '保存',
        cls: 'btn-primary',
        on: async () => {
          setBusy(true);
          try {
            if (state.metaKind === '分类') {
              const body = { nameZh: metaZh, nameEn: metaEn };
              if (state.id) await api.put(`/meta/categories/${state.id}`, body);
              else await api.post('/meta/categories', body);
            } else if (state.metaKind === '场景') {
              const body = { nameZh: metaZh, nameEn: metaEn, categoryId: metaParentId };
              if (state.id) await api.put(`/meta/scenes/${state.id}`, body);
              else await api.post('/meta/scenes', body);
            } else {
              const body = { name: metaZh, type: metaType };
              if (state.id) await api.put(`/meta/tags/${state.id}`, body);
              else await api.post('/meta/tags', body);
            }
            app.refreshShell();
            app.toast(
              '已保存',
              isTag
                ? `${state.metaKind}「${metaZh}」已保存（本地，不翻译）。`
                : `${state.metaKind}「${metaZh}」英文名「${metaEn}」已保存，将同步至 Zendesk 目录。`,
            );
            onClose();
          } catch (e) {
            app.toast('保存失败', e instanceof Error ? e.message : '未知错误');
          } finally {
            setBusy(false);
          }
        },
      },
    ];
  } else if (state.kind === 'miss') {
    kicker = '未命中问题 · 处理流程';
    title = state.code;
    meta = `疑似场景 ${miss?.sceneZh ?? '—'}`;
    actions = [
      { l: '关闭', cls: 'btn-secondary', on: onClose },
      {
        l: '新建条目',
        cls: 'btn-primary',
        on: async () => {
          onClose();
          await draftFromMiss(app, state.code);
        },
      },
    ];
  } else if (state.kind === 'info') {
    kicker = '详情';
    title = state.title;
    meta = state.meta;
    actions = [{ l: '关闭', cls: 'btn-secondary', on: onClose }];
    if (state.action) {
      actions.push({
        l: state.action.label,
        cls: 'btn-primary',
        on: async () => {
          setBusy(true);
          try {
            await state.action!.run();
            onClose();
          } finally {
            setBusy(false);
          }
        },
      });
    }
  } else if (state.kind === 'user') {
    const editing = Boolean(state.id);
    kicker = `${editing ? '编辑' : '新增'}用户 · 系统管理`;
    title = editing ? (state.name ?? '编辑用户') : '新增用户';
    meta = editing ? (state.email ?? '') : '角色决定可见模块与可执行操作';
    actions = [
      { l: '取消', cls: 'btn-secondary', on: onClose },
      {
        l: editing ? '保存' : '创建账号',
        cls: 'btn-primary',
        on: async () => {
          setBusy(true);
          try {
            if (editing) {
              await api.put(`/admin/users/${state.id}`, {
                name: userName,
                department: userDept,
                role: userRole,
              });
              if (userRole === 'ops' && userReview !== state.reviewGranted) {
                await api.post(`/admin/users/${state.id}/review-grant`, { granted: userReview });
              }
              app.refreshShell();
              app.toast('已保存', `${userName} 的资料与角色已更新，权限即时生效。`);
            } else {
              const r = await api.post<{ initialPassword: string }>('/admin/users', {
                name: userName,
                email: userEmail,
                department: userDept,
                role: userRole,
                reviewGranted: userReview,
              });
              app.refreshShell();
              app.toast(
                '账号已创建',
                `初始密码：${r.initialPassword}（仅显示这一次，请转交本人并要求首次登录后修改）。`,
              );
            }
            onClose();
          } catch (e) {
            app.toast(editing ? '保存失败' : '创建失败', e instanceof Error ? e.message : '未知错误');
          } finally {
            setBusy(false);
          }
        },
      },
    ];
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--color-neutral-900) 42%, transparent)' }}
      />
      <div
        style={{
          position: 'relative',
          width: 640,
          height: '100%',
          background: C.bg,
          borderLeft: `1px solid ${C.divider}`,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'toastIn .22s ease-out',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${C.divider}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.accent }}>
              {kicker}
            </div>
            <h4 style={{ margin: '6px 0 0' }}>{title}</h4>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3, ...tnum }}>{meta}</div>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          {state.kind === 'review' && review ? (
            <>
              <ChecksCard checks={review.checks} compact />
              <h5 style={{ margin: '0 0 8px' }}>内容对比 · {review.diff.label}</h5>
              <DiffBlock lines={review.diff.lines} compact />
              <h5 style={{ margin: '20px 0 8px' }}>审核意见</h5>
              <CommentBox value={comment} onChange={setComment} compact />
            </>
          ) : null}

          {state.kind === 'meta' ? (
            <>
              <div className="field">
                <label>{state.metaKind}（中文）</label>
                <input className="input" value={metaZh} onChange={(e) => setMetaZh(e.target.value)} />
              </div>
              {state.metaKind === '场景' ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>上级分类</label>
                  <select className="input" value={metaParentId} onChange={(e) => setMetaParentId(e.target.value)}>
                    {app.catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.zh}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {state.metaKind === '标签' ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>标签类型</label>
                  <select className="input" value={metaType} onChange={(e) => setMetaType(e.target.value)}>
                    {['业务', '属性', '动作', '人群'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      margin: '18px 0 8px',
                      paddingTop: 16,
                      borderTop: `1px solid ${C.divider}`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.accent }}
                      >
                        English · 大模型翻译
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {metaEn ? '已翻译，可二次编辑' : '未翻译'}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      disabled={busy || !metaZh.trim()}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await api.post<{ en: string; degraded: boolean }>('/meta/translate', {
                            text: metaZh,
                            kind: state.metaKind,
                          });
                          setMetaEn(r.en);
                          app.toast(
                            '翻译完成',
                            r.degraded
                              ? `「${metaZh}」→「${r.en}」（本地模式，建议人工改写）。`
                              : `「${metaZh}」→「${r.en}」，可二次编辑。`,
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {metaEn ? '重新翻译' : '翻译'}
                    </button>
                  </div>
                  <div className="field">
                    <label>English · 可二次编辑</label>
                    <input
                      className="input"
                      value={metaEn}
                      onChange={(e) => setMetaEn(e.target.value)}
                      placeholder="翻译结果，可编辑"
                    />
                  </div>
                </>
              )}
              <p style={{ fontSize: 12, color: C.muted, marginTop: 14, textWrap: 'pretty' }}>
                {state.metaKind === '标签'
                  ? '标签仅用于本地检索与推荐适配，不翻译。保存后可在列表中上下架。'
                  : '分类与场景对应 Zendesk 目录，同步 Zendesk 时使用英文名称。用户录入中文，大模型翻译为英文并支持人工二次编辑；标签不翻译。'}
              </p>
            </>
          ) : null}

          {state.kind === 'miss' && miss ? (
            <>
              <div
                style={{
                  borderLeft: `2px solid ${C.accent}`,
                  background: 'var(--color-accent-100)',
                  padding: '12px 14px',
                  fontSize: 13,
                  color: 'var(--color-accent-900)',
                }}
              >
                未命中问题：{miss.question}
              </div>
              <div style={{ display: 'flex', gap: 14, margin: '14px 0 16px', fontSize: 12.5, color: C.muted700 }}>
                <span>疑似场景 · {miss.sceneZh}</span>
                <span style={tnum}>近 7 日 {miss.count7d} 次</span>
                <span style={tnum}>命中率 {miss.hitRate}</span>
              </div>
              <div
                style={{
                  border: `1px solid ${C.divider}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: C.accent,
                    marginBottom: 4,
                  }}
                >
                  AI 摘要 · 问题类型与场景
                </div>
                <div style={{ fontSize: 12.5, color: C.muted700, lineHeight: 1.7, textWrap: 'pretty' }}>
                  {miss.aiSummary || '—'}
                </div>
              </div>
              <h5 style={{ margin: '0 0 10px' }}>处理流程</h5>
              <div>
                {MISS_STEPS.map((s, i) => {
                  const stepState =
                    i === 0 ? 'done' : miss.state === 'planned' ? (i <= 1 ? 'done' : 'todo') : i === 1 ? 'current' : 'todo';
                  const sp = STEP_STYLE[stepState as keyof typeof STEP_STYLE];
                  return (
                    <div key={s.l} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flex: 'none',
                          width: 22,
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            border: `1px solid ${sp.ring}`,
                            background: sp.fill,
                            color: sp.fg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            ...tnum,
                          }}
                        >
                          {i + 1}
                        </div>
                        {i < MISS_STEPS.length - 1 ? (
                          <div style={{ width: 1, flex: 1, minHeight: 20, background: C.divider }} />
                        ) : null}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 13.5, color: sp.titleCol }}>{s.l}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 1, textWrap: 'pretty' }}>{s.d}</div>
                      </div>
                      {stepState === 'current' ? (
                        <span className="tag tag-accent" style={{ flex: 'none' }}>
                          当前
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {state.kind === 'user' ? (
            <>
              <div className="field">
                <label>姓名</label>
                <input className="input" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>邮箱（登录账号）{state.id ? ' · 创建后不可改' : ''}</label>
                <input
                  className="input"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@coolfly.com"
                  disabled={Boolean(state.id)}
                />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>部门</label>
                <input className="input" value={userDept} onChange={(e) => setUserDept(e.target.value)} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>角色</label>
                <select
                  className="input"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as 'super' | 'ops')}
                >
                  <option value="ops">知识运营</option>
                  <option value="super">超级管理员</option>
                </select>
              </div>
              {userRole === 'ops' ? (
                <label className="radio" style={{ marginTop: 14 }}>
                  <input type="checkbox" checked={userReview} onChange={(e) => setUserReview(e.target.checked)} />
                  <span className="dot" />
                  同时授予审核权限（审核为单独授予项）
                </label>
              ) : null}
              <p style={{ fontSize: 12, color: C.muted, marginTop: 14, textWrap: 'pretty' }}>
                {state.id
                  ? '姓名、部门与角色可随时调整，改动即时生效并写入审计。邮箱是登录标识，创建后不可修改。'
                  : '创建后系统生成一次性初始密码并在提示中显示，本人首次登录须修改。账号状态、审核授权与停用均可在列表中调整，全部动作写入审计。'}
              </p>
            </>
          ) : null}

          {state.kind === 'info' ? (
            <>
              {state.rows.map((r) => (
                <div
                  key={r.k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '9px 0',
                    borderBottom: `1px solid ${C.divider}`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: C.muted, flex: 'none' }}>{r.k}</span>
                  <span style={{ textAlign: 'right' }}>{r.v}</span>
                </div>
              ))}
              {state.body ? (
                <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.8, textAlign: 'justify' }}>{state.body}</p>
              ) : null}
            </>
          ) : null}
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${C.divider}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          {actions.map((a) => (
            <button key={a.l} className={`btn ${a.cls}`} disabled={busy} onClick={() => void a.on()}>
              {a.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
