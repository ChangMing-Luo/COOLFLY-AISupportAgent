import { useState } from 'react';
import type { SessionUser } from '@kb/contracts';
import { api } from '../api';

export function LoginView({ onLoggedIn }: { onLoggedIn: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState<SessionUser | null>(null);
  const [newPwd, setNewPwd] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.login(email, password);
      if (r.user.mustChangePassword) setChanging(r.user);
      else onLoggedIn(r.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ ok: boolean; message?: string }>('/api/auth/change-password', {
        currentPassword: password,
        newPassword: newPwd,
      });
      if (!r.ok) {
        setError(r.message ?? '改密失败');
        return;
      }
      const me = await api.me();
      onLoggedIn(me.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (changing) {
    return (
      <div className="login">
        <form className="login__card" onSubmit={changePassword}>
          <h1 style={{ fontSize: 18, margin: '0 0 6px' }}>首次登录请修改密码</h1>
          <p className="meta" style={{ marginTop: 0 }}>
            账号：{changing.email} · 首次登录强制改密（账号安全前置）
          </p>
          <div className="field">
            <label className="field__label" htmlFor="np">新密码（至少 8 位）</label>
            <input id="np" className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8} />
          </div>
          {error && <div className="note note--bad">{error}</div>}
          <button className="btn btn--primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
            设置新密码并进入
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="brand__name">COOLFLY</div>
        <h1 style={{ fontSize: 20, margin: '4px 0 2px' }}>知识运营中台</h1>
        <p className="meta" style={{ marginTop: 0 }}>运行时 = Zendesk · 本台 = 唯一权威源</p>
        <div className="field" style={{ marginTop: 18 }}>
          <label className="field__label" htmlFor="em">邮箱</label>
          <input id="em" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pw">密码</label>
          <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <div className="note note--bad">{error}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
