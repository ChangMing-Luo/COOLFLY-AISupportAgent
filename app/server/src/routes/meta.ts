import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, newId } from '../db/pool.js';
import { requireLogin } from '../core/auth.js';
import { requirePermission } from '../core/rbac.js';
import { writeAudit } from '../core/audit.js';
import { DomainError } from '../services/entries.js';

/**
 * 元数据管理（视图⑪ · 08-05-2026 元数据字典化）：
 * 场景字典（两级树，条目引用二级 id）/ 型号字典 / 标签聚合（只读）。
 * 写操作 = structure.manage（知识管理员/系统管理员）；读取登录即可。
 */

const sceneUpsertSchema = z.object({
  name: z.string().trim().min(1, '场景名称必填').max(20, '场景名称最长 20 字'),
  parentId: z.string().nullable().default(null),
});

const modelUpsertSchema = z.object({
  name: z.string().trim().min(1, '型号名称必填').max(40, '型号名称最长 40 字'),
});

/** 场景被条目引用数（删除防护：先改引用再删） */
async function sceneRefCount(id: string): Promise<number> {
  const { rows } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM entries WHERE scene_id = $1', [id]);
  return Number(rows[0]?.n ?? 0);
}

/** 型号被条目引用数 */
async function modelRefCount(id: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM entries WHERE device_models @> $1::jsonb",
    [JSON.stringify([id])],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function registerMetaRoutes(app: FastifyInstance): Promise<void> {
  // ---------- 场景字典 ----------

  // 场景树（含引用计数；一级行带子场景数）
  app.get('/api/meta/scenes', { preHandler: requireLogin }, async () => {
    const { rows } = await query<{ id: string; name: string; parent_id: string | null; sort_order: number }>(
      'SELECT id, name, parent_id, sort_order FROM scenes ORDER BY sort_order, id',
    );
    const { rows: refs } = await query<{ scene_id: string; n: string }>(
      'SELECT scene_id, COUNT(*)::text AS n FROM entries WHERE scene_id IS NOT NULL GROUP BY scene_id',
    );
    const refMap = new Map(refs.map((r) => [r.scene_id, Number(r.n)]));
    const roots = rows
      .filter((r) => r.parent_id === null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        refs: refMap.get(r.id) ?? 0,
        children: rows
          .filter((c) => c.parent_id === r.id)
          .map((c) => ({ id: c.id, name: c.name, refs: refMap.get(c.id) ?? 0 })),
      }));
    return roots;
  });

  app.post('/api/meta/scenes', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const input = sceneUpsertSchema.parse(req.body);
    const id = newId('scn');
    if (input.parentId) {
      const { rows } = await query<{ parent_id: string | null }>('SELECT parent_id FROM scenes WHERE id = $1', [input.parentId]);
      if (!rows[0]) throw new DomainError('父级场景不存在', 404);
      if (rows[0].parent_id) throw new DomainError('场景深度恒为 2——二级场景只能挂在一级场景下', 409);
    }
    const { rows: sortRows } = await query<{ m: string | null }>(
      'SELECT MAX(sort_order)::text AS m FROM scenes WHERE parent_id IS NOT DISTINCT FROM $1',
      [input.parentId],
    );
    const sortOrder = Number(sortRows[0]?.m ?? 0) + 1;
    await query('INSERT INTO scenes (id, name, parent_id, sort_order) VALUES ($1,$2,$3,$4)', [
      id, input.name, input.parentId, sortOrder,
    ]);
    await writeAudit(req.currentUser!, {
      objectType: 'scene', objectId: id, objectLabel: input.name,
      action: input.parentId ? '新建二级场景' : '新建一级场景', category: 'content', field: '场景',
      before: '—', after: input.name, note: input.parentId ? `挂一级场景 ${input.parentId}` : '顶级一级场景',
    });
    return { id };
  });

  app.put('/api/meta/scenes/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const input = sceneUpsertSchema.parse(req.body);
    const { rows } = await query<{ name: string }>('SELECT name FROM scenes WHERE id = $1', [id]);
    if (!rows[0]) throw new DomainError('场景不存在', 404);
    await query('UPDATE scenes SET name = $2 WHERE id = $1', [id, input.name]);
    await writeAudit(req.currentUser!, {
      objectType: 'scene', objectId: id, objectLabel: input.name,
      action: '重命名场景', category: 'content', field: '名称', before: rows[0].name, after: input.name, note: '元数据字典维护',
    });
    return { ok: true };
  });

  app.delete('/api/meta/scenes/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await query<{ name: string; parent_id: string | null }>('SELECT name, parent_id FROM scenes WHERE id = $1', [id]);
    const scene = rows[0];
    if (!scene) throw new DomainError('场景不存在', 404);
    const refs = await sceneRefCount(id);
    if (refs > 0) throw new DomainError(`该场景被 ${refs} 条条目引用——请先在这些条目上改选其他场景后再删除`, 409);
    if (scene.parent_id === null) {
      const { rows: children } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM scenes WHERE parent_id = $1', [id]);
      const n = Number(children[0]?.n ?? 0);
      if (n > 0) throw new DomainError(`该一级场景下仍有 ${n} 个二级场景——请先删除二级场景后再删除`, 409);
    }
    await query('DELETE FROM scenes WHERE id = $1', [id]);
    await writeAudit(req.currentUser!, {
      objectType: 'scene', objectId: id, objectLabel: scene.name,
      action: '删除场景', category: 'content', field: '场景', before: scene.name, after: '—', note: '元数据字典维护',
    });
    return { ok: true };
  });

  // ---------- 型号字典 ----------

  app.get('/api/meta/models', { preHandler: requireLogin }, async () => {
    const { rows } = await query<{ id: string; name: string; sort_order: number }>(
      'SELECT id, name, sort_order FROM device_models ORDER BY sort_order, id',
    );
    return rows;
  });

  app.post('/api/meta/models', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const input = modelUpsertSchema.parse(req.body);
    const id = newId('mdl');
    await query('INSERT INTO device_models (id, name, sort_order) VALUES ($1,$2,$3)', [id, input.name, 0]);
    await writeAudit(req.currentUser!, {
      objectType: 'device_model', objectId: id, objectLabel: input.name,
      action: '新建型号', category: 'content', field: '型号', before: '—', after: input.name, note: '元数据字典维护',
    });
    return { id };
  });

  app.put('/api/meta/models/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const input = modelUpsertSchema.parse(req.body);
    const { rows } = await query<{ name: string }>('SELECT name FROM device_models WHERE id = $1', [id]);
    if (!rows[0]) throw new DomainError('型号不存在', 404);
    await query('UPDATE device_models SET name = $2 WHERE id = $1', [id, input.name]);
    await writeAudit(req.currentUser!, {
      objectType: 'device_model', objectId: id, objectLabel: input.name,
      action: '重命名型号', category: 'content', field: '型号', before: rows[0].name, after: input.name, note: '元数据字典维护',
    });
    return { ok: true };
  });

  app.delete('/api/meta/models/:id', { preHandler: [requireLogin, requirePermission('structure.manage')] }, async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await query<{ name: string }>('SELECT name FROM device_models WHERE id = $1', [id]);
    if (!rows[0]) throw new DomainError('型号不存在', 404);
    const refs = await modelRefCount(id);
    if (refs > 0) throw new DomainError(`该型号被 ${refs} 条条目引用——请先在这些条目上移除该型号后再删除`, 409);
    await query('DELETE FROM device_models WHERE id = $1', [id]);
    await writeAudit(req.currentUser!, {
      objectType: 'device_model', objectId: id, objectLabel: rows[0].name,
      action: '删除型号', category: 'content', field: '型号', before: rows[0].name, after: '—', note: '元数据字典维护',
    });
    return { ok: true };
  });

  // ---------- 标签聚合（只读：标签池 + 引用计数，供编辑器搜索建议与治理决策） ----------

  app.get('/api/meta/tags', { preHandler: requireLogin }, async () => {
    const { rows } = await query<{ label: string; n: string }>(
      `SELECT label, COUNT(*)::text AS n
       FROM entries, jsonb_array_elements_text(labels) AS label
       GROUP BY label ORDER BY n DESC, label`,
    );
    return rows.map((r) => ({ name: r.label, refs: Number(r.n) }));
  });
}
