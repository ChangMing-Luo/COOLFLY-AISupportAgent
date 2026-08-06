import { useEffect, useState } from 'react';
import { api, type BatchResultDto, type MetaImpactDto, type SessionUser, type TagDto } from '../api.js';
import { useApp, type ModalState } from '../shell.js';
import { C } from '../ui.js';

export function Modal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ name: string; email: string; role: string; department: string }>>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [tags, setTags] = useState<TagDto[]>([]);
  const [targetId, setTargetId] = useState('');
  const [impact, setImpact] = useState<MetaImpactDto | null>(null);

  useEffect(() => {
    if (state?.type === 'switch') {
      api
        .get<{ accounts: typeof accounts }>('/auth/accounts')
        .then((d) => {
          setAccounts(d.accounts);
          const other = d.accounts.find((a) => a.email !== app.user.email);
          setEmail(other?.email ?? '');
        })
        .catch(() => undefined);
    }
    if (state?.type === 'unpublishMeta') {
      setImpact(null);
      api
        .get<MetaImpactDto>(`/meta/${state.kind}/${state.id}/impact`)
        .then(setImpact)
        .catch(() => undefined);
    }
    if (state?.type === 'mergeTag') {
      api
        .get<{ tags: TagDto[] }>('/meta/tags')
        .then((d) => {
          const list = d.tags.filter((t) => t.id !== state.id);
          setTags(list);
          setTargetId(list[0]?.id ?? '');
        })
        .catch(() => undefined);
    }
  }, [state, app.user.email]);

  if (!state) return null;

  let title = '';
  let body = '';
  let warn = '';
  let confirmLabel = '确认';
  let onConfirm: () => Promise<void> | void = onClose;

  if (state.type === 'rollback') {
    title = `回滚至 ${state.version}`;
    body = `将发起把 ${state.code} 的线上内容回滚至 ${state.version} 的版本（历史采纳率 ${state.adopt}%）。回滚需经过审核工作流，审核通过后才生效并重新同步 Zendesk。`;
    warn = '提交后该知识状态变为「待审核」，在审核中心通过后回滚才会写入 Zendesk。';
    confirmLabel = '提交回滚审核';
    onConfirm = async () => {
      await api.post(`/entries/${state.code}/rollback`, { version: state.version });
      app.refreshShell();
      app.toast('回滚已提交审核', `${state.code} 回滚至 ${state.version} 已进入待审队列，审核通过后才生效。`, {
        label: '前往审核中心',
        route: 'review.queue',
      });
      onClose();
    };
  } else if (state.type === 'offline') {
    title = '下线知识';
    body = `下线后 ${state.code} 将从 Zendesk 撤回，不再参与召回。版本历史、双语内容与反馈记录完整保留，可随时恢复。`;
    warn = '近 7 日该知识仍被召回，下线可能导致相关提问无召回。';
    confirmLabel = '确认下线';
    onConfirm = async () => {
      await api.post(`/entries/${state.code}/offline`);
      app.refreshShell();
      app.toast('已下线', `${state.code} 已从 Zendesk 撤回。`, { label: '查看已下线', route: 'kb.offline' });
      onClose();
    };
  } else if (state.type === 'switch') {
    title = '切换账号';
    body = '中台按账号授权，切换身份需要验证目标账号密码——免密切换等于越权。切换后当前会话立即失效。';
    confirmLabel = '验证并切换';
    onConfirm = async () => {
      setBusy(true);
      setErr('');
      try {
        const d = await api.post<{ user: SessionUser }>('/auth/switch', { email, password });
        app.toast(
          '已切换账号',
          `当前身份为 ${d.user.name}（${d.user.roleLabel}）${d.user.role === 'ops' ? '，系统管理模块将不可见' : '，可见全部模块'}。`,
        );
        onClose();
        window.location.reload();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '切换失败');
      } finally {
        setBusy(false);
      }
    };
  } else if (state.type === 'unpublishMeta') {
    const label = state.kind === 'categories' ? '分类' : '场景';
    title = `下架${label}「${state.name}」`;
    body = `下架需要二次确认：确认后会提交一条${label}下架的审核请求，通过后本地下架，并删除对应的 Zendesk 目录。`;
    warn = '删除 Zendesk 目录不可撤销，重新上架会在 Zendesk 侧新建一个目录（ID 与原来不同）。';
    confirmLabel = '确认下架';
    onConfirm = async () => {
      setBusy(true);
      try {
        const r = await api.post<{ review: { code: string; applied: boolean; message: string }; sync?: { ok: boolean; message: string } }>(
          `/meta/${state.kind}/${state.id}/toggle`,
        );
        app.refreshShell();
        app.toast(
          r.review.applied ? `${label}已下架` : '下架已提交审核',
          r.sync ? `${r.review.message} ${r.sync.message}` : r.review.message,
          r.review.applied ? { label: '查看同步日志', route: 'publish.logs' } : { label: '前往审核中心', route: 'review.queue' },
        );
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '下架失败');
      } finally {
        setBusy(false);
      }
    };
  } else if (state.type === 'batchDelete') {
    title = `批量删除 ${state.codes.length} 条草稿`;
    body = `将删除：${state.codes.join('、')}。仅本人的草稿 / 已驳回 / 修复中条目可删，其余会被逐条拒绝并说明原因。`;
    warn = '删除后草稿内容与版本记录一并移除，不可恢复。';
    confirmLabel = '确认删除';
    onConfirm = async () => {
      setBusy(true);
      try {
        const r = await api.post<BatchResultDto>('/entries/batch/delete', { codes: state.codes });
        app.refreshShell();
        app.toast(
          '批量删除完成',
          `成功 ${r.ok.length} 条${r.failed.length ? `，失败 ${r.failed.length} 条：${r.failed.map((f) => `${f.code}（${f.reason}）`).join('；')}` : ''}。`,
        );
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '删除失败');
      } finally {
        setBusy(false);
      }
    };
  } else if (state.type === 'batchShelf') {
    const act = state.action === 'offline' ? '下架' : '恢复';
    title = `批量${act} ${state.codes.length} 条知识`;
    body =
      state.action === 'offline'
        ? `将逐条下架并在 Zendesk 归档（draft=true）：${state.codes.join('、')}。版本、双语与反馈完整保留。`
        : `将把 ${state.codes.join('、')} 恢复为草稿，需重新提交审核后才会再次发布。`;
    warn = state.action === 'offline' ? '下架后这些知识不再对客展示，也不参与召回。' : '';
    confirmLabel = `确认${act}`;
    onConfirm = async () => {
      setBusy(true);
      try {
        const r = await api.post<BatchResultDto>('/entries/batch/shelf', {
          codes: state.codes,
          action: state.action,
        });
        app.refreshShell();
        app.toast(
          `批量${act}完成`,
          `成功 ${r.ok.length} 条${r.failed.length ? `，失败 ${r.failed.length} 条：${r.failed.map((f) => `${f.code}（${f.reason}）`).join('；')}` : ''}。`,
        );
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : `${act}失败`);
      } finally {
        setBusy(false);
      }
    };
  } else if (state.type === 'mergeTag') {
    title = `合并标签「${state.name}」`;
    body = '合并后，源标签的全部引用会自动改写到目标标签，源标签下架并保留合并痕迹。';
    warn = '该操作会改写已有知识的标签引用，且不会自动还原。';
    confirmLabel = '确认合并';
    onConfirm = async () => {
      await api.post(`/meta/tags/${state.id}/merge`, { targetId });
      app.refreshShell();
      const target = tags.find((t) => t.id === targetId);
      app.toast('标签已合并', `「${state.name}」的引用已改写到「${target?.name ?? ''}」。`);
      onClose();
    };
  }

  return (
    <div className="dialog-backdrop" style={{ zIndex: 70 }}>
      <div className="dialog">
        <div className="dialog-title">{title}</div>
        <div className="dialog-body" style={{ textWrap: 'pretty' }}>
          {body}
        </div>

        {state.type === 'switch' ? (
          <>
            <div className="field">
              <label>目标账号</label>
              <select className="input" value={email} onChange={(e) => setEmail(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.email} value={a.email}>
                    {a.name} · {a.role === 'super' ? '超级管理员' : '知识运营'} · {a.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入目标账号密码"
              />
            </div>
            {err ? (
              <div
                style={{
                  borderLeft: `2px solid ${C.accent}`,
                  background: 'var(--color-accent-100)',
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: 'var(--color-accent-900)',
                }}
              >
                {err}
              </div>
            ) : null}
          </>
        ) : null}

        {state.type === 'unpublishMeta' ? (
          <div style={{ border: `1px solid ${C.divider}`, borderRadius: 'var(--radius-sm)', padding: '10px 13px' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: C.accent, marginBottom: 6 }}>
              下架后果
            </div>
            {impact ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.muted700, lineHeight: 1.9 }}>
                {impact.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 12.5, color: C.muted }}>正在核对影响面…</div>
            )}
          </div>
        ) : null}

        {err && state.type !== 'switch' ? (
          <div
            style={{
              borderLeft: `2px solid ${C.accent}`,
              background: 'var(--color-accent-100)',
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--color-accent-900)',
              textWrap: 'pretty',
            }}
          >
            {err}
          </div>
        ) : null}

        {state.type === 'mergeTag' ? (
          <div className="field">
            <label>目标标签</label>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.refCount} 次引用）
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {warn ? (
          <div
            style={{
              borderLeft: `2px solid ${C.accent}`,
              background: 'var(--color-accent-100)',
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'var(--color-accent-900)',
            }}
          >
            {warn}
          </div>
        ) : null}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
