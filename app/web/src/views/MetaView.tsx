import { useEffect, useState } from 'react';
import { api } from '../api';
import { ConfirmModal, useApp, useAsync } from '../shared';

interface SceneNode {
  id: string;
  name: string;
  refs: number;
  children: Array<{ id: string; name: string; refs: number }>;
}

interface DeviceModel {
  id: string;
  name: string;
  sort_order: number;
}

interface TagAgg {
  name: string;
  refs: number;
}

/** 元数据管理（视图⑪ · 08-05-2026 元数据字典化）：场景字典 / 型号字典 / 标签聚合 */
export function MetaView() {
  const { can, toast } = useApp();
  const canManage = can('structure.manage');

  const scenes = useAsync<SceneNode[]>(() => api.get<SceneNode[]>('/api/meta/scenes'), []);
  const models = useAsync<DeviceModel[]>(() => api.get<DeviceModel[]>('/api/meta/models'), []);
  const tags = useAsync<TagAgg[]>(() => api.get<TagAgg[]>('/api/meta/tags'), []);

  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneForm, setSceneForm] = useState<{ name: string; parentId: string } | null>(null);
  const [sceneRename, setSceneRename] = useState<{ id: string; name: string } | null>(null);
  const [sceneDelete, setSceneDelete] = useState<{ id: string; name: string; refs: number } | null>(null);

  const [modelBusy, setModelBusy] = useState(false);
  const [modelForm, setModelForm] = useState<{ name: string } | null>(null);
  const [modelDelete, setModelDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const err = scenes.error ?? models.error ?? tags.error;
    if (err) toast(err);
  }, [scenes.error, models.error, tags.error, toast]);

  async function createScene(): Promise<void> {
    if (!sceneForm || sceneBusy) return;
    if (!sceneForm.name.trim()) {
      toast('场景名称必填');
      return;
    }
    setSceneBusy(true);
    try {
      await api.post<{ id: string }>('/api/meta/scenes', {
        name: sceneForm.name.trim(),
        parentId: sceneForm.parentId || null,
      });
      toast(`场景「${sceneForm.name.trim()}」已创建`);
      setSceneForm(null);
      scenes.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSceneBusy(false);
    }
  }

  async function renameScene(): Promise<void> {
    if (!sceneRename || sceneBusy) return;
    const name = sceneRename.name.trim();
    if (!name) {
      toast('场景名称必填');
      return;
    }
    setSceneBusy(true);
    try {
      await api.put<{ ok: boolean }>(`/api/meta/scenes/${sceneRename.id}`, { name });
      toast(`场景已重命名为「${name}」`);
      setSceneRename(null);
      scenes.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSceneBusy(false);
    }
  }

  async function removeScene(): Promise<void> {
    if (!sceneDelete) return;
    const target = sceneDelete;
    setSceneDelete(null);
    try {
      await api.del<{ ok: boolean }>(`/api/meta/scenes/${target.id}`);
      toast(`场景「${target.name}」已删除`);
      scenes.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function createModel(): Promise<void> {
    if (!modelForm || modelBusy) return;
    if (!modelForm.name.trim()) {
      toast('型号名称必填');
      return;
    }
    setModelBusy(true);
    try {
      await api.post<{ id: string }>('/api/meta/models', { name: modelForm.name.trim() });
      toast(`型号「${modelForm.name.trim()}」已创建`);
      setModelForm(null);
      models.reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setModelBusy(false);
    }
  }

  async function removeModel(): Promise<void> {
    if (!modelDelete) return;
    const target = modelDelete;
    setModelDelete(null);
    try {
      await api.del<{ ok: boolean }>(`/api/meta/models/${target.id}`);
      toast(`型号「${target.name}」已删除`);
      models.reload();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }}>
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="card__title" style={{ margin: 0 }}>问题场景字典</h2>
          {canManage && (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => setSceneForm({ name: '', parentId: '' })}>
              新建一级场景
            </button>
          )}
        </div>
        <div className="meta note" style={{ marginBottom: 12 }}>
          条目「问题场景」选项全部来自本字典（两级：一级 → 二级，条目引用二级）。被条目引用的场景不可删除——先改引用再删。
        </div>
        {scenes.loading && <div className="empty">加载中…</div>}
        {!scenes.loading && (scenes.data ?? []).length === 0 && <div className="empty">还没有场景——请先新建一级场景</div>}
        <div className="tree">
          {(scenes.data ?? []).map((root) => (
            <div key={root.id}>
              <div className="tree__row tree__row--root">
                <span className="tree__icon" aria-hidden="true">▣</span>
                {sceneRename?.id === root.id ? (
                  <>
                    <input
                      className="input tree__rename"
                      value={sceneRename.name}
                      autoFocus
                      onChange={(e) => setSceneRename({ id: root.id, name: e.target.value })}
                      aria-label="场景名称"
                    />
                    <button type="button" className="tree__op" disabled={sceneBusy} onClick={() => void renameScene()}>保存</button>
                    <button type="button" className="tree__op" onClick={() => setSceneRename(null)}>取消</button>
                  </>
                ) : (
                  <>
                    <span className="tree__name strong">{root.name}</span>
                    <span className="tree__count mono">{root.children.length} 二级</span>
                    {canManage && (
                      <span className="tree__ops">
                        <button type="button" className="tree__op" onClick={() => setSceneRename({ id: root.id, name: root.name })}>重命名</button>
                        <button type="button" className="tree__op" onClick={() => setSceneForm({ name: '', parentId: root.id })}>加二级</button>
                        <button type="button" className="tree__op tree__op--danger" onClick={() => setSceneDelete({ id: root.id, name: root.name, refs: root.refs })}>删除</button>
                      </span>
                    )}
                  </>
                )}
              </div>
              {root.children.map((c) => (
                <div key={c.id} className="tree__row tree__row--child">
                  <span className="tree__icon" aria-hidden="true">▸</span>
                  {sceneRename?.id === c.id ? (
                    <>
                      <input
                        className="input tree__rename"
                        value={sceneRename.name}
                        autoFocus
                        onChange={(e) => setSceneRename({ id: c.id, name: e.target.value })}
                        aria-label="场景名称"
                      />
                      <button type="button" className="tree__op" disabled={sceneBusy} onClick={() => void renameScene()}>保存</button>
                      <button type="button" className="tree__op" onClick={() => setSceneRename(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <span className="tree__name">{c.name}</span>
                      <span className="tree__count mono">{c.refs > 0 ? `${c.refs} 条引用` : ''}</span>
                      {canManage && (
                        <span className="tree__ops">
                          <button type="button" className="tree__op" onClick={() => setSceneRename({ id: c.id, name: c.name })}>重命名</button>
                          <button type="button" className="tree__op tree__op--danger" onClick={() => setSceneDelete({ id: c.id, name: c.name, refs: c.refs })}>删除</button>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="card__title" style={{ margin: 0 }}>适用型号字典</h2>
          {canManage && (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => setModelForm({ name: '' })}>
              新建型号
            </button>
          )}
        </div>
        <div className="meta note" style={{ marginBottom: 12 }}>
          型号只服务本台条目元数据（Zendesk 无对应对象，不同步）。条目「适用型号」按条目类型显隐：操作流程型/FAQ 型显示，政策型/内部口径不显示；空 = 全型号。
        </div>
        {models.loading && <div className="empty">加载中…</div>}
        {!models.loading && (models.data ?? []).length === 0 && <div className="empty">还没有型号——请先新建型号</div>}
        {(models.data ?? []).map((m) => (
          <div key={m.id} className="tree__row" style={{ paddingLeft: 0 }}>
            <span className="tree__name">{m.name}</span>
            {canManage && (
              <span className="tree__ops">
                <button type="button" className="tree__op tree__op--danger" onClick={() => setModelDelete({ id: m.id, name: m.name })}>删除</button>
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h2 className="card__title" style={{ margin: 0 }}>标签池（只读）</h2>
        <div className="meta note" style={{ margin: '12px 0' }}>
          全库标签聚合，供条目编辑器搜索建议与治理决策使用。标签治理（同义归并/重命名/90 天零命中冷却清理）登记为后续版本。
        </div>
        {tags.loading && <div className="empty">加载中…</div>}
        {!tags.loading && (tags.data ?? []).length === 0 && <div className="empty">还没有标签——标签随条目录入产生</div>}
        {(tags.data ?? []).length > 0 && (
          <div className="flex-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(tags.data ?? []).map((t) => (
              <span key={t.name} className="pill pill--info">
                {t.name} · {t.refs} 条
              </span>
            ))}
          </div>
        )}
      </div>

      {sceneForm && (
        <ConfirmModal
          title={sceneForm.parentId ? '新建二级场景' : '新建一级场景'}
          confirmText="创建"
          onCancel={() => setSceneForm(null)}
          onConfirm={() => void createScene()}
        >
          {sceneForm.parentId && (
            <div className="meta note" style={{ margin: '12px 0' }}>
              将挂到一级场景下，条目只能引用二级场景。
            </div>
          )}
          <div className="field">
            <label className="field__label" htmlFor="sc-name">场景名称</label>
            <input
              id="sc-name"
              className="input"
              value={sceneForm.name}
              autoFocus
              onChange={(e) => setSceneForm({ ...sceneForm, name: e.target.value })}
              placeholder="如：退款时限 / Wi-Fi 配对"
            />
          </div>
        </ConfirmModal>
      )}

      {modelForm && (
        <ConfirmModal
          title="新建型号"
          confirmText="创建"
          onCancel={() => setModelForm(null)}
          onConfirm={() => void createModel()}
        >
          <div className="field">
            <label className="field__label" htmlFor="mdl-name">型号名称</label>
            <input
              id="mdl-name"
              className="input"
              value={modelForm.name}
              autoFocus
              onChange={(e) => setModelForm({ name: e.target.value })}
              placeholder="如：A1 Pro"
            />
          </div>
        </ConfirmModal>
      )}

      {sceneDelete && (
        <ConfirmModal
          danger
          title={`删除场景「${sceneDelete.name}」`}
          consequences={[
            sceneDelete.refs > 0 ? `该场景被 ${sceneDelete.refs} 条条目引用——删除会被拦截` : '当前无条目引用，可删除',
            '删除动作写入操作日志',
          ]}
          confirmText="确认删除"
          onConfirm={removeScene}
          onCancel={() => setSceneDelete(null)}
        />
      )}

      {modelDelete && (
        <ConfirmModal
          danger
          title={`删除型号「${modelDelete.name}」`}
          consequences={['删除动作写入操作日志', '引用该型号的条目会阻止删除']}
          confirmText="确认删除"
          onConfirm={removeModel}
          onCancel={() => setModelDelete(null)}
        />
      )}
    </div>
  );
}
