import type { SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { getZendesk } from '../integrations/zendesk.js';
import { writeAudit, SYSTEM_ACTOR, type AuditActor } from '../core/audit.js';
import { contentHash, toPlainText } from '../core/content.js';
import { DomainError, findEntry, actorOf, type EntryRow } from './entries.js';

/** 报文号自增：与审计一样只增不改，用于「同步日志」页的可追溯列 */
async function nextPayloadNo(): Promise<string> {
  const { rows } = await query<{ n: string }>('SELECT COUNT(*)::text AS n FROM sync_logs');
  return `#${88210 + Number(rows[0].n)}`;
}

export async function logSync(args: {
  entryId: string | null;
  entryCode: string;
  objectLabel: string;
  result: '成功' | '失败';
  message: string;
  durationMs: number;
  actorName: string;
  action?: string;
  target?: string;
  payload?: string;
}): Promise<void> {
  await query(
    `INSERT INTO sync_logs (id, entry_id, entry_code, object_label, result, message, duration_ms, payload_no, actor_name, action, payload, target)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      newId('slog'),
      args.entryId,
      args.entryCode,
      args.objectLabel,
      args.result,
      args.message,
      args.durationMs,
      await nextPayloadNo(),
      args.actorName,
      args.action ?? 'upsert',
      args.payload ?? '',
      args.target ?? 'Help Center',
    ],
  );
}

/* ══════════ 结构同步：分类 → Category、场景 → Section ══════════
 * 层级严格三层：分类 = Category，场景 = Section（挂在分类的 Category 下），条目 = Article（挂在场景的 Section 下）。
 * 保存分类/场景时**立即**同步 Zendesk 并留痕，不再等到发布时才懒创建——
 * 否则界面提示「将同步至 Zendesk 目录」而 Zendesk 侧毫无动静。
 */

export interface StructureSyncResult {
  ok: boolean;
  ref: string | null;
  action: '创建' | '更新' | '跳过';
  message: string;
}

/** 分类 → Zendesk Category（无 ref 则建，有 ref 且英文名变了则改名） */
export async function syncCategory(
  actor: AuditActor,
  categoryId: string,
): Promise<StructureSyncResult> {
  const { rows } = await query<{
    code: string;
    name_zh: string;
    name_en: string;
    zendesk_category_ref: string | null;
  }>('SELECT code, name_zh, name_en, zendesk_category_ref FROM categories WHERE id=$1', [categoryId]);
  const c = rows[0];
  if (!c) throw new DomainError('分类不存在', 404);
  const name = (c.name_en || c.name_zh).trim();
  const started = Date.now();
  const zd = getZendesk();
  try {
    let ref = c.zendesk_category_ref;
    let action: StructureSyncResult['action'];
    if (ref) {
      await zd.renameCategory(ref, name);
      action = '更新';
    } else {
      ref = (await zd.createCategory(name)).id;
      await query('UPDATE categories SET zendesk_category_ref=$2, updated_at=now() WHERE id=$1', [categoryId, ref]);
      action = '创建';
    }
    await logSync({
      entryId: null,
      entryCode: c.code,
      objectLabel: `${c.name_zh} → Zendesk 目录（Category）`,
      result: '成功',
      message: `${action} Category ${ref}「${name}」`,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'category',
      target: 'Category',
      payload: JSON.stringify({ categoryRef: ref, name }),
    });
    return { ok: true, ref, action, message: `已${action} Zendesk 目录「${name}」` };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await logSync({
      entryId: null,
      entryCode: c.code,
      objectLabel: `${c.name_zh} → Zendesk 目录（Category）`,
      result: '失败',
      message,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'category',
      target: 'Category',
    });
    return { ok: false, ref: c.zendesk_category_ref, action: '跳过', message };
  }
}

/** 场景 → Zendesk Section（父分类没有 Category 时先建父级，保证层级不错位） */
export async function syncScene(actor: AuditActor, sceneId: string): Promise<StructureSyncResult> {
  const { rows } = await query<{
    code: string;
    name_zh: string;
    name_en: string;
    zendesk_section_ref: string | null;
    category_id: string;
    cat_ref: string | null;
  }>(
    `SELECT s.code, s.name_zh, s.name_en, s.zendesk_section_ref, s.category_id, c.zendesk_category_ref AS cat_ref
     FROM scenes s JOIN categories c ON c.id = s.category_id WHERE s.id=$1`,
    [sceneId],
  );
  const s = rows[0];
  if (!s) throw new DomainError('场景不存在', 404);
  const name = (s.name_en || s.name_zh).trim();
  const started = Date.now();
  const zd = getZendesk();
  try {
    let catRef = s.cat_ref;
    if (!catRef) {
      const r = await syncCategory(actor, s.category_id);
      if (!r.ok || !r.ref) throw new Error(`父分类未能同步：${r.message}`);
      catRef = r.ref;
    }
    let ref = s.zendesk_section_ref;
    let action: StructureSyncResult['action'];
    if (ref) {
      await zd.renameSection(ref, name);
      await zd.moveSection(ref, catRef);
      action = '更新';
    } else {
      ref = (await zd.createSection(catRef, name)).id;
      await query('UPDATE scenes SET zendesk_section_ref=$2, updated_at=now() WHERE id=$1', [sceneId, ref]);
      action = '创建';
    }
    await logSync({
      entryId: null,
      entryCode: s.code,
      objectLabel: `${s.name_zh} → Zendesk 目录（Section）`,
      result: '成功',
      message: `${action} Section ${ref}「${name}」，挂在 Category ${catRef} 下`,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'section',
      target: 'Section',
      payload: JSON.stringify({ sectionRef: ref, categoryRef: catRef, name }),
    });
    return { ok: true, ref, action, message: `已${action} Zendesk 目录「${name}」` };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await logSync({
      entryId: null,
      entryCode: s.code,
      objectLabel: `${s.name_zh} → Zendesk 目录（Section）`,
      result: '失败',
      message,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'section',
      target: 'Section',
    });
    return { ok: false, ref: s.zendesk_section_ref, action: '跳过', message };
  }
}

/**
 * 场景 → Zendesk Section 的兜底：发布时若场景仍无 Section 就现建。
 * 正常路径已在保存分类/场景时同步过，这里只是最后一道保险。
 */
export async function ensureSectionRef(sceneId: string): Promise<string> {
  const { rows } = await query<{
    scene_ref: string | null;
    scene_name_en: string;
    scene_name_zh: string;
    category_id: string;
    cat_ref: string | null;
    cat_name_en: string;
    cat_name_zh: string;
  }>(
    `SELECT s.zendesk_section_ref AS scene_ref, s.name_en AS scene_name_en, s.name_zh AS scene_name_zh,
            c.id AS category_id, c.zendesk_category_ref AS cat_ref, c.name_en AS cat_name_en, c.name_zh AS cat_name_zh
     FROM scenes s JOIN categories c ON c.id = s.category_id WHERE s.id = $1`,
    [sceneId],
  );
  const s = rows[0];
  if (!s) throw new DomainError('问题场景不存在，无法定位 Zendesk 目录。', 400);
  if (s.scene_ref) return s.scene_ref;

  const zd = getZendesk();
  let catRef = s.cat_ref;
  if (!catRef) {
    const created = await zd.createCategory(s.cat_name_en || s.cat_name_zh);
    catRef = created.id;
    await query('UPDATE categories SET zendesk_category_ref=$2, updated_at=now() WHERE id=$1', [
      s.category_id,
      catRef,
    ]);
  }
  const section = await zd.createSection(catRef, s.scene_name_en || s.scene_name_zh);
  await query('UPDATE scenes SET zendesk_section_ref=$2, updated_at=now() WHERE id=$1', [sceneId, section.id]);
  return section.id;
}

/**
 * 把条目的英文版本写入 Zendesk。发布与「重新下发 / 重试」共用这一条路径。
 * 成功 → sync_status=synced；失败 → failed + 失败原因（界面如实显示，可重试）。
 */
export async function pushEntry(
  actor: AuditActor,
  code: string,
): Promise<{ ok: boolean; message: string }> {
  const entry = await findEntry(code);
  await query(`UPDATE entries SET sync_status='pending', sync_fail_reason=NULL WHERE code=$1`, [code]);

  const started = Date.now();
  try {
    if (!entry.scene_id) throw new Error('未选择问题场景，无法定位 Zendesk 目录');
    if (!entry.title_en.trim() || !entry.body_en.trim()) {
      throw new Error('英文版本缺失——Zendesk 写入语言为英文，请先完成翻译');
    }
    const sectionRef = await ensureSectionRef(entry.scene_id);
    const { rows: mapRows } = await query<{ zendesk_article_ref: string | null }>(
      'SELECT zendesk_article_ref FROM sync_mappings WHERE entry_id=$1',
      [entry.id],
    );
    const articleRef = mapRows[0]?.zendesk_article_ref ?? null;

    // 写入语言 = English（原型「写入语言：English」；帮助中心默认 en-us、原有文章皆 en-us）。
    // 中文正文留在中台作为唯一事实来源，不推 Zendesk。
    const article = await getZendesk().upsertArticle({
      entryCode: entry.code,
      title: entry.title_en,
      publicHtml: entry.body_en,
      labels: entry.tags ?? [],
      sectionRef,
      internalOnly: false,
      articleRef,
    });

    const duration = Date.now() - started;
    await query(
      `INSERT INTO sync_mappings (entry_id, zendesk_article_ref, published_hash, updated_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (entry_id) DO UPDATE SET zendesk_article_ref=EXCLUDED.zendesk_article_ref,
                                            published_hash=EXCLUDED.published_hash, updated_at=now()`,
      [entry.id, article.id, contentHash(toPlainText(entry.body_en))],
    );
    await query(`UPDATE entries SET sync_status='synced', sync_fail_reason=NULL WHERE code=$1`, [code]);
    await logSync({
      entryId: entry.id,
      entryCode: entry.code,
      objectLabel: `${entry.code} 英文版本（成功）`,
      result: '成功',
      message: `article ${article.id} · section ${sectionRef}`,
      durationMs: duration,
      actorName: actor.name,
      payload: JSON.stringify({ articleId: article.id, sectionRef, locale: 'en-us' }),
    });
    await writeAudit(SYSTEM_ACTOR, {
      action: 'Zendesk 同步',
      objectCode: entry.code,
      objectLabel: `${entry.code} 英文版本（成功）`,
      version: entry.version,
    });
    return { ok: true, message: '已同步' };
  } catch (err) {
    const duration = Date.now() - started;
    const message = err instanceof Error ? err.message : '未知错误';
    await query(`UPDATE entries SET sync_status='failed', sync_fail_reason=$2 WHERE code=$1`, [code, message]);
    await logSync({
      entryId: entry.id,
      entryCode: entry.code,
      objectLabel: `${entry.code} 英文版本（失败）`,
      result: '失败',
      message,
      durationMs: duration,
      actorName: actor.name,
    });
    await writeAudit(SYSTEM_ACTOR, {
      action: 'Zendesk 同步',
      objectCode: entry.code,
      objectLabel: `${entry.code} 英文版本（失败）`,
      result: '失败',
      version: entry.version,
      detail: message,
    });
    return { ok: false, message };
  }
}

/** 下线：Zendesk 侧归档（draft=true），不做物理删除 */
export async function archiveEntry(actor: AuditActor, entry: EntryRow): Promise<void> {
  const { rows } = await query<{ zendesk_article_ref: string | null }>(
    'SELECT zendesk_article_ref FROM sync_mappings WHERE entry_id=$1',
    [entry.id],
  );
  const ref = rows[0]?.zendesk_article_ref;
  const started = Date.now();
  if (!ref) return;
  try {
    await getZendesk().archiveArticle(ref);
    await logSync({
      entryId: entry.id,
      entryCode: entry.code,
      objectLabel: `${entry.code} 归档（成功）`,
      result: '成功',
      message: `article ${ref} draft=true`,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'archive',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await logSync({
      entryId: entry.id,
      entryCode: entry.code,
      objectLabel: `${entry.code} 归档（失败）`,
      result: '失败',
      message,
      durationMs: Date.now() - started,
      actorName: actor.name,
      action: 'archive',
    });
  }
}

export async function retrySync(user: SessionUser, code: string): Promise<{ ok: boolean; message: string }> {
  const entry = await findEntry(code);
  if (entry.status !== 'published') {
    throw new DomainError('该知识未进入发布状态，无法同步 Zendesk。', 409);
  }
  return pushEntry(actorOf(user), code);
}

export interface SyncLogDto {
  id: string;
  at: string;
  entryCode: string;
  objectLabel: string;
  target: string;
  result: string;
  message: string;
  durationMs: number;
  payloadNo: string;
  actorName: string;
  payload: string;
}

export async function listSyncLogs(limit = 100): Promise<SyncLogDto[]> {
  const { rows } = await query<{
    id: string;
    at: Date;
    entry_code: string;
    object_label: string;
    target: string;
    result: string;
    message: string;
    duration_ms: number;
    payload_no: string;
    actor_name: string;
    payload: string;
  }>(`SELECT * FROM sync_logs ORDER BY at DESC LIMIT $1`, [limit]);
  const { fmtShort } = await import('../core/fmt.js');
  return rows.map((r) => ({
    id: r.id,
    at: fmtShort(r.at),
    entryCode: r.entry_code,
    objectLabel: r.object_label,
    target: r.target,
    result: r.result,
    message: r.message,
    durationMs: r.duration_ms,
    payloadNo: r.payload_no,
    actorName: r.actor_name,
    payload: r.payload,
  }));
}
