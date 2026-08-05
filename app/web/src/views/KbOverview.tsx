import { useEffect, useState } from 'react';
import {
  ENTRY_STATUSES,
  TUNABLES,
  VISIBILITIES,
  zhCN,
  type EntryRow,
} from '@kb/contracts';
import { api } from '../api';
import { ImportPanel, type ChapterOption } from '../import';
import {
  ConfirmModal,
  L,
  StatusPill,
  dueText,
  enStatusKind,
  entryStatusKind,
  fmtTime,
  syncStatusKind,
  useApp,
  useAsync,
} from '../shared';

interface Library {
  id: string;
  name: string;
  note: string;
  internalOnly: boolean;
  count: number;
}

interface TreeLeaf {
  id: string;
  code: string;
  title: string;
}

interface TreeChild {
  id: string;
  name: string;
  sectionRef: string | null;
  count: number;
  /** 第三层：树内只呈现已发布条目（AC-F09-15 rev6「仅已发布」） */
  entries: TreeLeaf[];
}

interface TreeRoot {
  id: string;
  name: string;
  count: number;
  children: TreeChild[];
}

type DueFilter = '' | 'overdue' | 'soon';

const DUE_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: '', label: '复核：全部' },
  { value: 'overdue', label: '复核：已到期' },
  { value: 'soon', label: `复核：${TUNABLES.reviewDueSoonDays} 天内到期` },
];

export function KbOverviewView() {
  const { can, goto, toast } = useApp();

  const [libraryId, setLibraryId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [q, setQ] = useState('');
  const [scene, setScene] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [due, setDue] = useState<DueFilter>('');

  const [newParentId, setNewParentId] = useState('');
  const [newName, setNewName] = useState('');
  const [newSectionRef, setNewSectionRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [importing, setImporting] = useState(false);

  const libs = useAsync<Library[]>(() => api.get<Library[]>('/api/kb/libraries'), []);
  const tree = useAsync<TreeRoot[]>(
    () => (libraryId ? api.get<TreeRoot[]>(`/api/kb/tree?libraryId=${encodeURIComponent(libraryId)}`) : Promise.resolve([])),
    [libraryId],
  );
  const entries = useAsync<EntryRow[]>(() => {
    if (!libraryId) return Promise.resolve([]);
    const params = new URLSearchParams({ libraryId });
    if (status) params.set('status', status);
    if (visibility) params.set('visibility', visibility);
    if (due) params.set('due', due);
    if (q.trim()) params.set('q', q.trim());
    return api.get<EntryRow[]>(`/api/kb/entries?${params.toString()}`);
  }, [libraryId, status, visibility, due, q]);

  // 首个知识库为默认选中库（多库并行，切库即换结构树与条目列表）
  useEffect(() => {
    const first = libs.data?.[0];
    if (first && !libraryId) setLibraryId(first.id);
  }, [libs.data, libraryId]);

  // 结构树默认展开首个目录及其首个章节，使三级结构一眼可见（与 v3 原型一致）
  useEffect(() => {
    const roots = tree.data;
    if (!roots) return;
    const first = roots[0];
    const open = new Set<string>();
    if (first) {
      open.add(first.id);
      const firstChild = first.children[0];
      if (firstChild) open.add(firstChild.id);
    }
    setExpanded(open);
    setNewParentId(first?.id ?? '');
  }, [tree.data]);

  useEffect(() => {
    const err = libs.error ?? tree.error ?? entries.error;
    if (err) toast(err);
  }, [libs.error, tree.error, entries.error, toast]);

  const canManage = can('structure.manage');
  const currentLib = libs.data?.find((l) => l.id === libraryId) ?? null;
  const allRows = entries.data ?? [];
  const sceneOptions = [...new Set(allRows.map((r) => r.sceneL1))].sort();
  const rows = allRows.filter(
    (r) => (!scene || r.sceneL1 === scene) && (!chapterId || r.chapterId === chapterId),
  );
  const selectedChapter = tree.data?.flatMap((t) => t.children).find((c) => c.id === chapterId) ?? null;
  const allChapters = (tree.data ?? []).flatMap((t) => t.children);
  // 导入落点只能是章节（叶级），带上目录名便于用户分辨同名章节
  const chapterOptions: ChapterOption[] = (tree.data ?? []).flatMap((root) =>
    root.children.map((c) => ({ id: c.id, name: c.name, label: `${root.name} → ${c.name}` })),
  );

  function openCreate(parentId: string | null): void {
    setNewParentId(parentId ?? '');
    setNewName('');
    setNewSectionRef('');
    setCreating({ parentId });
  }

  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createChapter(): Promise<void> {
    if (!libraryId || busy) return;
    if (!newName.trim()) {
      toast('名称必填');
      return;
    }
    setBusy(true);
    try {
      await api.post<{ id: string }>('/api/kb/chapters', {
        libraryId,
        parentId: newParentId || null,
        name: newName.trim(),
        zendeskSectionRef: newSectionRef.trim() || null,
      });
      toast(`${newParentId ? '章节' : '目录'}「${newName.trim()}」已创建，结构变更已留痕`);
      setNewName('');
      setNewSectionRef('');
      setCreating(null);
      tree.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(): Promise<void> {
    if (!renaming || busy) return;
    const name = renaming.name.trim();
    if (!name) {
      toast('章节名称必填');
      return;
    }
    setBusy(true);
    try {
      await api.put<{ ok: boolean }>(`/api/kb/chapters/${renaming.id}`, { name });
      toast(`章节已重命名为「${name}」`);
      setRenaming(null);
      tree.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** 调整层级：把章节移到另一个顶级目录下（结构深度恒为 2） */
  async function moveChapter(): Promise<void> {
    if (!moving || busy) return;
    if (!moving.id) {
      toast('请先在结构树里选一个章节（点章节行的「移动」）');
      return;
    }
    if (!moveTarget) {
      toast('请选择目标目录');
      return;
    }
    setBusy(true);
    try {
      await api.patch<{ ok: boolean }>(`/api/kb/chapters/${moving.id}/parent`, { parentId: moveTarget });
      toast(`章节「${moving.name}」已移动，结构变更已留痕`);
      setMoving(null);
      setMoveTarget('');
      tree.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeChapter(): Promise<void> {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await api.del<{ ok: boolean }>(`/api/kb/chapters/${target.id}`);
      toast(`章节「${target.name}」已删除`);
      if (chapterId === target.id) setChapterId('');
      tree.reload();
    } catch (err) {
      // 含条目/子章节的章节被服务端拦截，中文错误里带条目数，原样呈现
      toast((err as Error).message);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 260px) minmax(0, 1fr)', alignItems: 'start' }}>
      <div>
        <div className="card">
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="card__title" style={{ margin: 0 }}>知识库（多库并行）</h2>
            {can('entry.write') && (
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => setImporting(true)}
                disabled={!libraryId}
                title={libraryId ? '把历史知识库文档一次性切成多条条目导入' : '请先选择一个知识库'}
                data-testid="open-import"
              >
                一键批量导入
              </button>
            )}
          </div>
          {libs.loading && <div className="empty">加载中…</div>}
          <div className="grid">
            {(libs.data ?? []).map((lib) => (
              <button
                key={lib.id}
                type="button"
                className={`stat${lib.id === libraryId ? ' stat--active' : ''}`}
                aria-pressed={lib.id === libraryId}
                onClick={() => {
                  setLibraryId(lib.id);
                  setChapterId('');
                }}
                data-library={lib.id}
              >
                <div className="stat__label">{lib.name}</div>
                <div className="stat__value">{lib.count} 条</div>
                <div className="stat__hint">{lib.note}</div>
                {lib.internalOnly && (
                  <div style={{ marginTop: 6 }}>
                    <StatusPill kind="info" text="不对外公开，仅挂客服 segment" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="tree__head">
            <div>
              <div className="tree__eyebrow">目录 → 章节 → 条目</div>
              <h2 className="card__title" style={{ margin: 0 }}>结构树</h2>
            </div>
            <StatusPill kind="info" text="仅已发布" />
          </div>

          {canManage && (
            <div className="tree__toolbar">
              <button type="button" className="btn btn--sm" onClick={() => openCreate(null)} data-testid="tree-new-root">
                新建目录
              </button>
              <button type="button" className="btn btn--sm" onClick={() => openCreate(tree.data?.[0]?.id ?? '')} data-testid="tree-new-chapter">
                新建章节
              </button>
              <button type="button" className="btn btn--sm" onClick={() => setMoving({ id: '', name: '' })} data-testid="tree-move">
                调整层级
              </button>
            </div>
          )}

          {tree.loading && <div className="empty">加载中…</div>}
          {!tree.loading && (tree.data ?? []).length === 0 && <div className="empty">该知识库还没有目录与章节</div>}

          <div className="tree">
            {(tree.data ?? []).map((root) => (
              <div key={root.id}>
                <div className="tree__row tree__row--root">
                  <button
                    type="button"
                    className="tree__caret"
                    onClick={() => toggle(root.id)}
                    aria-expanded={expanded.has(root.id)}
                    aria-label={`${expanded.has(root.id) ? '收起' : '展开'}目录 ${root.name}`}
                  >
                    {expanded.has(root.id) ? '▾' : '▸'}
                  </button>
                  <span className="tree__icon" aria-hidden="true">▣</span>
                  {renaming?.id === root.id ? (
                    <RenameInline
                      value={renaming.name}
                      busy={busy}
                      onChange={(v) => setRenaming({ id: root.id, name: v })}
                      onSave={saveRename}
                      onCancel={() => setRenaming(null)}
                    />
                  ) : (
                    <>
                      <span className="tree__name strong">{root.name}</span>
                      <span className="tree__count mono">{root.count}</span>
                      {canManage && (
                        <span className="tree__ops">
                          <button type="button" className="tree__op" onClick={() => setRenaming({ id: root.id, name: root.name })}>
                            重命名
                          </button>
                          <button type="button" className="tree__op tree__op--danger" onClick={() => setDeleting({ id: root.id, name: root.name })}>
                            删除
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </div>

                {expanded.has(root.id) &&
                  root.children.map((child) => (
                    <div key={child.id}>
                      <div className={`tree__row tree__row--child${chapterId === child.id ? ' tree__row--active' : ''}`}>
                        <button
                          type="button"
                          className="tree__caret"
                          onClick={() => toggle(child.id)}
                          aria-expanded={expanded.has(child.id)}
                          aria-label={`${expanded.has(child.id) ? '收起' : '展开'}章节 ${child.name}`}
                        >
                          {child.entries.length > 0 ? (expanded.has(child.id) ? '▾' : '▸') : '·'}
                        </button>
                        {renaming?.id === child.id ? (
                          <RenameInline
                            value={renaming.name}
                            busy={busy}
                            onChange={(v) => setRenaming({ id: child.id, name: v })}
                            onSave={saveRename}
                            onCancel={() => setRenaming(null)}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              className="tree__name tree__name--btn"
                              onClick={() => setChapterId(chapterId === child.id ? '' : child.id)}
                              aria-pressed={chapterId === child.id}
                              title={`按章节「${child.name}」筛选条目列表`}
                            >
                              {child.name}
                            </button>
                            <span className="tree__ref">{child.sectionRef ? `Zendesk ${child.sectionRef}` : 'Section 未映射'}</span>
                            <span className="tree__count mono">{child.count}</span>
                            {canManage && (
                              <span className="tree__ops">
                                <button type="button" className="tree__op" onClick={() => setRenaming({ id: child.id, name: child.name })}>
                                  重命名
                                </button>
                                <button type="button" className="tree__op" onClick={() => setMoving({ id: child.id, name: child.name })}>
                                  移动
                                </button>
                                <button type="button" className="tree__op tree__op--danger" onClick={() => setDeleting({ id: child.id, name: child.name })}>
                                  删除
                                </button>
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {expanded.has(child.id) &&
                        child.entries.map((leaf) => (
                          <button
                            key={leaf.id}
                            type="button"
                            className="tree__row tree__row--leaf"
                            onClick={() => goto('entry', leaf.id)}
                            title={`${leaf.code} ${leaf.title}`}
                          >
                            <span className="tree__icon" aria-hidden="true">▤</span>
                            <span className="tree__name tree__name--clip">{leaf.title}</span>
                          </button>
                        ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>

          <div className="note" style={{ marginTop: 12 }}>{zhCN.sync.mappingNote}</div>
          {canManage && (
            <div className="note" style={{ marginTop: 8 }}>
              含条目或子章节的章节不可直接删除——请先把条目移到其他章节（防孤儿条目）。结构变更即时生效并留痕，同步中心按映射更新 Zendesk 结构。
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <h2 className="card__title">
          条目列表{currentLib ? ` · ${currentLib.name}（共 ${currentLib.count} 条）` : ''}
        </h2>
        {selectedChapter && (
          <div className="note" style={{ marginBottom: 12 }}>
            已按章节「{selectedChapter.name}」筛选（{rows.length} 条）
            <button type="button" className="btn btn--sm" style={{ marginLeft: 8 }} onClick={() => setChapterId('')}>清除章节筛选</button>
          </div>
        )}
        <div className="filters">
          <input
            className="input"
            style={{ minWidth: 260 }}
            type="search"
            placeholder="搜索标题 / 标识 / 标签…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="搜索条目"
          />
          <select className="select" value={scene} onChange={(e) => setScene(e.target.value)} aria-label="问题场景筛选">
            <option value="">问题场景：全部</option>
            {sceneOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="状态筛选">
            <option value="">状态：全部</option>
            {ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>{L.entryStatus(s)}</option>
            ))}
          </select>
          <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="可见性筛选">
            <option value="">可见性：全部</option>
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>{L.visibility(v)}</option>
            ))}
          </select>
          <select className="select" value={due} onChange={(e) => setDue(e.target.value as DueFilter)} aria-label="复核到期筛选">
            {DUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {entries.loading && <div className="empty">加载中…</div>}
        {!entries.loading && rows.length === 0 && <div className="empty">没有符合筛选条件的条目——放宽筛选或换个知识库</div>}
        {!entries.loading && rows.length > 0 && (
          <div className="table-scroll">
            <table className="table--wide">
              <thead>
                <tr>
                  <th>标识</th>
                  <th>标题</th>
                  <th>路径</th>
                  <th>类型</th>
                  <th>可见性</th>
                  <th>版本</th>
                  <th>状态</th>
                  <th>英文</th>
                  <th>同步</th>
                  <th>解决率</th>
                  <th>复核到期</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`row--click${r.reviewDueLevel === 'bad' ? ' row--alert' : r.reviewDueLevel === 'warn' ? ' row--warn' : ''}`}
                    onClick={() => goto('entry', r.id)}
                    data-code={r.code}
                  >
                    <td className="mono">{r.code}</td>
                    <td>
                      <div className="strong">{r.title}</div>
                      <div className="meta">{r.sceneL1} · {r.sceneL2}</div>
                    </td>
                    <td className="meta">{r.path}</td>
                    <td>{r.entryType}</td>
                    <td>{L.visibility(r.visibility)}</td>
                    <td className="mono">{r.versionLabel}</td>
                    <td><StatusPill kind={entryStatusKind(r.status)} text={L.entryStatus(r.status)} /></td>
                    <td><StatusPill kind={enStatusKind(r.enStatus)} text={L.enStatus(r.enStatus)} /></td>
                    <td><StatusPill kind={syncStatusKind(r.syncStatus)} text={L.syncStatus(r.syncStatus)} /></td>
                    <td>
                      {r.sampleShort || r.solveRate === null ? (
                        <StatusPill kind="info" text={zhCN.dash.sampleShort} />
                      ) : r.solveRate < TUNABLES.lowSolveRatePct ? (
                        <StatusPill kind="bad" text={`${r.solveRate}%`} />
                      ) : (
                        <span className="mono">{r.solveRate}%</span>
                      )}
                    </td>
                    <td className="meta">{dueText(r.reviewDueAt, r.reviewDueLevel)}</td>
                    <td className="meta">{fmtTime(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="note" style={{ marginTop: 12 }}>
          点任意行进入条目工作台。列表只呈现最新状态，历史全部落在版本与日志里。
        </div>
      </div>

      {creating && (
        <ConfirmModal
          title={creating.parentId === null ? '新建目录' : '新建章节'}
          confirmText="创建"
          onCancel={() => setCreating(null)}
          onConfirm={() => void createChapter()}
        >
          <div className="field" style={{ marginTop: 12 }}>
            <label className="field__label" htmlFor="ch-parent">父目录</label>
            <select id="ch-parent" className="select" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
              <option value="">（作为顶级目录）</option>
              {(tree.data ?? []).map((root) => (
                <option key={root.id} value={root.id}>{root.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ch-name">名称</label>
            <input id="ch-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="chapter-name" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ch-sec">Zendesk Section 映射（选填，如 Sec 5101）</label>
            <input id="ch-sec" className="input" value={newSectionRef} onChange={(e) => setNewSectionRef(e.target.value)} />
          </div>
        </ConfirmModal>
      )}

      {moving && (
        <ConfirmModal
          title={moving.id ? `调整层级 · 移动章节「${moving.name}」` : '调整层级'}
          confirmText="移动"
          onCancel={() => { setMoving(null); setMoveTarget(''); }}
          onConfirm={() => void moveChapter()}
          consequences={['结构深度恒为 2：章节只能挂在顶级目录下，不支持目录与章节互转', '移动即时生效并写操作日志，同步中心按映射更新 Zendesk 结构']}
        >
          <div className="field" style={{ marginTop: 12 }}>
            <label className="field__label" htmlFor="mv-chapter">要移动的章节</label>
            <select
              id="mv-chapter"
              className="select"
              value={moving.id}
              onChange={(e) => {
                const c = allChapters.find((x) => x.id === e.target.value);
                setMoving({ id: e.target.value, name: c?.name ?? '' });
              }}
              data-testid="move-chapter"
            >
              <option value="">（请选择章节）</option>
              {allChapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="mv-target">移动到目录</label>
            <select id="mv-target" className="select" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} data-testid="move-target">
              <option value="">（请选择目标目录）</option>
              {(tree.data ?? []).map((root) => (
                <option key={root.id} value={root.id}>{root.name}</option>
              ))}
            </select>
          </div>
        </ConfirmModal>
      )}

      {importing && currentLib && (
        <ImportPanel
          libraryId={currentLib.id}
          libraryName={currentLib.name}
          chapters={chapterOptions}
          onClose={() => setImporting(false)}
          onDone={() => { entries.reload(); tree.reload(); }}
        />
      )}

      {deleting && (
        <ConfirmModal
          danger
          title={`删除章节「${deleting.name}」`}
          consequences={[
            '章节从结构树移除，后续条目不可再挂到该章节',
            '含条目或子章节的章节会被拦截——需先移空后再删除',
            '删除动作写入操作日志，可在操作日志视图追溯',
          ]}
          confirmText="确认删除"
          onConfirm={removeChapter}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** 结构树行内重命名：只在被重命名的那一行出现，不常驻挤压行宽 */
function RenameInline({
  value, busy, onChange, onSave, onCancel,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <input
        className="input tree__rename"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="章节名称"
        autoFocus
      />
      <button type="button" className="tree__op" disabled={busy} onClick={onSave}>保存</button>
      <button type="button" className="tree__op" onClick={onCancel}>取消</button>
    </>
  );
}
