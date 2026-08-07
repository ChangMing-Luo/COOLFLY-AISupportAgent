import { useState } from 'react';
import { api, type SessionUser } from '../api.js';
import { C, tnum } from '../ui.js';

/**
 * 强制改密页。新增账号拿到的是一次性初始密码，服务端在
 * `must_change_password` 为 true 时会把除本接口外的所有 API 拦成 428——
 * 没有这一页，新账号登进来会寸步难行。
 */
export function ChangePassword({ user, onDone }: { user: SessionUser; onDone: (u: SessionUser) => void }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (newPassword !== confirm) {
      setErr('两次输入的新密码不一致。');
      return;
    }
    if (newPassword.length < 10) {
      setErr('新密码至少 10 位。');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const d = await api.post<{ user: SessionUser }>('/auth/change-password', { currentPassword, newPassword });
      onDone(d.user);
    } catch (error) {
      setErr(error instanceof Error ? error.message : '修改失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: C.bg,
        color: C.text,
        fontFamily: 'var(--font-body)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 380,
          border: `1px solid ${C.divider}`,
          borderRadius: 'var(--radius-lg)',
          background: C.surface,
          boxShadow: 'var(--shadow-md)',
          padding: 32,
        }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, letterSpacing: '.02em' }}>设置新密码</div>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: C.accent, marginTop: 4 }}>
          首次登录
        </div>
        <hr className="hr" />
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
          {user.name}，你当前使用的是管理员发放的一次性初始密码，请先设置自己的密码后再使用系统。
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>当前密码</label>
          <input
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="管理员发放的初始密码"
            autoFocus
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>新密码</label>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNext(e.target.value)}
            placeholder="至少 10 位"
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>确认新密码</label>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再输入一次"
          />
        </div>
        {err ? (
          <div
            style={{
              marginTop: 12,
              borderLeft: `2px solid ${C.accent}`,
              background: 'var(--color-accent-100)',
              padding: '9px 12px',
              fontSize: 12.5,
              color: 'var(--color-accent-900)',
            }}
          >
            {err}
          </div>
        ) : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? '提交中…' : '设置并进入系统'}
        </button>
        <button
          className="btn btn-ghost btn-block"
          type="button"
          disabled={busy}
          style={{ marginTop: 8, fontSize: 12.5 }}
          onClick={async () => {
            // 拿到初始密码的人不一定想现在改（比如登错了账号），必须能退出去
            try {
              await api.post('/auth/logout');
            } catch {
              // 会话已失效等同已退出
            }
            window.location.reload();
          }}
        >
          退出登录
        </button>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 14, ...tnum }}>
          改密后本账号在其它设备上的登录态会一并失效。
        </div>
      </form>
    </div>
  );
}
