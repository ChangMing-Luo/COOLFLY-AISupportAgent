import { useState } from 'react';
import { api, type SessionUser } from '../api.js';
import { C, tnum } from '../ui.js';

/**
 * 登录页：原型没有这一页（直接进工作台），但删掉认证是安全回归，
 * 故按 Classical 设计系统补一页最小登录（SPEC-v4 §7）。
 */
export function Login({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const d = await api.post<{ user: SessionUser }>('/auth/login', { email, password });
      onLogin(d.user);
    } catch (error) {
      setErr(error instanceof Error ? error.message : '登录失败');
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
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, letterSpacing: '.02em' }}>COOLFLY</div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: C.accent,
            marginTop: 4,
          }}
        >
          知识运营中台
        </div>
        <hr className="hr" />
        <div className="field">
          <label>邮箱</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@coolfly.com"
            autoFocus
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>密码</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
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
          {busy ? '登录中…' : '登录'}
        </button>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 14, ...tnum }}>
          账号由超级管理员在「系统管理 · 用户与角色」创建。
        </div>
      </form>
    </div>
  );
}
