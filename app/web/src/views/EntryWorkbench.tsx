import { useMemo, useState, type ReactNode } from 'react';
import {
  zhCN,
  TUNABLES,
  VISIBILITIES,
  VISIBILITY_LABELS,
  VERSION_STATUS_LABELS,
  ENTRY_STATUS_LABELS,
  SUMMARY_SOURCE_LABELS,
  type EntryBody,
  type EntrySummary,
  type EntryRow,
  type EntryStatus,
  type GateResult,
  type Paragraph,
  type Visibility,
} from '@kb/contracts';
import { api, ApiError } from '../api';
import { BilingualEditor } from '../editor';
import {
  ConfirmModal,
  L,
  StatusPill,
  enStatusKind,
  entryStatusKind,
  fmtTime,
  syncStatusKind,
  useApp,
  useAsync,
} from '../shared';

/* ============================ 数据契约（服务端 GET /api/kb/entries/:id 返回结构） ============================ */

type EntryDetailRow = EntryRow & {
  body: EntryBody;
  enTitle: string | null;
  deviceModels: string[];
  ownerId: string | null;
  reviewCycleDays: number;
  rejectReason: string | null;
  blockedReason: string | null;
  submitterId: string | null;
  reviewSource: string;
};

interface PairRow {
  id: string;
  paragraphId: string;
  zh: string;
  en: string | null;
  internal: boolean;
  humanEdited: boolean;
  editNote: string | null;
}

interface VersionRow {
  id: string;
  versionNo: number;
  label: string;
  status: string;
  authorName: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  calls: number | null;
  hitRate: number | null;
  solveRate: number | null;
  adoptRate: number | null;
  bodySnapshot: EntryBody;
}

interface EntryLogRow {
  id: string;
  at: string;
  actorName: string;
  actorRole: string;
  action: string;
  field: string | null;
  before: string | null;
  after: string | null;
  note: string | null;
}

interface SignalRow {
  channel: string;
  signal_type: string;
  excerpt: string | null;
  certainty: string;
}

interface EffectRow {
  botRefs: number;
  agentRefs: number;
  downvotes: number;
  flags: number;
  solveRate: number | null;
  sampleShort: boolean;
}

interface EntryDetail {
  entry: EntryDetailRow;
  pairs: PairRow[];
  versions: VersionRow[];
  logs: EntryLogRow[];
  signals: SignalRow[];
  effect: EffectRow | null;
}

interface LibraryRow {
  id: string;
  name: string;
  note: string;
  internalOnly: boolean;
  count: number;
}

interface TreeRoot {
  id: string;
  name: string;
  count: number;
  children: Array<{ id: string; name: string; sectionRef: string | null; count: number }>;
}

/* ============================ 静态口径（页面 MD §5.3 字段侧栏 / 原型 SCENE1·SCENE2） ============================ */

const SCENE_L1 = ['售后与退款', '安装与配网', '设备使用', '会员与账户', '订单与物流'] as const;

const SCENE_L2: Record<string, string[]> = {
  售后与退款: ['退款时限', '退货运费', '保修换新'],
  安装与配网: ['Wi-Fi 配对', '支架安装', '太阳能供电'],
  设备使用: ['画质与录像', '夜视', '固件升级'],
  会员与账户: ['会员计费', '账号绑定'],
  订单与物流: ['发货与签收', '地址修改'],
};

const ENTRY_TYPES = ['FAQ 政策型', 'FAQ 型', '操作流程型', '内部口径'];

const REVIEW_CYCLE_OPTIONS = [90, 180, 365];

/** 状态流转条主链路；异常态（已驳回/已下线）不在链路上，单独标红 */
const FLOW: EntryStatus[] = ['draft', 'editing', 'pending_review', 'reviewing', 'approved', 'published'];

const SUMMARY_PURPOSE = zhCN.summary.purpose;

type TabKey = 'body' | 'ver' | 'metric' | 'log';

const TABS: Array<[TabKey, string]> = [
  ['body', '知识正文'],
  ['ver', '版本与回滚'],
  ['metric', '效果指标'],
  ['log', '操作日志'],
];

/* ============================ 表单模型 ============================ */

interface FormState {
  title: string;
  libraryId: string;
  chapterId: string;
  entryType: string;
  visibility: Visibility;
  sceneL1: string;
  sceneL2: string;
  labelsText: string;
  deviceModelsText: string;
  reviewCycleDays: number;
  ownerId: string | null;
  paragraphs: Paragraph[];
}

function emptyForm(): FormState {
  return {
    title: '',
    libraryId: '',
    chapterId: '',
    entryType: ENTRY_TYPES[1]!,
    visibility: 'public',
    sceneL1: SCENE_L1[0],
    sceneL2: SCENE_L2[SCENE_L1[0]]![0]!,
    labelsText: '',
    deviceModelsText: '全型号',
    reviewCycleDays: TUNABLES.reviewCycleDays,
    ownerId: null,
    paragraphs: [{ id: 'p_0', text: '', html: '', internal: false, heading: false }],
  };
}

function formOf(entry: EntryDetailRow): FormState {
  return {
    title: entry.title,
    libraryId: entry.libraryId,
    chapterId: entry.chapterId,
    entryType: entry.entryType,
    visibility: entry.visibility,
    sceneL1: entry.sceneL1,
    sceneL2: entry.sceneL2,
    labelsText: entry.labels.join('，'),
    deviceModelsText: entry.deviceModels.join('，'),
    reviewCycleDays: entry.reviewCycleDays ?? TUNABLES.reviewCycleDays,
    ownerId: entry.ownerId,
    paragraphs: entry.body.paragraphs.map((p) => ({ ...p })),
  };
}

function splitList(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

function versionStatusLabel(s: string): string {
  return VERSION_STATUS_LABELS[s as keyof typeof VERSION_STATUS_LABELS] ?? s;
}

function versionStatusKind(s: string): 'ok' | 'warn' | 'bad' | 'info' {
  if (s === 'current') return 'ok';
  if (s === 'rolled_back') return 'bad';
  if (s === 'pending') return 'warn';
  return 'info';
}

/* ============================ 通用小件 ============================ */

/**
 * 权限门控按钮：禁用时仍可点中外层 span 并弹出原因 toast。
 * 原生 disabled 按钮不派发 click，因此禁用态下把按钮本身设为 pointer-events:none，
 * 让点击落到承载 title 与 toast 的外层 span 上——「恒禁用 + 明示原因」两个要求同时满足。
 */
function GatedButton({
  label,
  onClick,
  disabled,
  reason,
  variant = 'default',
  size,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm';
  testId?: string;
}) {
  const { toast } = useApp();
  const cls = `btn${variant === 'primary' ? ' btn--primary' : variant === 'danger' ? ' btn--danger' : ''}${size === 'sm' ? ' btn--sm' : ''}`;
  const blocked = Boolean(disabled);
  return (
    <span
      style={{ display: 'inline-flex' }}
      title={blocked ? reason : undefined}
      onClick={blocked && reason ? () => toast(reason) : undefined}
    >
      <button
        type="button"
        className={cls}
        disabled={blocked}
        title={blocked ? reason : undefined}
        onClick={onClick}
        data-testid={testId}
        style={blocked ? { pointerEvents: 'none' } : undefined}
      >
        {label}
      </button>
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3 className="card__title" style={{ marginBottom: hint ? 4 : 12 }}>
        {title}
      </h3>
      {hint && <p className="meta" style={{ margin: '0 0 12px' }}>{hint}</p>}
      {children}
    </div>
  );
}

/* ============================ ① 状态流转条 ============================ */

function FlowBar({ status, lastLog }: { status: EntryStatus; lastLog: EntryLogRow | null }) {
  const idx = FLOW.indexOf(status);
  const abnormal = status === 'rejected' || status === 'offline';
  return (
    <div className="btn-row" style={{ gap: 6, borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
      {FLOW.map((s, i) => {
        const done = idx >= 0 && i < idx;
        const now = s === status;
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <StatusPill
              kind={now ? 'accent' : done ? 'ok' : 'plain'}
              text={`${done ? '✓ ' : now ? '● ' : ''}${ENTRY_STATUS_LABELS[s]}`}
            />
            {i < FLOW.length - 1 && <span className="meta">›</span>}
          </span>
        );
      })}
      {abnormal && (
        <span style={{ marginLeft: 4 }}>
          <StatusPill kind="bad" text={`⚠ ${ENTRY_STATUS_LABELS[status]}`} />
        </span>
      )}
      <span className="meta" style={{ marginLeft: 'auto' }}>
        {lastLog
          ? `最近操作：${lastLog.actorName}（${L.role(lastLog.actorRole)}） · ${lastLog.action} · ${fmtTime(lastLog.at)}`
          : '暂无操作记录'}
      </span>
    </div>
  );
}

/* ============================ ③ 门禁提示条 ============================ */

function GateBar({ gate, canPublish }: { gate: GateResult | null; canPublish: boolean }) {
  if (!canPublish) {
    return (
      <div className="note note--warn">{zhCN.ironLaw.publishBlocked}</div>
    );
  }
  if (!gate) {
    return <div className="note">新建条目尚未保存，保存并提交审核后才会跑发布门禁（三查：格式与字段完整性 / 敏感信息与内部口径 / 英文版本状态）。</div>;
  }
  const blockers = gate.checks.filter((c) => c.hard && !c.passed);
  if (blockers.length > 0) {
    return (
      <div className="note note--bad">
        <div className="strong">发布门禁未通过（{blockers.length} 项硬阻断），不入同步队列：</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          {blockers.map((c) => (
            <li key={c.key}>
              {c.label}——{c.detail}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <div className="note note--ok">{zhCN.gate.passed}</div>;
}

/* ============================ ⑥ AI 摘要面板 ============================ */

function SummaryPanel({
  summary,
  disabled,
  disabledReason,
  busy,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  summary: EntrySummary | null;
  disabled: boolean;
  disabledReason: string;
  busy: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}) {
  const source = summary?.source ?? 'none';
  return (
    <div className="card">
      <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="card__title" style={{ margin: 0 }}>AI 摘要</span>
        <StatusPill kind={source === 'human' ? 'accent' : source === 'ai' ? 'ok' : 'info'} text={SUMMARY_SOURCE_LABELS[source]} />
      </div>
      <p className="meta" style={{ margin: '0 0 10px' }}>用途：{SUMMARY_PURPOSE}</p>
      {editing ? (
        <>
          <textarea
            className="textarea"
            style={{ minHeight: 96 }}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            data-testid="summary-input"
            aria-label="AI 摘要"
          />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={onSave} data-testid="summary-save">
              {busy ? '保存中…' : '保存摘要'}
            </button>
            <button type="button" className="btn btn--sm" onClick={onCancelEdit}>取消</button>
          </div>
        </>
      ) : (
        <>
          {summary?.text ? (
            <div className="note" data-testid="summary-text">{summary.text}</div>
          ) : (
            <div className="note note--warn">{zhCN.summary.notPublished}</div>
          )}
          <div className="meta" style={{ marginTop: 8 }}>
            {summary?.generatedAt ? `生成时间 ${fmtTime(summary.generatedAt)} · ` : ''}
            {source === 'human' ? zhCN.summary.humanEdited : zhCN.summary.generatedOnPublish}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <GatedButton
              label="编辑摘要"
              variant="primary"
              size="sm"
              onClick={onStartEdit}
              disabled={disabled}
              reason={disabledReason}
              testId="summary-edit"
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ ④ 英文标题对照 ============================ */

/**
 * 标题不是段落，进不了双语编辑器的逐段对照，故单独成卡。
 * 英文标题缺失会让英文读者看到中文标题，因此与正文同属人工校验范围、缺失即阻断同步。
 */
function EnTitleCard({
  entryId,
  zhTitle,
  enTitle,
  canWrite,
  onDone,
}: {
  entryId: string;
  zhTitle: string;
  enTitle: string | null;
  canWrite: boolean;
  onDone: () => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<{ en: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.put(`/api/kb/entries/${entryId}/translation/title`, {
        enTitle: draft?.en ?? '',
        note: draft?.note ?? '',
      });
      toast('已保存英文标题并留痕');
      setDraft(null);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div className="btn-row" style={{ marginBottom: 6 }}>
        <span className="meta mono">标题</span>
        {!enTitle?.trim() && <StatusPill kind="warn" text="英文标题缺失 · 同步阻断" />}
      </div>
      <div className="grid grid--2">
        <div>
          <div className="field__label">中文（权威源）</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{zhTitle}</div>
        </div>
        <div>
          <div className="field__label">英文标题（同步 Zendesk）</div>
          <input
            className="input"
            value={draft?.en ?? enTitle ?? ''}
            readOnly={!canWrite}
            placeholder="English title"
            onChange={(e) => setDraft({ en: e.target.value, note: draft?.note ?? '' })}
            data-testid="en-title-input"
          />
          <input
            className="input"
            style={{ marginTop: 6 }}
            value={draft?.note ?? ''}
            readOnly={!canWrite}
            placeholder="修订说明（可留空）"
            onChange={(e) => setDraft({ en: draft?.en ?? enTitle ?? '', note: e.target.value })}
          />
          <div className="btn-row" style={{ marginTop: 6 }}>
            <GatedButton
              label="保存英文标题"
              size="sm"
              onClick={() => void save()}
              disabled={!canWrite || (draft?.en ?? enTitle ?? '').trim() === '' || busy}
              reason={
                !canWrite
                  ? zhCN.ironLaw.readOnlyEditor
                  : (draft?.en ?? enTitle ?? '').trim() === ''
                    ? '英文标题不能为空'
                    : '处理中，请稍候'
              }
              testId="en-title-save"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ ⑦ 版本 diff（逐行 LCS 对齐） ============================ */

type DiffKind = 'same' | 'del' | 'add' | 'gap';

interface DiffLine {
  text: string;
  kind: DiffKind;
}

function diffLines(a: string[], b: string[]): Array<[DiffLine, DiffLine]> {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const rows: Array<[DiffLine, DiffLine]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push([{ text: a[i]!, kind: 'same' }, { text: b[j]!, kind: 'same' }]);
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      rows.push([{ text: a[i]!, kind: 'del' }, { text: '', kind: 'gap' }]);
      i += 1;
    } else {
      rows.push([{ text: '', kind: 'gap' }, { text: b[j]!, kind: 'add' }]);
      j += 1;
    }
  }
  while (i < n) {
    rows.push([{ text: a[i]!, kind: 'del' }, { text: '', kind: 'gap' }]);
    i += 1;
  }
  while (j < m) {
    rows.push([{ text: '', kind: 'gap' }, { text: b[j]!, kind: 'add' }]);
    j += 1;
  }
  return rows;
}

function DiffCell({ line }: { line: DiffLine }) {
  const cls =
    line.kind === 'del'
      ? 'diff__line diff__line--del'
      : line.kind === 'add'
        ? 'diff__line diff__line--add'
        : line.kind === 'same'
          ? 'diff__line diff__line--same'
          : 'diff__line';
  return <div className={cls}>{line.text === '' ? ' ' : line.text}</div>;
}

/* ============================ 页签② 版本与回滚 ============================ */

function VersionsTab({
  entryId,
  versions,
  onDone,
}: {
  entryId: string;
  versions: VersionRow[];
  onDone: () => void;
}) {
  const { can, toast } = useApp();
  const [leftNo, setLeftNo] = useState<number>(versions[1]?.versionNo ?? versions[0]?.versionNo ?? 0);
  const [rightNo, setRightNo] = useState<number>(versions[0]?.versionNo ?? 0);
  const [confirmTarget, setConfirmTarget] = useState<VersionRow | null>(null);
  const [busy, setBusy] = useState(false);

  const left = versions.find((v) => v.versionNo === leftNo) ?? null;
  const right = versions.find((v) => v.versionNo === rightNo) ?? null;
  const rows = useMemo(() => {
    if (!left || !right) return [];
    const toLines = (b: EntryBody): string[] => b.paragraphs.map((p) => p.text);
    return diffLines(toLines(left.bodySnapshot), toLines(right.bodySnapshot));
  }, [left, right]);

  const current = versions.find((v) => v.status === 'current') ?? null;
  const best = versions.reduce<VersionRow | null>(
    (acc, v) => (v.solveRate !== null && (acc === null || (acc.solveRate ?? 0) < v.solveRate) ? v : acc),
    null,
  );
  const drop =
    current && current.solveRate !== null && best && best.solveRate !== null && best.versionNo !== current.versionNo
      ? best.solveRate - current.solveRate
      : 0;
  const adviseRollback = drop >= TUNABLES.rollbackAdviceDropPp;

  const canRollback = can('version.rollback');

  const doRollback = async (): Promise<void> => {
    if (!confirmTarget) return;
    setBusy(true);
    try {
      await api.post(`/api/review/${entryId}/rollback`, { targetVersionNo: confirmTarget.versionNo });
      toast(`已回滚到 v${confirmTarget.versionNo}：目标版重新生效，当前版标记「已回滚」，已写入操作日志与同步队列`);
      setConfirmTarget(null);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="版本列表" hint="效果指标绑定到版本；历史版本与指标只增不删">
        {versions.length === 0 ? (
          <div className="empty">尚无版本记录——条目首次发布后生成 v1。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>版本号</th>
                <th>变更说明</th>
                <th>状态</th>
                <th>生效区间</th>
                <th>操作人</th>
                <th>调用</th>
                <th>命中率</th>
                <th>解决率</th>
                <th>采纳率</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={v.status === 'current' ? 'row--warn' : undefined}>
                  <td className="mono strong">v{v.versionNo}</td>
                  <td>{v.label}</td>
                  <td>
                    <StatusPill kind={versionStatusKind(v.status)} text={versionStatusLabel(v.status)} />
                  </td>
                  <td className="mono">
                    {fmtTime(v.effectiveFrom)} → {v.effectiveTo ? fmtTime(v.effectiveTo) : '至今'}
                  </td>
                  <td>{v.authorName}</td>
                  <td className="mono">{v.calls ?? '—'}</td>
                  <td className="mono">{pct(v.hitRate)}</td>
                  <td
                    className="mono strong"
                    style={{
                      color:
                        v.solveRate !== null && v.solveRate < TUNABLES.lowSolveRatePct ? 'var(--bad-fg)' : 'var(--fg)',
                    }}
                  >
                    {pct(v.solveRate)}
                  </td>
                  <td className="mono">{pct(v.adoptRate)}</td>
                  <td>
                    {v.status !== 'current' && v.status !== 'pending' && (
                      <GatedButton
                        label="回滚到此版本"
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmTarget(v)}
                        disabled={!canRollback}
                        reason="版本回滚仅知识审核员可执行。"
                        testId={`rollback-v${v.versionNo}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {adviseRollback && current && best && (
          <div className="note note--warn" style={{ marginTop: 12 }}>
            回滚建议：当前发布版 v{current.versionNo}（{current.label}）解决率 {pct(current.solveRate)}，较历史最高版 v
            {best.versionNo} 的 {pct(best.solveRate)} 下降 {drop.toFixed(0)}pp（阈值 {TUNABLES.rollbackAdviceDropPp}
            pp）——建议先回滚 v{best.versionNo}，再单独修订口径并观察两周。
          </div>
        )}
      </Section>

      <Section title="内容 Diff 对比" hint="选两个版本，逐段文本行比对：红底为删除行、绿底为新增行">
        <div className="filters">
          <label className="field__label" style={{ margin: 0 }}>左侧</label>
          <select className="select" value={leftNo} onChange={(e) => setLeftNo(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.id} value={v.versionNo}>
                v{v.versionNo} · {v.label}
              </option>
            ))}
          </select>
          <label className="field__label" style={{ margin: 0 }}>右侧</label>
          <select className="select" value={rightNo} onChange={(e) => setRightNo(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.id} value={v.versionNo}>
                v{v.versionNo} · {v.label}
              </option>
            ))}
          </select>
        </div>
        {!left || !right ? (
          <div className="empty">版本不足两个，无法比对。</div>
        ) : (
          <div className="diff">
            <div className="strong">v{left.versionNo} · {left.label}</div>
            <div className="strong">v{right.versionNo} · {right.label}</div>
            {rows.map((r, i) => (
              <DiffCellPair key={i} row={r} />
            ))}
          </div>
        )}
      </Section>

      {confirmTarget && (
        <ConfirmModal
          title={`回滚到 v${confirmTarget.versionNo}（${confirmTarget.label}）`}
          confirmText={busy ? '回滚中…' : '确认回滚'}
          danger
          consequences={[
            `目标版本 v${confirmTarget.versionNo} 的正文重新生效，并以新版本号对外发布`,
            '当前发布版本标记为「已回滚」',
            '写入操作日志与同步队列（分钟级推送 Zendesk）',
            '历史版本与各版效果指标不删除，可再次比对',
          ]}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void doRollback()}
        />
      )}
    </>
  );
}

function DiffCellPair({ row }: { row: [DiffLine, DiffLine] }) {
  return (
    <>
      <DiffCell line={row[0]} />
      <DiffCell line={row[1]} />
    </>
  );
}

/* ============================ 页签③ 效果指标 ============================ */

function MetricsTab({
  versions,
  effect,
  signals,
}: {
  versions: VersionRow[];
  effect: EffectRow | null;
  signals: SignalRow[];
}) {
  const current = versions.find((v) => v.status === 'current') ?? versions[0] ?? null;
  const sampleShort = effect?.sampleShort ?? false;
  const solve = effect?.solveRate ?? current?.solveRate ?? null;
  const rated = versions.filter((v) => v.solveRate !== null);

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat">
          <div className="stat__label">调用次数</div>
          <div className="stat__value">{current?.calls ?? (effect ? effect.botRefs + effect.agentRefs : '—')}</div>
          <div className="stat__hint">近 30 天 · bot + 人工引用合计</div>
        </div>
        <div className="stat">
          <div className="stat__label">命中率</div>
          <div className="stat__value">{pct(current?.hitRate ?? null)}</div>
          <div className="stat__hint">检索到本条目 / 相关提问</div>
        </div>
        <div className="stat">
          <div className="stat__label">解决率</div>
          <div
            className="stat__value"
            style={{
              color:
                !sampleShort && solve !== null && solve < TUNABLES.lowSolveRatePct ? 'var(--bad-fg)' : 'var(--fg)',
            }}
          >
            {sampleShort ? zhCN.dash.sampleShort : pct(solve)}
          </div>
          <div className="stat__hint">
            {sampleShort
              ? `引用不足 ${TUNABLES.sampleFloor} 次，不做达标判定`
              : '引用后会话判解决 · 近似归因（非因果）'}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">采纳率</div>
          <div className="stat__value">{pct(current?.adoptRate ?? null)}</div>
          <div className="stat__hint">bot 引用后真正写进回答</div>
        </div>
      </div>

      <Section title="各版本解决率对比" hint={`低于 ${TUNABLES.lowSolveRatePct}% 标红`}>
        {rated.length === 0 ? (
          <div className="empty">暂无版本级解决率数据。</div>
        ) : (
          rated.map((v) => (
            <div key={v.id} style={{ marginBottom: 12 }}>
              <div className="btn-row" style={{ marginBottom: 4 }}>
                <span className="mono strong">v{v.versionNo}</span>
                <span className="meta">{v.label}</span>
                <span className="mono strong" style={{ marginLeft: 'auto' }}>{pct(v.solveRate)}</span>
              </div>
              <div className="bar">
                <div
                  className={`bar__fill${(v.solveRate ?? 0) < TUNABLES.lowSolveRatePct ? ' bar__fill--bad' : ''}`}
                  style={{ width: `${Math.max(0, Math.min(100, v.solveRate ?? 0))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="条目级反馈信号" hint="待核实档位的信号不进达标判定">
        {signals.length === 0 ? (
          <div className="empty">暂无回流信号。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>渠道</th>
                <th>信号类型</th>
                <th>原文摘录</th>
                <th>确定性</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={`${s.channel}-${s.signal_type}-${i}`}>
                  <td>{s.channel}</td>
                  <td>{s.signal_type}</td>
                  <td>{s.excerpt ?? '—'}</td>
                  <td>
                    <StatusPill
                      kind={s.certainty === 'certain' ? 'ok' : s.certainty === 'unverified' ? 'warn' : 'info'}
                      text={L.certainty(s.certainty)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {effect && (
          <div className="note" style={{ marginTop: 12 }}>
            聚合计数：bot 引用 {effect.botRefs} · 客服引用 {effect.agentRefs} · 被踩 {effect.downvotes} · 客服 flag{' '}
            {effect.flags}
          </div>
        )}
      </Section>
    </>
  );
}

/* ============================ 页签④ 操作日志 ============================ */

function LogsTab({ logs }: { logs: EntryLogRow[] }) {
  if (logs.length === 0) return <div className="empty">本条目暂无留痕记录。</div>;
  return (
    <Section title="条目日志" hint={`本条目全量留痕 · 与全局操作日志同源 · ${zhCN.audit.appendOnly}`}>
      {logs.map((g) => (
        <div key={g.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
          <span className="meta mono" style={{ flex: 'none', width: 96 }}>{fmtTime(g.at)}</span>
          <div style={{ minWidth: 0 }}>
            <div>
              <span className="strong">{g.actorName}</span>
              <span className="meta">（{L.role(g.actorRole)}）</span> · {g.action}
            </div>
            {g.field && (
              <div style={{ marginTop: 2 }}>
                {g.field}：
                <span className="mono" style={{ background: 'var(--bad-bg)', borderRadius: 4, padding: '0 5px' }}>
                  {g.before ?? '—'}
                </span>{' '}
                →{' '}
                <span className="mono" style={{ background: 'var(--ok-bg)', borderRadius: 4, padding: '0 5px' }}>
                  {g.after ?? '—'}
                </span>
              </div>
            )}
            {g.note && <div className="meta" style={{ marginTop: 2 }}>{g.note}</div>}
          </div>
        </div>
      ))}
    </Section>
  );
}

/* ============================ 主视图 ============================ */

export function EntryWorkbenchView({ entryId }: { entryId: string | null }) {
  const { can, toast, goto, refreshNav } = useApp();
  const [tab, setTab] = useState<TabKey>('body');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [hydrated, setHydrated] = useState<string>('');
  const [conflict, setConflict] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [sumBusy, setSumBusy] = useState(false);
  const [enBusy, setEnBusy] = useState('');
  const [offlining, setOffliningg] = useState(false);
  const [enEdits, setEnEdits] = useState<Record<string, { en: string; note: string }>>({});
  const [sumEditing, setSumEditing] = useState(false);
  const [sumDraft, setSumDraft] = useState('');

  const detail = useAsync<EntryDetail | null>(
    () => (entryId ? api.get<EntryDetail>(`/api/kb/entries/${entryId}`) : Promise.resolve(null)),
    [entryId],
  );
  const gate = useAsync<GateResult | null>(
    () => (entryId ? api.get<GateResult>(`/api/review/${entryId}/gate`) : Promise.resolve(null)),
    [entryId],
  );
  const summary = useAsync<EntrySummary | null>(
    () => (entryId ? api.get<EntrySummary>(`/api/kb/entries/${entryId}/summary`) : Promise.resolve(null)),
    [entryId],
  );
  const libs = useAsync<LibraryRow[]>(() => api.get<LibraryRow[]>('/api/kb/libraries'), []);
  const tree = useAsync<TreeRoot[]>(
    () => (form.libraryId ? api.get<TreeRoot[]>(`/api/kb/tree?libraryId=${form.libraryId}`) : Promise.resolve([])),
    [form.libraryId],
  );

  const entry = detail.data?.entry ?? null;
  const hydrateKey = entry ? `${entry.id}:${entry.lockVersion}` : `new:${entryId ?? '-'}`;

  // 载入完成 / 保存成功后按 lockVersion 重新灌入表单（React 官方「props 变化时调整 state」写法）
  if (hydrated !== hydrateKey && (entry !== null || entryId === null)) {
    setHydrated(hydrateKey);
    setForm(entry ? formOf(entry) : emptyForm());
    setConflict('');
  }

  const canWrite = can('entry.write');
  const canSubmit = can('entry.submit');
  const canPublish = can('publish');
  const isNew = entryId === null;

  const chapterOptions = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const root of tree.data ?? []) {
      if (root.children.length === 0) out.push({ id: root.id, label: root.name });
      for (const c of root.children) out.push({ id: c.id, label: `${root.name} → ${c.name}` });
    }
    return out;
  }, [tree.data]);

  const reloadAll = (): void => {
    detail.reload();
    gate.reload();
    summary.reload();
    refreshNav();
  };

  const payload = (): Record<string, unknown> => ({
    title: form.title,
    libraryId: form.libraryId,
    chapterId: form.chapterId,
    entryType: form.entryType,
    visibility: form.visibility,
    sceneL1: form.sceneL1,
    sceneL2: form.sceneL2,
    labels: splitList(form.labelsText),
    deviceModels: splitList(form.deviceModelsText),
    reviewCycleDays: form.reviewCycleDays,
    ownerId: form.ownerId,
    body: { paragraphs: form.paragraphs },
  });

  const save = async (): Promise<void> => {
    setSaving(true);
    setConflict('');
    try {
      if (isNew) {
        const created = await api.post<EntryRow>('/api/kb/entries', payload());
        toast(`已创建草稿 ${created.code}，可继续编辑或提交审核`);
        refreshNav();
        goto('entry', created.id);
      } else {
        await api.put<EntryRow>(`/api/kb/entries/${entryId}`, {
          ...payload(),
          expectedVersion: entry?.lockVersion,
        });
        toast('已保存中文草稿：英文置「待重新校验」、同步阻断');
        reloadAll();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(err.message);
      }
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!entryId) return;
    try {
      await api.post(`/api/kb/entries/${entryId}/submit`, { source: 'manual' });
      toast('已提交审核：进入审核中心待审队列（统一过审，无绕过路径）');
      reloadAll();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const publish = async (): Promise<void> => {
    if (!entryId) return;
    try {
      const r = await api.post<{ status: string; gate: GateResult }>(`/api/review/${entryId}/publish`);
      toast(r.status === 'published' ? '已发布并写入同步队列' : '发布门禁未通过，已展示阻断原因');
      reloadAll();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  /** 下线：published → offline + Zendesk 归档（不是删除，版本与指标全留，可重新编辑上架） */
  const offline = async (): Promise<void> => {
    if (!entryId) return;
    setOffliningg(false);
    try {
      await api.post(`/api/review/${entryId}/offline`);
      toast('已下线：Zendesk 端文章归档 + 重定向；版本历史与效果指标保留，重新编辑并过审即可再次上架');
      reloadAll();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  /** 英文侧动作：生成翻译 / 标记已确认 */
  const runEn = async (key: string, fn: () => Promise<unknown>, okMsg: string): Promise<void> => {
    setEnBusy(key);
    try {
      await fn();
      toast(okMsg);
      setEnEdits({});
      reloadAll();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnBusy('');
    }
  };

  /** 保存人工修订的英文段落（逐段 PUT，留痕并标「人工修订」） */
  const saveEnEdits = async (): Promise<void> => {
    const items = Object.entries(enEdits);
    if (items.length === 0 || !entryId) return;
    setEnBusy('save');
    try {
      for (const [pairId, v] of items) {
        await api.put(`/api/kb/entries/${entryId}/translation/${pairId}`, { en: v.en, note: v.note });
      }
      toast(`已保存 ${items.length} 段英文修订（已留痕）`);
      setEnEdits({});
      reloadAll();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnBusy('');
    }
  };

  /** 人工校正 AI 摘要：保存后 source='human'，后续发布不再被 AI 覆盖 */
  const saveSummary = async (): Promise<void> => {
    if (!entryId) return;
    setSumBusy(true);
    try {
      await api.put(`/api/kb/entries/${entryId}/summary`, { text: sumDraft.trim() });
      toast(zhCN.summary.humanEdited);
      setSumEditing(false);
      summary.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSumBusy(false);
    }
  };

  if (detail.loading || libs.loading) return <div className="empty">加载中…</div>;
  if (detail.error) return <div className="note note--bad">条目加载失败：{detail.error}</div>;

  const status: EntryStatus = entry?.status ?? 'draft';
  const lastLog = detail.data?.logs[0] ?? null;
  const readOnly = !canWrite;

  return (
    <div>
      {/* 头部：标识 + 操作按钮行 + 状态流转条 */}
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="btn-row" style={{ marginBottom: 4 }}>
              <button type="button" className="btn btn--sm" onClick={() => goto('kb')}>
                ← 返回列表
              </button>
              <span className="meta">{entry?.path ?? '新建条目 · 保存后进入草稿箱'}</span>
            </div>
            <h2 style={{ fontSize: 18, margin: '4px 0 6px' }}>{isNew ? '新建知识条目' : entry?.title}</h2>
            <div className="btn-row">
              {entry && <StatusPill kind="info" text={entry.code} />}
              <StatusPill kind={entryStatusKind(status)} text={L.entryStatus(status)} />
              {entry && <StatusPill kind={enStatusKind(entry.enStatus)} text={`英文 ${L.enStatus(entry.enStatus)}`} />}
              {entry && <StatusPill kind={syncStatusKind(entry.syncStatus)} text={`同步 ${L.syncStatus(entry.syncStatus)}`} />}
              {entry && <StatusPill kind="plain" text={`当前发布版本 ${entry.versionLabel}`} />}
            </div>
          </div>
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <GatedButton
              label={saving ? '保存中…' : zhCN.common.save}
              onClick={() => void save()}
              disabled={!canWrite || saving}
              reason={!canWrite ? zhCN.ironLaw.readOnlyEditor : '保存中，请稍候'}
              testId="save-zh"
            />
            <GatedButton
              label={zhCN.common.submitReview}
              variant="primary"
              onClick={() => void submit()}
              disabled={!canSubmit || isNew || status === 'pending_review' || status === 'reviewing'}
              reason={
                !canSubmit
                  ? '当前角色不可提交审核，可改为提交优化建议。'
                  : isNew
                    ? '请先保存中文草稿再提交审核'
                    : '条目已在审核队列中'
              }
              testId="submit-review"
            />
            <GatedButton
              label={zhCN.common.publish}
              variant="primary"
              onClick={() => void publish()}
              disabled={!canPublish || isNew}
              reason={!canPublish ? zhCN.ironLaw.publishBlocked : '请先保存中文草稿'}
              testId="publish"
            />
            <GatedButton
              label="下线"
              variant="danger"
              onClick={() => setOffliningg(true)}
              disabled={!canPublish || status !== 'published'}
              reason={!canPublish ? zhCN.ironLaw.publishBlocked : '只有「已发布」的条目才能下线'}
              testId="offline"
            />
          </div>
        </div>
        <FlowBar status={status} lastLog={lastLog} />
      </div>

      {/* 门禁提示条 */}
      <div style={{ marginTop: 12 }}>
        <GateBar gate={gate.data} canPublish={canPublish} />
      </div>

      {entry?.rejectReason && (
        <div className="note note--bad" style={{ marginTop: 12 }}>驳回理由：{entry.rejectReason}</div>
      )}
      {entry?.blockedReason && (
        <div className="note note--warn" style={{ marginTop: 12 }}>同步阻断原因：{entry.blockedReason}</div>
      )}
      {conflict && (
        <div className="note note--bad" style={{ marginTop: 12 }}>
          {conflict}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn--sm" onClick={() => { setHydrated(''); reloadAll(); }}>
              放弃本地改动，载入最新版本
            </button>
          </div>
        </div>
      )}

      {/* 四页签 */}
      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`tab${tab === k ? ' tab--active' : ''}`}
            onClick={() => setTab(k)}
            data-tab={k}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'body' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 7fr) minmax(280px, 3fr)', alignItems: 'start' }}>
          <div>
            {readOnly && <div className="note note--warn" style={{ marginBottom: 12 }}>{zhCN.ironLaw.readOnlyEditor}</div>}
            <div className="card">
              <div className="btn-row" style={{ marginBottom: 12 }}>
                <StatusPill kind={enStatusKind(entry?.enStatus ?? 'none')} text={`英文：${L.enStatus(entry?.enStatus ?? 'none')}`} />
                <GatedButton
                  label={(entry?.enStatus ?? 'none') === 'none' ? '生成英文翻译' : '重新翻译'}
                  size="sm"
                  onClick={() => void runEn('tr', () => api.post(`/api/kb/entries/${entryId}/translate`), '已生成英文对照（内部段落跳过）')}
                  disabled={!canWrite || isNew || enBusy !== ''}
                  reason={!canWrite ? zhCN.ironLaw.readOnlyEditor : isNew ? '请先保存中文草稿，再生成英文' : '处理中，请稍候'}
                  testId="en-translate"
                />
                <GatedButton
                  label="标记已确认"
                  size="sm"
                  variant="primary"
                  onClick={() => void runEn('cf', () => api.post(`/api/kb/entries/${entryId}/translation/confirm`), '英文已标记为「已确认」')}
                  disabled={!canWrite || isNew || entry?.enStatus === 'confirmed' || enBusy !== ''}
                  reason={!canWrite ? zhCN.ironLaw.readOnlyEditor : entry?.enStatus === 'confirmed' ? '英文已是「已确认」状态' : '请先保存中文草稿'}
                  testId="en-confirm"
                />
                <span className="meta" style={{ marginLeft: 'auto' }}>
                  中文是唯一权威源；中文一改，英文自动置「待重新校验」并阻断同步
                </span>
              </div>

              {/* 英文标题：PR#1 把「英文标题缺失」做成了同步阻断条件，双语改版后仍须保留 */}
              {!isNew && entry && (
                <EnTitleCard
                  entryId={entry.id}
                  zhTitle={entry.title}
                  enTitle={entry.enTitle}
                  canWrite={canWrite}
                  onDone={reloadAll}
                />
              )}

              <BilingualEditor
                paragraphs={form.paragraphs}
                pairs={detail.data?.pairs ?? []}
                readOnly={readOnly}
                enBusy={enBusy === 'tr'}
                onChange={(paragraphs) => setForm((f) => ({ ...f, paragraphs }))}
                onEnChange={(pairId, en, note) => setEnEdits((m) => ({ ...m, [pairId]: { en, note } }))}
              />

              {Object.keys(enEdits).length > 0 && (
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <GatedButton
                    label={`保存英文修订（${Object.keys(enEdits).length} 段）`}
                    size="sm"
                    variant="primary"
                    onClick={() => void saveEnEdits()}
                    disabled={!canWrite || enBusy !== ''}
                    reason={zhCN.ironLaw.readOnlyEditor}
                    testId="en-save"
                  />
                  <span className="meta">人工修订会留痕并标注「人工修订」</span>
                </div>
              )}
            </div>
          </div>

          {/* 字段侧栏 */}
          <div>
            <div className="card">
              <h3 className="card__title">条目字段</h3>
              <div className="field">
                <label className="field__label" htmlFor="f-title">标题</label>
                <input
                  id="f-title"
                  className="input"
                  value={form.title}
                  readOnly={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-lib">所属知识库</label>
                <select
                  id="f-lib"
                  className="select"
                  value={form.libraryId}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, libraryId: e.target.value, chapterId: '' }))}
                >
                  <option value="">请选择知识库</option>
                  {(libs.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-chap">目录 / 章节</label>
                <select
                  id="f-chap"
                  className="select"
                  value={form.chapterId}
                  disabled={readOnly || chapterOptions.length === 0}
                  onChange={(e) => setForm((f) => ({ ...f, chapterId: e.target.value }))}
                >
                  <option value="">请选择章节</option>
                  {chapterOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-type">条目类型</label>
                <select
                  id="f-type"
                  className="select"
                  value={form.entryType}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, entryType: e.target.value }))}
                >
                  {ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {!ENTRY_TYPES.includes(form.entryType) && <option value={form.entryType}>{form.entryType}</option>}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-vis">可见性</label>
                <select
                  id="f-vis"
                  className="select"
                  value={form.visibility}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as Visibility }))}
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-s1">问题场景（一级）</label>
                <select
                  id="f-s1"
                  className="select"
                  value={form.sceneL1}
                  disabled={readOnly}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sceneL1: e.target.value, sceneL2: SCENE_L2[e.target.value]?.[0] ?? '' }))
                  }
                >
                  {SCENE_L1.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!SCENE_L1.includes(form.sceneL1 as (typeof SCENE_L1)[number]) && (
                    <option value={form.sceneL1}>{form.sceneL1}</option>
                  )}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-s2">问题场景（二级）</label>
                <select
                  id="f-s2"
                  className="select"
                  value={form.sceneL2}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, sceneL2: e.target.value }))}
                >
                  {(SCENE_L2[form.sceneL1] ?? []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!(SCENE_L2[form.sceneL1] ?? []).includes(form.sceneL2) && form.sceneL2 !== '' && (
                    <option value={form.sceneL2}>{form.sceneL2}</option>
                  )}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-labels">标签（同步 Zendesk labels，逗号分隔）</label>
                <input
                  id="f-labels"
                  className="input"
                  value={form.labelsText}
                  readOnly={readOnly}
                  placeholder="退款，退货，运费"
                  onChange={(e) => setForm((f) => ({ ...f, labelsText: e.target.value }))}
                />
                <div className="meta">最多 {TUNABLES.maxLabels} 个 · 影响帮助中心搜索与 bot 匹配</div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="f-models">适用型号（逗号分隔）</label>
                <input
                  id="f-models"
                  className="input"
                  value={form.deviceModelsText}
                  readOnly={readOnly}
                  placeholder="全型号"
                  onChange={(e) => setForm((f) => ({ ...f, deviceModelsText: e.target.value }))}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="f-cycle">复核周期（天）</label>
                <select
                  id="f-cycle"
                  className="select"
                  value={form.reviewCycleDays}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, reviewCycleDays: Number(e.target.value) }))}
                >
                  {REVIEW_CYCLE_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} 天</option>
                  ))}
                  {!REVIEW_CYCLE_OPTIONS.includes(form.reviewCycleDays) && (
                    <option value={form.reviewCycleDays}>{form.reviewCycleDays} 天</option>
                  )}
                </select>
              </div>
            </div>

            <SummaryPanel
              summary={summary.data}
              disabled={!canWrite || isNew}
              disabledReason={!canWrite ? zhCN.ironLaw.readOnlyEditor : '请先保存中文草稿，再编辑摘要'}
              busy={sumBusy}
              editing={sumEditing}
              draft={sumDraft}
              onDraftChange={setSumDraft}
              onStartEdit={() => { setSumDraft(summary.data?.text ?? ''); setSumEditing(true); }}
              onCancelEdit={() => setSumEditing(false)}
              onSave={() => void saveSummary()}
            />
          </div>
        </div>
      )}

      {tab === 'ver' &&
        (entry ? (
          <VersionsTab entryId={entry.id} versions={detail.data?.versions ?? []} onDone={reloadAll} />
        ) : (
          <div className="empty">新建条目尚无版本记录。</div>
        ))}

      {tab === 'metric' &&
        (entry ? (
          <MetricsTab
            versions={detail.data?.versions ?? []}
            effect={detail.data?.effect ?? null}
            signals={detail.data?.signals ?? []}
          />
        ) : (
          <div className="empty">新建条目尚无效果数据。</div>
        ))}

      {tab === 'log' && <LogsTab logs={detail.data?.logs ?? []} />}

      {offlining && (
        <ConfirmModal
          danger
          title={`下线「${entry?.title ?? ''}」`}
          consequences={[
            '条目状态置「已下线」，不再对外提供——但**不是删除**',
            'Zendesk 端文章做归档 + 重定向，不裸删，帮助中心不会留死链',
            '版本历史、各版效果指标、审计日志全部保留可查',
            '需要再次上架时：重新编辑（自动回「编辑中」）→ 提交审核 → 通过 → 发布',
          ]}
          confirmText="确认下线"
          onConfirm={() => void offline()}
          onCancel={() => setOffliningg(false)}
        />
      )}
    </div>
  );
}
