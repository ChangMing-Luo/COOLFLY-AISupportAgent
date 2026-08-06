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
  type ReviewLogDto,
  type SceneMetaDto,
  type SyncLogDto,
  type TagDto,
} from '../api.js';
import { useApp, type Ctx } from '../shell.js';
import { C, Empty, kickerStyle, tnum } from '../ui.js';

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
  emptyTitle?: string;
  emptyDesc?: string;
  emptyCta?: string;
  emptyOn?: () => void;
}

/** 每个列表路由的数据源 */
const SOURCE: Record<string, string> = {
  'author.drafts': '/entries?view=drafts',
  'author.mine': '/entries?view=mine',
  'review.queue': '/entries?view=queue',
  'review.log': '/review/log',
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

  useEffect(() => {
    setFilterIdx(0);
  }, [app.route]);

  useEffect(() => {
    const src = SOURCE[app.route];
    if (!src) return;
    let alive = true;
    api
      .get<Record<string, unknown>>(src)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [app.route, app.rev]);

  const cfg = useMemo(() => (data ? buildCfg(app, data) : null), [app, data]);
  if (!cfg) return null;

  const filters = cfg.filters.length ? cfg.filters : [{ l: '全部' }];
  const idx = Math.min(filterIdx, filters.length - 1);
  const active = filters[idx];
  const rows = active.test ? cfg.rows.filter(active.test) : cfg.rows;
  const empty = rows.length === 0;

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
            <button key={a.l} className={`btn ${a.cls}`} onClick={() => void a.on()}>
              {a.l}
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
        <span style={{ fontSize: 12, color: C.muted, ...tnum }}>{rows.length} 条记录</span>
      </div>

      <table className="table">
        <thead>
          <tr>
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
                      onClick={() => void a.on()}
                      style={{ fontSize: 12 }}
                    >
                      {a.l}
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
      actions: [
        { l: '撰写新知识', cls: 'btn-primary', on: () => app.go('collect.extract') },
      ],
      emptyTitle: r === 'author.drafts' ? '草稿箱是空的' : '暂无提交记录',
      emptyDesc:
        r === 'author.drafts'
          ? '所有草稿都已提交审核。可以从 AI 抽取工作台继续认领候选。'
          : '提交审核后，知识会出现在这里。',
      emptyCta: '前往 AI 抽取',
      emptyOn: () => app.go('collect.extract'),
    };
  }

  if (r === 'review.queue') {
    const list = (data.entries as EntryDto[]) ?? [];
    return {
      kicker: '审核中心',
      title: '待我审核',
      desc: '审核通过后知识立即发布，并把英文版本同步写入 Zendesk；驳回需填写意见，草稿回到提交人手中。',
      headers: ['标题', '提交人', '状态', '提交时间', 'AI 置信'],
      rows: list.map((d) => ({
        ...entryRow(d),
        c2: d.ownerName,
        c5: d.confidencePct,
        acts: [{ l: '审核', on: () => app.openDrawer({ kind: 'review', code: d.code }) }],
      })),
      filters: [
        { l: '全部' },
        { l: '高置信 ≥85%', test: (x) => parseInt(String(x.c5), 10) >= 85 },
        { l: '待复核 <85%', test: (x) => parseInt(String(x.c5), 10) < 85 },
      ],
      actions: [],
      emptyTitle: '待审队列已清空',
      emptyDesc: '没有等待审核的知识。新提交会实时出现在这里，并在工作台待办中提醒。',
      emptyCta: '返回工作台',
      emptyOn: () => app.go('dash'),
    };
  }

  if (r === 'review.log') {
    const logs = (data.logs as ReviewLogDto[]) ?? [];
    return {
      kicker: '审核中心',
      title: '审核记录',
      desc: '所有审核结论留痕，可回溯到具体版本与意见。',
      headers: ['标题', '审核人', '结论', '时间', '版本'],
      rows: logs.map((l) => ({
        id: l.id,
        c1: l.obj,
        sub: l.act,
        c2: l.who,
        c3: l.verdict,
        tagCls: l.verdict === '驳回' ? 'tag-neutral' : 'tag-accent',
        c4: l.at,
        c5: l.version,
        acts: [
          {
            l: '查看',
            on: () =>
              app.openDrawer({
                kind: 'info',
                title: '审核结论',
                meta: l.id,
                rows: [
                  { k: '记录标识', v: l.id },
                  { k: '发生时间', v: l.at },
                  { k: '审核人', v: l.who },
                  { k: '结论', v: l.verdict },
                  { k: '关联对象', v: l.obj },
                  { k: '版本', v: l.version },
                ],
                body: '审核结论来自审计日志（append-only）。同一条目的多次审核会各留一条记录，可据此回溯每一次通过或驳回的时间、审核人与意见。',
              }),
          },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '通过', test: (x) => x.c3 === '通过' },
        { l: '驳回', test: (x) => x.c3 === '驳回' },
      ],
      actions: [],
      emptyTitle: '暂无审核记录',
      emptyDesc: '完成第一次审核后，结论会记录在这里。',
      emptyCta: '前往待审队列',
      emptyOn: () => app.go('review.queue'),
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
        { l: '成功', test: (x) => x.c3 === '成功' },
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
      actions: [
        {
          l: '从 Zendesk 拉取',
          cls: 'btn-primary',
          on: async () => {
            const res = await api.post<{ created: number; note: string }>('/feedback/pull');
            app.refreshShell();
            app.toast(res.created ? `已从 Zendesk 拉取 ${res.created} 条客诉` : '本次没有新客诉', res.note);
          },
        },
      ],
      emptyTitle: '暂无反馈',
      emptyDesc: '从 Zendesk 拉取后，客诉会汇总到这里。',
      emptyCta: '从 Zendesk 拉取',
      emptyOn: async () => {
        const res = await api.post<{ created: number; note: string }>('/feedback/pull');
        app.refreshShell();
        app.toast(res.created ? `已从 Zendesk 拉取 ${res.created} 条客诉` : '本次没有新客诉', res.note);
      },
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
      desc: '一级分类对应 Zendesk 目录。用户录入中文，大模型翻译为英文并支持二次编辑；同步到 Zendesk 时使用英文名称。',
      headers: ['分类（中文）', 'English', '状态', '二级场景', '知识数'],
      rows: list.map((c) => ({
        id: c.id,
        c1: c.nameZh,
        sub: `${c.code} · Zendesk Category`,
        c2: c.nameEn || '未翻译',
        c3: c.active ? '已上架' : '已下架',
        tagCls: c.active ? 'tag-accent' : 'tag-neutral',
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
          { l: c.active ? '下架' : '上架', on: () => toggleMeta(app, 'categories', c.id, '分类', c.nameZh, c.active) },
          { l: '查看场景', on: () => app.go('meta.scenes') },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '已上架', test: (x) => x.c3 === '已上架' },
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
      desc: '二级场景挂在一级分类下，同样对应 Zendesk 目录，需中英双语。每条知识必须归属一个场景，场景覆盖率直接影响召回。',
      headers: ['场景（中文）', 'English', '状态', '上级分类', '知识数'],
      rows: list.map((s) => ({
        id: s.id,
        c1: s.nameZh,
        sub: `${s.code} · Zendesk Section`,
        c2: s.nameEn || '未翻译',
        c3: s.active ? '已上架' : '已下架',
        tagCls: s.active ? 'tag-accent' : 'tag-neutral',
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
          { l: s.active ? '下架' : '上架', on: () => toggleMeta(app, 'scenes', s.id, '场景', s.nameZh, s.active) },
          { l: '查看知识', on: () => app.go('kb.list') },
        ],
      })),
      filters: [
        { l: '全部' },
        { l: '已上架', test: (x) => x.c3 === '已上架' },
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
          { l: t.active ? '下架' : '上架', on: () => toggleMeta(app, 'tags', t.id, '标签', t.name, t.active) },
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

async function toggleMeta(
  app: Ctx,
  kind: 'categories' | 'scenes' | 'tags',
  id: string,
  label: string,
  name: string,
  wasActive: boolean,
): Promise<void> {
  await api.post(`/meta/${kind}/${id}/toggle`);
  app.refreshShell();
  app.toast(
    wasActive ? '已下架' : '已上架',
    `${label}「${name}」已${wasActive ? '下架，不再对客展示' : '上架，恢复对客展示'}。`,
  );
}
