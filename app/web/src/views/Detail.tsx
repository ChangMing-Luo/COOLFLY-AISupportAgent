import { useEffect, useState } from 'react';
import { api, type EntryDetail } from '../api.js';
import { useApp } from '../shell.js';
import { C, Card, Crumb, KvRow, Tabs, tnum, twoCol } from '../ui.js';
import { fixFeedback, submitEntry, syncEntry } from './ListPage.js';

export function Detail() {
  const app = useApp();
  const code = app.sel;
  const [d, setD] = useState<EntryDetail | null>(null);
  const [tab, setTab] = useState('content');
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  useEffect(() => {
    setTab('content');
    setLang('zh');
  }, [code]);

  useEffect(() => {
    if (!code) return;
    api.get<EntryDetail>(`/entries/${code}`).then(setD).catch(() => undefined);
  }, [code, app.rev]);

  if (!d || !code) return null;
  const e = d.entry;

  const actions: Array<{ l: string; cls: string; on: () => void | Promise<void> }> = [];
  if (e.status === 'published') {
    actions.push({ l: '下线', cls: 'btn-secondary', on: () => app.openModal({ type: 'offline', code }) });
    actions.push({
      l: '创建修订',
      cls: 'btn-primary',
      on: async () => {
        const r = await api.post<{ entry: { code: string; version: string } }>(`/entries/${code}/revise`);
        app.refreshShell();
        app.toast('修订草稿已创建', `${code} ${r.entry.version}，线上仍为上一版本。`);
        app.go('author.editor', code);
      },
    });
  } else if (e.status === 'draft' || e.status === 'rejected' || e.status === 'fixing') {
    actions.push({ l: '编辑', cls: 'btn-secondary', on: () => app.go('author.editor', code) });
    actions.push({ l: '提交审核', cls: 'btn-primary', on: () => submitEntry(app, code) });
  } else if (e.status === 'pending') {
    actions.push({ l: '前往审核', cls: 'btn-primary', on: () => app.openDrawer({ kind: 'review', code }) });
  } else if (e.status === 'offline') {
    actions.push({
      l: '恢复为草稿',
      cls: 'btn-primary',
      on: async () => {
        await api.post(`/entries/${code}/restore`);
        app.refreshShell();
        app.toast('已恢复', `${code} 回到草稿状态，需重新审核。`, {
          label: '去编辑',
          route: 'author.editor',
          sel: code,
        });
      },
    });
  }

  const html = lang === 'en' ? d.bodyEn : d.bodyZh;
  const adoptCol = (a: number) => (a >= 60 ? 'var(--color-accent-700)' : a >= 40 ? C.accent : C.muted500);

  return (
    <>
      <Crumb onBack={() => app.go('kb.list')} label={`知识库 / ${e.categoryZh || '未分类'} / ${e.sceneZh || '未设置'}`} />
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginTop: 10 }}
      >
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span className={`tag ${e.statusTagClass}`}>{e.statusLabel}</span>
            <span style={{ fontSize: 12, color: C.muted, ...tnum }}>
              {e.code} · 当前 {e.version} · 负责人 {e.ownerName}
            </span>
            <span className="tag tag-outline">中 / EN 双语</span>
          </div>
          <h2 style={{ margin: '10px 0 2px', fontWeight: 400 }}>{e.titleZh}</h2>
          <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{e.titleEn || '（英文标题未生成）'}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>状态：{e.statusReadable}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          {actions.map((a) => (
            <button key={a.l} className={`btn ${a.cls}`} onClick={() => void a.on()}>
              {a.l}
            </button>
          ))}
        </div>
      </div>
      <hr className="hr" />

      <div style={twoCol}>
        <div>
          <Tabs
            active={tab}
            onPick={setTab}
            items={[
              { key: 'content', label: '内容' },
              { key: 'versions', label: `版本与质量 · ${d.versions.length}` },
              { key: 'sync', label: 'Zendesk 同步' },
              { key: 'feedback', label: `反馈 · ${d.feedbacks.length}` },
            ]}
          />

          {tab === 'content' ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['zh', 'en'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setLang(k)}
                    className={`tag ${lang === k ? 'tag-accent' : 'tag-outline'}`}
                    style={{ cursor: 'pointer', fontFamily: 'var(--font-body)', border: `1px solid ${C.divider}` }}
                  >
                    {k === 'zh' ? '中文' : 'English'}
                  </button>
                ))}
              </div>
              <div className="rt-body" style={{ fontSize: 14.5, lineHeight: 1.9, maxWidth: '70ch', padding: 0 }}>
                {html ? (
                  // 正文由本台编辑器产出（TipTap 白名单节点），渲染富文本以保留标题/列表/图片/表格
                  <div className="tiptap" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p style={{ color: C.muted }}>
                    {lang === 'en' ? '英文版本尚未生成，请在编辑器中执行翻译。' : '正文为空，请在编辑器中补全。'}
                  </p>
                )}
              </div>
            </>
          ) : null}

          {tab === 'versions' ? (
            <>
              {d.advice.warn ? (
                <div
                  style={{
                    border: '1px solid var(--color-accent-600)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    marginBottom: 18,
                    background: 'var(--color-accent-100)',
                  }}
                >
                  <div
                    style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--color-accent-800)' }}
                  >
                    质量告警 · 建议回滚
                  </div>
                  <p
                    style={{
                      margin: '6px 0 10px',
                      fontSize: 12.5,
                      color: 'var(--color-accent-900)',
                      textWrap: 'pretty',
                    }}
                  >
                    {d.advice.text}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      app.openModal({
                        type: 'rollback',
                        code,
                        version: d.advice.target,
                        adopt: d.versions.find((v) => v.version === d.advice.target)?.adopt ?? 0,
                      })
                    }
                  >
                    回滚至 {d.advice.target}
                  </button>
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <h4 style={{ margin: 0 }}>版本与质量</h4>
                <span style={{ fontSize: 11.5, color: C.muted }}>
                  采纳率 / 采纳数 = 该版本回答被采纳的比例与次数 · 命中数 = 被召回次数
                </span>
              </div>
              <div style={{ borderTop: `1px solid ${C.divider}` }}>
                {d.versions.map((v, i) => (
                  <div
                    key={`${v.version}-${i}`}
                    style={{
                      display: 'flex',
                      gap: 16,
                      padding: '14px 2px',
                      borderBottom: `1px solid ${C.divider}`,
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        flex: 'none',
                        fontFamily: 'var(--font-heading)',
                        fontSize: 17,
                        ...tnum,
                        color: v.isCurrent ? C.accent : C.muted,
                      }}
                    >
                      {v.version}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5 }}>{v.note}</div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, ...tnum }}>
                        {v.by} · {v.at} · {v.act}
                      </div>
                    </div>
                    <div style={{ width: 172, flex: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, ...tnum }}>
                        <span style={{ color: C.muted }}>采纳率</span>
                        <span style={{ color: adoptCol(v.adopt) }}>{v.adopt}%</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--color-neutral-200)', margin: '4px 0 6px' }}>
                        <div style={{ height: 3, background: adoptCol(v.adopt), width: `${v.adopt}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, ...tnum }}>
                        <span style={{ color: C.muted }}>采纳数</span>
                        <span>{v.adoptN}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11.5,
                          ...tnum,
                          marginTop: 2,
                        }}
                      >
                        <span style={{ color: C.muted }}>命中数</span>
                        <span>{v.hits.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ width: 96, flex: 'none', textAlign: 'right' }}>
                      {v.isCurrent ? <span className="tag tag-accent">当前</span> : null}
                      {!v.isCurrent && e.status === 'published' ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() =>
                            app.openModal({ type: 'rollback', code, version: v.version, adopt: v.adopt })
                          }
                        >
                          回滚
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {tab === 'sync' ? (
            <>
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-kicker">Zendesk 同步</div>
                    <div style={{ fontSize: 13, color: C.muted700 }}>
                      写入语言：English · 同步版本 {e.version}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`tag ${e.syncTagClass}`}>{e.syncLabel}</span>
                    <div style={{ marginTop: 8 }}>
                      <button
                        className={`btn ${e.syncStatus === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          if (e.syncStatus === 'none' && e.status !== 'published') {
                            app.toast('尚未发布', '该知识未进入发布状态，无法同步 Zendesk。');
                            return;
                          }
                          void syncEntry(app, code);
                        }}
                      >
                        {e.syncStatus === 'failed' ? '重试同步' : e.syncStatus === 'none' ? '不可用' : '重新下发'}
                      </button>
                    </div>
                  </div>
                </div>
                {e.syncStatus === 'failed' ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderLeft: `2px solid ${C.accent}`,
                      background: 'var(--color-accent-100)',
                      padding: '10px 14px',
                      fontSize: 12.5,
                      color: 'var(--color-accent-900)',
                    }}
                  >
                    失败原因：{e.syncFailReason ?? 'Zendesk 写入未成功。'}
                  </div>
                ) : null}
              </Card>
              <h4 style={{ margin: '0 0 8px' }}>Zendesk 采集 / 同步消息记录</h4>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px' }}>
                该知识的用户反馈由下方 Zendesk 会话记录级联而来，点击可展开原始客诉。
              </p>
              <div style={{ borderTop: `1px solid ${C.divider}` }}>
                {d.syncLogs.map((m, i) => (
                  <MsgRow
                    key={`s${i}`}
                    id={m.payloadNo}
                    type="同步"
                    tagCls={m.result === '失败' ? 'tag-neutral' : 'tag-accent'}
                    text={m.label}
                    at={m.at}
                    onClick={() => app.go('publish.logs')}
                  />
                ))}
                {d.feedbacks.map((f) => (
                  <MsgRow
                    key={f.code}
                    id={f.conversation}
                    type={f.type}
                    tagCls={f.type === '差评' ? 'tag-neutral' : 'tag-accent-2'}
                    text={f.text}
                    at={f.at}
                    onClick={() =>
                      app.openDrawer({
                        kind: 'info',
                        title: '原始客诉',
                        meta: f.conversation,
                        rows: [
                          { k: '反馈标识', v: f.code },
                          { k: 'Zendesk 会话', v: f.conversation },
                          { k: '类型', v: f.type },
                          { k: '状态', v: f.stateLabel },
                          { k: '时间', v: f.at },
                        ],
                        body: f.text,
                      })
                    }
                  />
                ))}
                {d.syncLogs.length + d.feedbacks.length === 0 ? (
                  <div style={{ padding: '30px 0', fontSize: 13, color: C.muted }}>暂无同步与会话记录。</div>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === 'feedback' ? (
            <>
              {d.feedbacks.map((f) => (
                <div
                  key={f.code}
                  style={{
                    borderBottom: `1px solid ${C.divider}`,
                    padding: '14px 2px',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    className={`tag ${f.type === '差评' ? 'tag-neutral' : 'tag-accent-2'}`}
                    style={{ flex: 'none' }}
                  >
                    {f.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}>{f.text}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, ...tnum }}>
                      {f.code} · Zendesk {f.conversation} · {f.at} · {f.stateLabel}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => (f.state === 'open' ? void fixFeedback(app, f.code) : app.go('feedback.list'))}
                  >
                    {f.state === 'open' ? '去修复' : '查看'}
                  </button>
                </div>
              ))}
              {d.feedbacks.length === 0 ? (
                <div style={{ padding: '56px 0', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 21, color: C.muted }}>暂无反馈</div>
                  <p style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                    该知识发布后尚未从 Zendesk 回流反馈。
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div>
          <Card kicker="元数据">
            {d.meta.map((m, i) => (
              <KvRow key={m.k} k={m.k} v={m.v} last={i === d.meta.length - 1} />
            ))}
          </Card>
          <Card kicker="知识健康度" style={{ marginTop: 14, background: C.surface }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 400, ...tnum }}>
                {e.quality}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                {e.quality >= 85 ? '健康' : e.quality >= 60 ? '需关注' : '建议修复'}
              </span>
            </div>
            {d.healthBars.map((b) => (
              <div key={b.label} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.muted700 }}>
                  <span>{b.label}</span>
                  <span style={tnum}>{b.value}</span>
                </div>
                <div style={{ height: 2, background: 'var(--color-neutral-300)', marginTop: 3 }}>
                  <div style={{ height: 2, background: C.accent, width: b.pct }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

function MsgRow({
  id,
  type,
  tagCls,
  text,
  at,
  onClick,
}: {
  id: string;
  type: string;
  tagCls: string;
  text: string;
  at: string;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '11px 2px',
        borderBottom: `1px solid ${C.divider}`,
        alignItems: 'center',
      }}
    >
      <span style={{ width: 92, flex: 'none', fontSize: 11, ...tnum, color: C.muted }}>{id}</span>
      <span className={`tag ${tagCls}`} style={{ flex: 'none' }}>
        {type}
      </span>
      <button
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'inherit',
        }}
      >
        {text}
      </button>
      <span style={{ fontSize: 11.5, color: C.muted, ...tnum, flex: 'none' }}>{at}</span>
    </div>
  );
}
