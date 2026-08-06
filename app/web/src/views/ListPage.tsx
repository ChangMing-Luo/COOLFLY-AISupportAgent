import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type AdminUserDto,
  type AuditRowDto,
  type CategoryDto,
  type EntryDto,
  type FeedbackDto,
  type MissDto,
  type PermissionRowDto,
  type ReviewRequestDto,
  type CandidateDto,
  type SceneMetaDto,
  type SyncLogDto,
  type TagDto,
} from '../api.js';
import { useApp, type Ctx } from '../shell.js';
import { C, Empty, LoadFailed, kickerStyle, tnum } from '../ui.js';

export interface Row {
  id: string;
  c1: string;
  sub: string;
  c2: string;
  c3: string;
  tagCls: string;
  c4: string;
  c5: string | number;
  acts: Array<{ l: string; on: () => void | Promise<void> }>;
  open?: () => void;
  /** 未命中页的「待处理」是可点 tag */
  c3click?: () => void;
}

interface Cfg {
  kicker: string;
  title: string;
  desc: string;
  headers: [string, string, string, string, string];
  rows: Row[];
  filters: Array<{ l: string; test?: (r: Row) => boolean }>;
  actions: Array<{ l: string; cls: string; on: () => void | Promise<void> }>;
  /** 勾选后出现的批量动作；有值即渲染勾选列 */
  bulk?: Array<{ l: string; cls: string; on: (codes: string[]) => void }>;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyCta?: string;
  emptyOn?: () => void;
}

/** 每个列表路由的数据源 */
const SOURCE: Record<string, string> = {
  'collect.trash': '/collect/trash',
  'author.drafts': '/entries?view=drafts',
  'author.mine': '/entries?view=mine',
  'review.queue': '/reviews/pending',
  'review.log': '/reviews/records',
  'kb.list': '/entries?view=all',
  'kb.offline': '/entries?view=offline',
  'publish.channels': '/entries?view=sync',
  'publish.logs': '/sync/logs',
  'feedback.list': '/feedback',
  'feedback.miss': '/misses',
  'meta.tree': '/meta/categories',
  'meta.scenes': '/meta/scenes',
  'meta.tags': '/meta/tags',
  'admin.users': '/admin/users',
  'admin.perms': '/admin/permissions',
  'admin.audit': '/admin/audit',
};

export function ListPage() {
  const app = useApp();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  /** 正在执行的动作 key，非空时所有动作按钮禁用（防双击重复发请求） */
  const [acting, setActing] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setFilterIdx(0);
    setPicked([]);
  }, [app.route]);

  useEffect(() => {
    setPicked([]);
  }, [app.rev]);

  useEffect(() => {
    const src = SOURCE[app.route];
    if (!src) return;
    let alive = true;
    setLoadError('');
    api
      .get<Record<string, unknown>>(src)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        // 原来失败静默、组件 return null，整个主区一片空白，
        // 用户分不清是「还在加载」还是「坏了」
        if (alive) setLoadError(e instanceof Error ? e.message : '加载失败');
      });
    return () => {
      alive = false;
    };
  }, [app.route, app.rev]);

  const cfg = useMemo(() => (data ? buildCfg(app, data) : null), [app, data]);
  if (loadError) return <LoadFailed message={loadError} onRetry={app.refreshShell} />;
  if (!cfg) return null;

  /**
   * 行内与页头动作的统一出口：接住失败并上 busy 闸。
   * 这些动作原来是 `void a.on()` 直接调用——请求失败（网络、权限、409 状态冲突）
   * 界面毫无反应，用户以为没点上就反复点，而每次点击都真的发了一次请求。
   */
  const runAction = async (key: string, fn: () => void | Promise<void>): Promise<void> => {
    if (acting) return;
    setActing(key);
    try {
      await fn();
    } catch (e) {
      app.toast('操作未完成', e instanceof Error ? e.message : '未知错误');
    } finally {
      setActing('');
    }
  };

  const filters = cfg.filters.length ? cfg.filters : [{ l: '全部' }];
  const idx = Math.min(filterIdx, filters.length - 1);
  const active = filters[idx];
  const rows = active.test ? cfg.rows.filter(active.test) : cfg.rows;
  const empty = rows.length === 0;
  const bulk = cfg.bulk ?? [];
  const chosen = picked.filter((id) => rows.some((r) => r.id === id));
  const allPicked = rows.length > 0 && chosen.length === rows.length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={kickerStyle}>{cfg.kicker}</div>
          <h2 style={{ margin: '8px 0 6px', fontWeight: 400 }}>{cfg.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.muted700, maxWidth: 640, textWrap: 'pretty' }}>{cfg.desc}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          {cfg.actions.map((a) => (
            <button
              key={a.l}
              className={`btn ${a.cls}`}
              disabled={Boolean(acting)}
              onClick={() => void runAction(`head:${a.l}`, a.on)}
            >
              {acting === `head:${a.l}` ? '处理中…' : a.l}
            </button>
          ))}
        </div>
      </div>
      <hr className="hr" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div className="seg">
          {filters.map((f, i) => (
            <label className="seg-opt" key={f.l}>
              <input type="radio" name="listfilter" checked={i === idx} onChange={() => setFilterIdx(i)} />
              <span>{f.l}</span>
            </label>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {bulk.length && chosen.length ? (
          <>
            <span style={{ fontSize: 12, color: C.muted, ...tnum }}>已选 {chosen.length} 条</span>
            {bulk.map((b) => (
              <button key={b.l} className={`btn ${b.cls}`} style={{ fontSize: 12 }} onClick={() => b.on(chosen)}>
                {b.l}
              </button>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setPicked([])}>
              取消选择
            </button>
          </>
        ) : null}
        <span style={{ fontSize: 12, color: C.muted, ...tnum }}>{rows.length} 条记录</span>
      </div>

      <table className="table">
        <thead>
          <tr>
            {bulk.length ? (
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? [] : rows.map((r) => r.id))}
                />
              </th>
            ) : null}
            <th style={{ width: '34%' }}>{cfg.headers[0]}</th>
            <th style={{ width: '13%' }}>{cfg.headers[1]}</th>
            <th style={{ width: '11%' }}>{cfg.headers[2]}</th>
            <th style={{ width: '15%' }}>{cfg.headers[3]}</th>
            <th style={{ width: '11%', textAlign: 'right' }}>{cfg.headers[4]}</th>
            <th style={{ width: '16%', textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {bulk.length ? (
                <td style={{ padding: 'var(--rp,11px) var(--space-2)' }}>
                  <input
                    type="checkbox"
                    checked={picked.includes(r.id)}
                    onChange={() =>
                      setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])
                    }
                  />
                </td>
              ) : null}
              <td style={{ padding: 'var(--rp,11px) var(--space-2)' }}>
                <button
                  onClick={() => r.open?.()}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: r.open ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs,14px)',
                    color: 'inherit',
                  }}
                >
                  {r.c1}
                </button>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, ...tnum }}>{r.sub}</div>
              </td>
              <td style={{ padding: 'var(--rp,11px) var(--space-2)', fontSize: 13 }}>{r.c2}</td>
              <td style={{ padding: 'var(--rp,11px) var(--space-2)' }}>
                {r.c3click ? (
                  <button
                    onClick={r.c3click}
                    className={`tag ${r.tagCls}`}
                    style={{ border: 0, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >
                    {r.c3}
                  </button>
                ) : (
                  <span className={`tag ${r.tagCls}`}>{r.c3}</span>
                )}
              </td>
              <td
                style={{
                  padding: 'var(--rp,11px) var(--space-2)',
                  fontSize: 12.5,
                  color: C.muted700,
                  ...tnum,
                }}
              >
                {r.c4}
              </td>
              <td style={{ padding: 'var(--rp,11px) var(--space-2)', textAlign: 'right', fontSize: 13, ...tnum }}>
                {r.c5}
              </td>
              <td style={{ padding: 'var(--rp,11px) var(--space-2)' }}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {r.acts.map((a) => (
                    <button
                      key={a.l}
                      className="btn btn-ghost"
                      disabled={Boolean(acting)}
                      onClick={() => void runAction(`${r.id}:${a.l}`, a.on)}
                      style={{ fontSize: 12 }}
                    >
                      {acting === `${r.id}:${a.l}` ? '…' : a.l}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {empty ? (
        <Empty
          title={cfg.emptyTitle ?? (idx > 0 ? '该筛选下暂无记录' : '暂无数据')}
          desc={idx > 0 ? '切换筛选或清除条件可查看更多记录。' : (cfg.emptyDesc ?? '当前筛选条件下没有记录。')}
          cta={idx > 0 ? '查看全部' : (cfg.emptyCta ?? '返回工作台')}
          onCta={idx > 0 ? () => setFilterIdx(0) : (cfg.emptyOn ?? (() => app.go('dash')))}
        />
      ) : null}
    </>
  );
}

/** 审核列表表头：待审看提交人，记录看结论；两者都带分类 / 场景 / 正文三维 */
function queh(queue: boolean): [string, string, string, string, string] {
  return queue
    ? ['审核对象', '分类 / 场景', '维度', '提交人 / 时间', '知识正文']
    : ['审核对象', '分类 / 场景', '结论', '审核人 / 时间', '知识正文'];
}

/* ══════════ 每个路由的列表配置（对应原型 listCfg） ══════════ */

function buildCfg(app: Ctx, data: Record<string, unknown>): Cfg | null {
  const r = app.route;
  const entryRow = (d: EntryDto): Row => ({
    id: d.code,
    c1: d.titleZh,
    sub: `${d.code} · ${d.categoryZh || '未分类'}`,
    c2: d.sceneZh || '未设置',
    c3: d.statusLabel,
    tagCls: d.statusTagClass,
    c4: d.updatedAt,
    c5: d.quality,
    acts: [],
    open: () => app.go('kb.detail', d.code),
  });

  if (r === 'collect.trash') {
    const list = (data.candidates as CandidateDto[]) ?? [];
    return {
      kicker: '知识采集',
      title: '垃圾箱',
      desc: '人工丢弃与自动丢弃的抽取候选都收在这里。它们的 AI 摘要会成为「自动丢弃」的匹配指纹——下次抽到同一个问题会直接进垃圾箱，不再反复冒出来。恢复后该指纹立即失效。',
      headers: ['问题', 'AI 摘要', '丢弃方式', '丢弃时间', '关联会话'],
      rows: list.map((c) => ({
        id: c.code,
        c1: c.title,
        sub: `${c.code} · ${c.sceneZh || c.sceneHint || '未匹配场景'}`,
        c2: c.summary || '—',
        c3: c.autoDropped ? '自动丢弃' : '人工丢弃',
        tagCls: c.autoDropped ? 'tag-outline' : 'tag-neutral',
        c4: c.disposedAt ?? '—',
        c5: c.mentionCount,
        open: () => app.openDrawer({ kind: 'sources', code: c.code }),
        acts: [
          { l: '查看会话', on: () => app.openDrawer({ kind: 'sources', code: c.code }) },
          {
            l: '恢复',
            on: async () => {
              await api.post(`/collect/candidates/${c.code}/restore`);
              app.refreshShell();
              app.toast('已恢复到待确认', `${c.code} 回到抽取工作台，其摘要不再用于自动丢弃。`, {
                label: '前往抽取工作台',
                route: 'collect.extract',
              });
            },
          },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '人工丢弃', test: (x) => x.c3 === '人工丢弃' },
        { l: '自动丢弃', test: (x) => x.c3 === '自动丢弃' },
      ],
      actions: [],
      emptyTitle: '垃圾箱是空的',
      emptyDesc: '在抽取工作台点「丢弃」的候选会收到这里，并作为后续自动丢弃的依据。',
      emptyCta: '前往抽取工作台',
      emptyOn: () => app.go('collect.extract'),
    };
  }

  if (r === 'author.drafts' || r === 'author.mine') {
    const list = (data.entries as EntryDto[]) ?? [];
    return {
      kicker: '知识编辑',
      title: r === 'author.drafts' ? '我的草稿' : '我提交的',
      desc:
        r === 'author.drafts'
          ? '草稿需补全问题场景、翻译英文后才能提交审核。被驳回的知识会带着审核意见回到这里。'
          : '已提交的知识按审核进度排列，可查看审核意见与发布结果。',
      headers: ['标题', '场景', '状态', '更新时间', '完整度'],
      rows: list.map((d) => ({
        ...entryRow(d),
        acts:
          r === 'author.drafts'
            ? [
                { l: '编辑', on: () => app.go('author.editor', d.code) },
                { l: '提交审核', on: () => submitEntry(app, d.code) },
              ]
            : [{ l: '查看', on: () => app.go('kb.detail', d.code) }],
      })),
      filters:
        r === 'author.drafts'
          ? [
              { l: '全部' },
              { l: '草稿', test: (x) => x.c3 === '草稿' },
              { l: '已驳回', test: (x) => x.c3 === '已驳回' },
            ]
          : [
              { l: '全部' },
              { l: '待审核', test: (x) => x.c3 === '待审核' },
              { l: '已发布', test: (x) => x.c3 === '已发布' },
            ],
      bulk:
        r === 'author.drafts'
          ? [{ l: '批量删除', cls: 'btn-secondary', on: (codes) => app.openModal({ type: 'batchDelete', codes }) }]
          : undefined,
      actions: [
        { l: '一键导入', cls: 'btn-secondary', on: () => app.go('author.import') },
        // 直接进手动录入页；不再跳去 AI 抽取页（那是定时任务产出的候选池）
        { l: '撰写新知识', cls: 'btn-primary', on: () => app.go('author.editor', null) },
      ],
      emptyTitle: r === 'author.drafts' ? '草稿箱是空的' : '暂无提交记录',
      emptyDesc:
        r === 'author.drafts'
          ? '所有草稿都已提交审核。可以从 AI 抽取工作台继续认领候选。'
          : '提交审核后，知识会出现在这里。',
      emptyCta: '撰写新知识',
      emptyOn: () => app.go('author.editor', null),
    };
  }

  if (r === 'review.queue' || r === 'review.log') {
    const list = (data.requests as ReviewRequestDto[]) ?? [];
    const queue = r === 'review.queue';
    const openReq = (q: ReviewRequestDto): void => {
      if (q.objectType === 'entry' && q.status === 'pending' && q.action !== 'rollback') {
        app.openDrawer({ kind: 'review', code: q.objectCode });
        return;
      }
      app.openDrawer({ kind: 'reviewRequest', code: q.code });
    };
    return {
      kicker: '审核中心',
      title: queue ? '待我审核' : '审核记录',
      desc: queue
        ? '分类、场景与知识正文共用一条审核流水线。通过后分类 / 场景写入 Zendesk 目录，知识正文发布并同步英文版本；驳回需填意见。'
        : '所有审核结论留痕，含分类、场景、知识正文三个维度，可回溯到具体对象与意见。自动过审的记录同样在列。',
      headers: queh(queue),
      rows: list.map((q) => ({
        id: q.code,
        c1: q.objectLabel,
        sub: `${q.code} · ${q.objectTypeLabel}${q.actionLabel} · ${q.objectCode}`,
        c2: `${q.dimCategory} / ${q.dimScene}`,
        c3: queue ? q.objectTypeLabel : q.statusLabel,
        tagCls: queue
          ? q.objectType === 'entry'
            ? 'tag-accent'
            : 'tag-outline'
          : q.status === 'rejected'
            ? 'tag-neutral'
            : 'tag-accent',
        c4: queue ? `${q.submitter} · ${q.submittedAt}` : `${q.reviewer || q.submitter} · ${q.reviewedAt}`,
        c5: q.dimBody,
        open: () => openReq(q),
        acts: [{ l: queue ? '审核' : '查看', on: () => openReq(q) }],
      })),
      filters: queue
        ? [
            { l: '全部' },
            { l: '知识正文', test: (x) => x.c3 === '知识正文' },
            { l: '知识分类', test: (x) => x.c3 === '知识分类' },
            { l: '问题场景', test: (x) => x.c3 === '问题场景' },
          ]
        : [
            { l: '全部' },
            { l: '通过', test: (x) => x.c3 === '通过' },
            { l: '驳回', test: (x) => x.c3 === '驳回' },
          ],
      actions: [],
      emptyTitle: queue ? '待审队列已清空' : '暂无审核记录',
      emptyDesc: queue
        ? '没有等待审核的分类、场景或知识。新提交会实时出现在这里，并在工作台待办中提醒。'
        : '完成第一次审核后，结论会记录在这里。',
      emptyCta: queue ? '返回工作台' : '前往待审队列',
      emptyOn: () => app.go(queue ? 'dash' : 'review.queue'),
    };
  }

  if (r === 'kb.list' || r === 'kb.offline') {
    const list = (data.entries as EntryDto[]) ?? [];
    return {
      kicker: '知识库',
      title: r === 'kb.offline' ? '已下线知识' : '全部知识',
      desc:
        r === 'kb.offline'
          ? '下线知识不参与召回与同步，但版本、双语内容与反馈完整保留，可随时恢复。'
          : '知识库是中台的唯一事实来源。每条知识都带一级分类、二级场景、双语内容、版本质量与 Zendesk 同步状态。',
      headers: ['标题', '场景', '状态', '更新时间', '健康度'],
      rows: list.map((d) => ({
        ...entryRow(d),
        acts:
          r === 'kb.offline'
            ? [
                {
                  l: '恢复',
                  on: async () => {
                    await api.post(`/entries/${d.code}/restore`);
                    app.refreshShell();
                    app.toast('已恢复为草稿', `${d.code} 需重新提交审核后才能发布。`, {
                      label: '去编辑',
                      route: 'author.editor',
                      sel: d.code,
                    });
                  },
                },
              ]
            : [
                { l: '详情', on: () => app.go('kb.detail', d.code) },
                { l: '版本', on: () => app.go('kb.detail', d.code) },
              ],
      })),
      filters:
        r === 'kb.offline'
          ? [{ l: '全部' }]
          : [
              { l: '全部' },
              { l: '已发布', test: (x) => x.c3 === '已发布' },
              { l: '待审核', test: (x) => x.c3 === '待审核' },
              { l: '修复中', test: (x) => x.c3 === '修复中' },
            ],
      bulk:
        r === 'kb.offline'
          ? [
              {
                l: '批量恢复',
                cls: 'btn-secondary',
                on: (codes) => app.openModal({ type: 'batchShelf', codes, action: 'restore' }),
              },
            ]
          : [
              {
                l: '批量下架',
                cls: 'btn-secondary',
                on: (codes) => app.openModal({ type: 'batchShelf', codes, action: 'offline' }),
              },
            ],
      actions:
        r === 'kb.offline'
          ? []
          : [
              {
                l: '导出',
                cls: 'btn-secondary',
                on: () => {
                  const csv = [
                    ['知识 ID', '中文标题', 'English Title', '一级分类', '二级场景', '状态', '版本', '同步'].join(','),
                    ...list.map((d) =>
                      [
                        d.code,
                        `"${d.titleZh}"`,
                        `"${d.titleEn}"`,
                        d.categoryZh,
                        d.sceneZh,
                        d.statusLabel,
                        d.version,
                        d.syncLabel,
                      ].join(','),
                    ),
                  ].join('\n');
                  downloadCsv(csv, 'coolfly-knowledge.csv');
                  app.toast('导出完成', `共 ${list.length} 条（含中英双语），文件已开始下载。`);
                },
              },
            ],
    };
  }

  if (r === 'publish.channels') {
    const list = (data.entries as EntryDto[]) ?? [];
    return {
      kicker: '发布与同步',
      title: 'Zendesk 同步',
      desc: '对 Zendesk 的写入是同步进行的，无需发布队列。写入语言为英文；同步失败可单独重试。',
      headers: ['知识', '同步版本', '状态', '最近同步', '健康度'],
      rows: list.map((d) => ({
        id: d.code,
        c1: d.titleZh,
        sub: `${d.code} · EN`,
        c2: d.version,
        c3: d.syncLabel,
        tagCls: d.syncTagClass,
        c4: d.syncStatus === 'none' ? '—' : d.updatedAt,
        c5: d.quality,
        open: () => app.go('kb.detail', d.code),
        acts:
          d.syncStatus === 'failed'
            ? [
                { l: '重试', on: () => syncEntry(app, d.code) },
                { l: '日志', on: () => app.go('publish.logs') },
              ]
            : [{ l: '重新下发', on: () => syncEntry(app, d.code) }],
      })),
      filters: [
        { l: '全部' },
        { l: '已同步', test: (x) => x.c3 === '已同步' },
        { l: '同步失败', test: (x) => x.c3 === '同步失败' },
      ],
      actions: [],
      emptyTitle: '暂无同步记录',
      emptyDesc: '知识发布后会自动写入 Zendesk，并在这里列出同步状态。',
      emptyCta: '返回工作台',
      emptyOn: () => app.go('dash'),
    };
  }

  if (r === 'publish.logs') {
    const logs = (data.logs as SyncLogDto[]) ?? [];
    return {
      kicker: '发布与同步',
      title: '同步日志',
      desc: '每一次对 Zendesk 的写入都有报文级留痕，失败可直接重试。',
      headers: ['知识 → Zendesk', '目录', '结果', '时间', '耗时'],
      rows: logs.map((l) => ({
        id: l.id,
        c1: l.objectLabel,
        sub: `报文 ${l.payloadNo}`,
        c2: l.target,
        c3: l.result,
        tagCls: l.result === '失败' ? 'tag-neutral' : 'tag-accent',
        c4: l.at,
        c5: `${l.durationMs}ms`,
        acts: [
          {
            l: '查看报文',
            on: () =>
              app.openDrawer({
                kind: 'info',
                title: '同步报文',
                meta: l.payloadNo,
                rows: [
                  { k: '记录标识', v: l.payloadNo },
                  { k: '发生时间', v: l.at },
                  { k: '知识', v: l.entryCode },
                  { k: '目标', v: l.target },
                  { k: '结果', v: l.result },
                  { k: '耗时', v: `${l.durationMs}ms` },
                  { k: '执行人', v: l.actorName },
                ],
                body: l.message || l.payload || '本次写入无附加报文信息。',
              }),
          },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '知识正文', test: (x) => x.c2 === 'Help Center' },
        { l: '分类 / 场景', test: (x) => x.c2 === 'Category' || x.c2 === 'Section' },
        { l: '失败', test: (x) => x.c3 === '失败' },
      ],
      actions: [],
      emptyTitle: '暂无同步日志',
      emptyDesc: '第一次发布后，写入报文会记录在这里。',
      emptyCta: '返回工作台',
      emptyOn: () => app.go('dash'),
    };
  }

  if (r === 'feedback.list') {
    const list = (data.feedbacks as FeedbackDto[]) ?? [];
    return {
      kicker: '反馈回流',
      title: '用户反馈',
      desc: '主动从 Zendesk 拉取用户客诉聊天记录，按关联知识归集。可直接在本列表内完成忽略或去修复，无需单独的修复任务。',
      headers: ['反馈内容', '关联知识', '类型', '来源 / 时间', '状态'],
      rows: list.map((f) => ({
        id: f.code,
        c1: f.text,
        sub: `${f.code} · Zendesk ${f.conversation}`,
        c2: f.entryCode,
        c3: f.type,
        tagCls: f.type === '差评' ? 'tag-neutral' : 'tag-accent-2',
        c4: `Zendesk · ${f.at}`,
        c5: f.stateLabel,
        open: () => app.go('kb.detail', f.entryCode),
        acts:
          f.state === 'open'
            ? [
                {
                  l: '忽略',
                  on: async () => {
                    await api.post(`/feedback/${f.code}/ignore`);
                    app.refreshShell();
                    app.toast('已忽略', `${f.code} 已关闭，不再出现在待办中。`);
                  },
                },
                { l: '去修复', on: () => fixFeedback(app, f.code) },
              ]
            : f.state === 'fixing'
              ? [{ l: '继续修复', on: () => app.go('author.editor', f.entryCode) }]
              : [{ l: '查看知识', on: () => app.go('kb.detail', f.entryCode) }],
      })),
      filters: [
        { l: '全部' },
        { l: '未处理', test: (x) => x.c5 === '未处理' },
        { l: '修复中', test: (x) => x.c5 === '修复中' },
        { l: '已关闭', test: (x) => x.c5 === '已关闭' },
      ],
      actions: [{ l: '从 Zendesk 拉取', cls: 'btn-primary', on: () => pullFeedback(app) }],
      emptyTitle: '暂无反馈',
      emptyDesc: '从 Zendesk 拉取后，客诉会汇总到这里。',
      emptyCta: '从 Zendesk 拉取',
      emptyOn: () => void pullFeedback(app),
    };
  }

  if (r === 'feedback.miss') {
    const list = (data.misses as MissDto[]) ?? [];
    return {
      kicker: '反馈回流',
      title: '未命中问题',
      desc: '召回为空或置信度过低的提问在此聚类，每条附 AI 摘要（问题类型与场景）。点击「待处理」查看处理流程，可一键「新建条目」撰写新知识覆盖该场景。',
      headers: ['问题', '疑似场景', '状态', '近 7 日次数', '命中率'],
      rows: list.map((m) => ({
        id: m.code,
        c1: m.question,
        sub: `${m.code} · AI 摘要：${m.aiSummary}`,
        c2: m.sceneZh,
        c3: m.stateLabel,
        tagCls: m.state === 'open' ? 'tag-outline' : 'tag-accent',
        c4: `${m.count7d} 次`,
        c5: m.hitRate,
        c3click: m.state === 'open' ? () => app.openDrawer({ kind: 'miss', code: m.code }) : undefined,
        open: () => app.openDrawer({ kind: 'miss', code: m.code }),
        acts:
          m.state === 'open'
            ? [
                { l: '流程', on: () => app.openDrawer({ kind: 'miss', code: m.code }) },
                { l: '新建条目', on: () => draftFromMiss(app, m.code) },
              ]
            : [{ l: '查看草稿', on: () => app.go('author.drafts') }],
      })),
      filters: [
        { l: '全部' },
        { l: '待处理', test: (x) => x.c3 === '待处理' },
        { l: '已排期', test: (x) => x.c3 === '已排期' },
      ],
      actions: [],
      emptyTitle: '暂无未命中问题',
      emptyDesc: '召回为空或低置信的提问会自动聚类到这里。',
      emptyCta: '返回工作台',
      emptyOn: () => app.go('dash'),
    };
  }

  if (r === 'meta.tree') {
    const list = (data.categories as CategoryDto[]) ?? [];
    return {
      kicker: '元数据中心',
      title: '知识分类（一级）',
      desc: '一级分类对应 Zendesk 目录。新增、更新与上下架都走审核，通过后才写入 Zendesk；下架会删除对应的 Zendesk Category，需二次确认。',
      headers: ['分类（中文）', 'English', '状态', '二级场景', '知识数'],
      rows: list.map((c) => ({
        id: c.id,
        c1: c.nameZh,
        sub: `${c.code} · Zendesk Category ${c.zendeskRef ?? '未同步'}`,
        c2: c.nameEn || '未翻译',
        c3: c.pendingReview ? '审核中' : c.statusLabel,
        tagCls: c.pendingReview ? 'tag-outline' : c.status === 'published' ? 'tag-accent' : 'tag-neutral',
        c4: `${c.sceneCount} 个`,
        c5: c.entryCount,
        open: () =>
          app.openDrawer({ kind: 'meta', metaKind: '分类', id: c.id, zh: c.nameZh, en: c.nameEn, parent: '', parentId: '', type: '业务' }),
        acts: [
          {
            l: '编辑双语',
            on: () =>
              app.openDrawer({ kind: 'meta', metaKind: '分类', id: c.id, zh: c.nameZh, en: c.nameEn, parent: '', parentId: '', type: '业务' }),
          },
          {
            l: c.status === 'published' ? '下架' : '上架',
            on: () => shelfMeta(app, 'categories', c.id, '分类', c.nameZh, c.status),
          },
          { l: '查看场景', on: () => app.go('meta.scenes') },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '已上架', test: (x) => x.c3 === '已上架' },
        { l: '审核中', test: (x) => x.c3 === '审核中' },
        { l: '已下架', test: (x) => x.c3 === '已下架' },
      ],
      actions: [
        {
          l: '新增分类',
          cls: 'btn-primary',
          on: () =>
            app.openDrawer({ kind: 'meta', metaKind: '分类', id: null, zh: '', en: '', parent: '', parentId: '', type: '业务' }),
        },
      ],
    };
  }

  if (r === 'meta.scenes') {
    const list = (data.scenes as SceneMetaDto[]) ?? [];
    return {
      kicker: '元数据中心',
      title: '问题场景（二级）',
      desc: '二级场景挂在一级分类下，对应 Zendesk 的 Section。新增与上下架同样走审核；下架会先归档其下文章再删除 Section，需二次确认。所属分类必须已发布才能操作场景。',
      headers: ['场景（中文）', 'English', '状态', '上级分类', '知识数'],
      rows: list.map((s) => ({
        id: s.id,
        c1: s.nameZh,
        sub: `${s.code} · Zendesk Section ${s.zendeskRef ?? '未同步'}`,
        c2: s.nameEn || '未翻译',
        c3: s.pendingReview ? '审核中' : s.statusLabel,
        tagCls: s.pendingReview ? 'tag-outline' : s.status === 'published' ? 'tag-accent' : 'tag-neutral',
        c4: s.categoryZh,
        c5: s.entryCount,
        open: () =>
          app.openDrawer({
            kind: 'meta',
            metaKind: '场景',
            id: s.id,
            zh: s.nameZh,
            en: s.nameEn,
            parent: s.categoryZh,
            parentId: s.categoryId,
            type: '业务',
          }),
        acts: [
          {
            l: '编辑双语',
            on: () =>
              app.openDrawer({
                kind: 'meta',
                metaKind: '场景',
                id: s.id,
                zh: s.nameZh,
                en: s.nameEn,
                parent: s.categoryZh,
                parentId: s.categoryId,
                type: '业务',
              }),
          },
          {
            l: s.status === 'published' ? '下架' : '上架',
            on: () => shelfMeta(app, 'scenes', s.id, '场景', s.nameZh, s.status),
          },
          { l: '查看知识', on: () => app.go('kb.list') },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '已上架', test: (x) => x.c3 === '已上架' },
        { l: '审核中', test: (x) => x.c3 === '审核中' },
        { l: '已下架', test: (x) => x.c3 === '已下架' },
      ],
      actions: [
        {
          l: '新增场景',
          cls: 'btn-primary',
          on: () =>
            app.openDrawer({
              kind: 'meta',
              metaKind: '场景',
              id: null,
              zh: '',
              en: '',
              parent: app.catalog[0]?.zh ?? '',
              parentId: app.catalog[0]?.id ?? '',
              type: '业务',
            }),
        },
      ],
    };
  }

  if (r === 'meta.tags') {
    const list = (data.tags as TagDto[]) ?? [];
    return {
      kicker: '元数据中心',
      title: '知识标签',
      desc: '标签仅用于本地检索与推荐适配，不做翻译。与分类、场景一致，支持新增、编辑与上下架；重复标签可合并，合并后引用自动改写。',
      headers: ['标签', '类型', '状态', '引用数', '创建人'],
      rows: list.map((t) => ({
        id: t.id,
        c1: t.name,
        sub: `${t.code} · 不翻译`,
        c2: t.type,
        c3: t.active ? '已上架' : '已下架',
        tagCls: t.active ? 'tag-accent' : 'tag-neutral',
        c4: `${t.refCount} 次`,
        c5: t.createdBy,
        open: () =>
          app.openDrawer({ kind: 'meta', metaKind: '标签', id: t.id, zh: t.name, en: '', parent: '', parentId: '', type: t.type }),
        acts: [
          {
            l: '编辑',
            on: () =>
              app.openDrawer({ kind: 'meta', metaKind: '标签', id: t.id, zh: t.name, en: '', parent: '', parentId: '', type: t.type }),
          },
          { l: t.active ? '下架' : '上架', on: () => toggleTag(app, t.id, t.name, t.active) },
          { l: '合并', on: () => app.openModal({ type: 'mergeTag', id: t.id, name: t.name }) },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '已上架', test: (x) => x.c3 === '已上架' },
        { l: '已下架', test: (x) => x.c3 === '已下架' },
      ],
      actions: [
        {
          l: '新增标签',
          cls: 'btn-primary',
          on: () =>
            app.openDrawer({ kind: 'meta', metaKind: '标签', id: null, zh: '', en: '', parent: '', parentId: '', type: '业务' }),
        },
      ],
    };
  }

  if (r === 'admin.users') {
    const list = (data.users as AdminUserDto[]) ?? [];
    return {
      kicker: '系统管理',
      title: '用户与角色',
      desc: '两类角色：超级管理员可配置系统与权限；知识运营负责采集、编辑、审核与反馈处理。',
      headers: ['用户', '部门', '角色', '最近登录', '状态'],
      rows: list.map((u) => ({
        id: u.id,
        c1: u.name,
        sub: `${u.uid} · ${u.email}`,
        c2: u.department,
        c3: u.roleLabel,
        tagCls: u.role === 'super' ? 'tag-accent' : 'tag-neutral',
        c4: u.lastActive,
        c5: u.status,
        acts: [
          {
            l: '编辑',
            on: () =>
              app.openDrawer({
                kind: 'user',
                id: u.id,
                name: u.name,
                email: u.email,
                department: u.department,
                role: u.role,
                reviewGranted: u.reviewGranted,
              }),
          },
          {
            l: u.enabled ? '停用' : '启用',
            on: async () => {
              await api.post(`/admin/users/${u.id}/toggle`, { enabled: !u.enabled });
              app.refreshShell();
              app.toast('账号状态已变更', `${u.name} 已${u.enabled ? '停用（会话立即失效）' : '启用'}。`);
            },
          },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '超级管理员', test: (x) => x.c3 === '超级管理员' },
        { l: '知识运营', test: (x) => x.c3 !== '超级管理员' },
      ],
      actions: [{ l: '新增用户', cls: 'btn-primary', on: () => app.openDrawer({ kind: 'user' }) }],
    };
  }

  if (r === 'admin.perms') {
    const rows = (data.rows as PermissionRowDto[]) ?? [];
    return {
      kicker: '系统管理',
      title: '权限矩阵',
      desc: '权限按「模块 × 操作」授予。运营角色不可进入系统管理，也不能删除已发布知识。',
      headers: ['模块', '超级管理员', '知识运营', '备注', ''],
      rows: rows.map((p) => ({
        id: p.permission,
        c1: p.module,
        sub: `模块 ${p.index}`,
        c2: p.super,
        c3: p.ops === '不可见' ? '不可见' : '受限',
        tagCls: p.ops === '不可见' ? 'tag-neutral' : p.ops === '全部' ? 'tag-accent' : 'tag-outline',
        c4: p.note,
        c5: '',
        acts: [
          {
            l: '调整',
            on: () =>
              app.openDrawer({
                kind: 'info',
                title: p.module,
                meta: `模块 ${p.index} · ${p.permission}`,
                rows: [
                  { k: '权限点', v: p.permission },
                  { k: '超级管理员', v: p.super },
                  { k: '知识运营', v: p.ops },
                  { k: '当前对运营', v: p.opsAllowed ? '允许' : '禁止' },
                  { k: '备注', v: p.note },
                ],
                body: '权限按「模块 × 操作」授予，改动即时生效并写入审计。审核权限是单独授予项：矩阵关闭时仍可在「用户与角色」按人开启。',
                action: {
                  label: p.opsAllowed ? '对运营收回' : '对运营开放',
                  run: async () => {
                    await api.put('/admin/permissions', {
                      permission: p.permission,
                      role: 'ops',
                      allowed: !p.opsAllowed,
                    });
                    app.refreshShell();
                    app.toast(
                      '权限矩阵已更新',
                      `「${p.module}」对知识运营已${p.opsAllowed ? '收回' : '开放'}，即时生效。`,
                    );
                  },
                },
              }),
          },
        ],
      })),
      filters: [{ l: '全部' }],
      actions: [],
    };
  }

  if (r === 'admin.audit') {
    const logs = (data.logs as AuditRowDto[]) ?? [];
    return {
      kicker: '系统管理',
      title: '操作审计',
      desc: '中台所有写操作实时留痕，含角色、对象与结果。这是排查数据流转问题的第一入口。',
      headers: ['操作', '对象', '结果', '时间', '操作人'],
      rows: logs.map((a) => ({
        id: a.id,
        c1: `${a.act} · ${a.obj}`,
        sub: `日志 ${a.no}`,
        c2: a.objCode ?? '—',
        c3: a.result,
        tagCls: a.result === '失败' ? 'tag-neutral' : 'tag-accent',
        c4: a.at,
        c5: a.who,
        acts: [
          {
            l: '详情',
            on: () =>
              app.openDrawer({
                kind: 'info',
                title: '记录详情',
                meta: a.no,
                rows: [
                  { k: '记录标识', v: a.no },
                  { k: '发生时间', v: a.at },
                  { k: '操作人', v: `${a.who}（${a.role}）` },
                  { k: '操作', v: a.act },
                  { k: '结果', v: a.result },
                  { k: '关联对象', v: a.obj },
                  { k: '版本', v: a.version ?? '—' },
                ],
                body: a.detail ?? '审计表为 append-only：数据库规则禁止 UPDATE 与 DELETE，任何一条流转记录都可被追溯到源头。',
              }),
          },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '成功', test: (x) => x.c3 === '成功' },
        { l: '失败', test: (x) => x.c3 === '失败' },
      ],
      actions: [
        {
          l: '导出日志',
          cls: 'btn-secondary',
          on: () => {
            const csv = [
              ['时间', '操作人', '角色', '操作', '对象', '结果', '版本'].join(','),
              ...logs.map((a) => [a.at, a.who, a.role, a.act, `"${a.obj}"`, a.result, a.version ?? ''].join(',')),
            ].join('\n');
            downloadCsv(csv, 'coolfly-audit.csv');
            app.toast('导出已开始', `将导出 ${logs.length} 条操作日志（CSV）。`);
          },
        },
      ],
    };
  }

  return null;
}

/* ══════════ 共用动作 ══════════ */

function downloadCsv(csv: string, name: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从 Zendesk 拉取客诉：长操作，走进度模态，避免点了没反应 */
export async function pullFeedback(app: Ctx): Promise<void> {
  let res: { created: number; note: string } | null = null;
  await app.runWithProgress('从 Zendesk 拉取客诉', [
    {
      label: '读取文章投票与近 7 日会话',
      run: async ({ setDetail }) => {
        setDetail('正在调用 Zendesk 接口…');
        res = await api.post('/feedback/pull');
        setDetail(res!.note);
      },
    },
    {
      label: '归集到反馈回流',
      run: async ({ setDetail }) => {
        app.refreshShell();
        setDetail(res?.created ? `新增 ${res.created} 条待处理反馈` : '本次没有新增');
      },
    },
  ]);
}

export async function submitEntry(app: Ctx, code: string): Promise<void> {
  try {
    await api.post(`/entries/${code}/submit`);
    app.refreshShell();
    app.toast('已提交审核', `${code} 进入待审队列。通过后英文版本自动写入 Zendesk。`, {
      label: '前往审核中心',
      route: 'review.queue',
    });
  } catch (e) {
    const err = e as { status?: number; payload?: { errors?: string[] } };
    if (err.status === 422) {
      app.toast('无法直接提交', '缺少问题场景或英文版本，已为你打开编辑器。');
      app.go('author.editor', code);
      return;
    }
    app.toast('提交失败', e instanceof Error ? e.message : '未知错误');
  }
}

export async function syncEntry(app: Ctx, code: string): Promise<void> {
  const res = await api.post<{ ok: boolean; message: string }>(`/entries/${code}/sync`);
  app.refreshShell();
  app.toast(
    res.ok ? '同步完成' : '同步失败',
    res.ok ? `${code} 英文版本已写入 Zendesk。` : `${code}：${res.message}`,
    res.ok ? undefined : { label: '查看同步日志', route: 'publish.logs' },
  );
}

export async function fixFeedback(app: Ctx, code: string): Promise<void> {
  const r = await api.post<{ entry: EntryDto }>(`/feedback/${code}/fix`);
  app.refreshShell();
  app.toast(
    '已进入修复',
    `${r.entry.code} ${r.entry.version} 草稿已生成（线上仍为上一版本）。修改并翻译后重新提交审核。`,
  );
  app.go('author.editor', r.entry.code);
}

export async function draftFromMiss(app: Ctx, code: string): Promise<void> {
  const r = await api.post<{ entry: EntryDto }>(`/misses/${code}/draft`);
  app.refreshShell();
  app.toast(
    '已新建条目',
    `${r.entry.code} 草稿已生成（来源未命中 ${code}），撰写并翻译后提交审核即可覆盖该场景。`,
    { label: '前往我的草稿', route: 'author.drafts' },
  );
  app.go('author.editor', r.entry.code);
}

async function toggleTag(app: Ctx, id: string, name: string, wasActive: boolean): Promise<void> {
  await api.post(`/meta/tags/${id}/toggle`);
  app.refreshShell();
  app.toast(
    wasActive ? '已下架' : '已上架',
    `标签「${name}」已${wasActive ? '下架，不再参与本地检索与推荐' : '上架'}。`,
  );
}

/**
 * 分类 / 场景上下架：走审核，且下架必须二次确认——
 * 下架会删除 Zendesk 目录，删掉就找不回来了（用户要求 5）。
 */
async function shelfMeta(
  app: Ctx,
  kind: 'categories' | 'scenes',
  id: string,
  label: string,
  name: string,
  status: string,
): Promise<void> {
  if (status === 'published') {
    app.openModal({ type: 'unpublishMeta', kind, id, name });
    return;
  }
  try {
    const r = await api.post<{
      review: { code: string; applied: boolean; message: string };
      sync?: { ok: boolean; message: string };
    }>(`/meta/${kind}/${id}/toggle`);
    app.refreshShell();
    app.toast(
      r.review.applied ? `${label}已上架` : '上架已提交审核',
      r.sync ? `${r.review.message} ${r.sync.message}` : r.review.message,
      r.review.applied ? undefined : { label: '前往审核中心', route: 'review.queue' },
    );
  } catch (e) {
    app.toast('上架失败', e instanceof Error ? e.message : '未知错误');
  }
}
