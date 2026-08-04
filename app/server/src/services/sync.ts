import {
  enAllowsSync,
  TUNABLES,
  zhCN,
  type EnStatus,
  type EntryBody,
  type SessionUser,
  type Visibility,
} from '@kb/contracts';
import { query, withTransaction, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { contentHash, toInternalHtml, toPlainText, toPublicHtml } from '../core/content.js';
import { getZendesk, ZendeskApiError } from '../integrations/zendesk.js';
import { DomainError } from './entries.js';

interface TaskRow {
  id: string;
  entry_id: string;
  version_no: number;
  action: string;
  target: string;
  status: string;
  languages: string;
  retry_count: number;
  fail_reason: string | null;
  blocked_reason: string | null;
  updated_at: Date;
  code: string;
  title: string;
  visibility: Visibility;
  labels: string[];
  body: EntryBody;
  en_status: EnStatus;
  chapter_id: string;
  section_ref: string | null;
}

const TASK_SELECT = `
  SELECT t.*, e.code, e.title, e.visibility, e.labels, e.body, e.en_status, e.chapter_id,
         c.zendesk_section_ref AS section_ref
  FROM sync_tasks t
  JOIN entries e ON e.id = t.entry_id
  JOIN chapters c ON c.id = e.chapter_id
`;

export async function listSyncTasks(): Promise<
  Array<{
    id: string; entryCode: string; entryTitle: string; versionLabel: string; action: string;
    target: string; status: string; languages: string; retryCount: number;
    failReason: string | null; blockedReason: string | null; updatedAt: string;
  }>
> {
  const { rows } = await query<TaskRow>(
    `${TASK_SELECT} ORDER BY CASE t.status WHEN 'failed' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END, t.updated_at DESC`,
  );
  return rows.map((t) => ({
    id: t.id,
    entryCode: t.code,
    entryTitle: t.title,
    versionLabel: `v${t.version_no}`,
    action: t.action,
    target: t.target,
    status: t.status,
    languages: t.languages,
    retryCount: t.retry_count,
    failReason: t.fail_reason,
    blockedReason: t.blocked_reason,
    updatedAt: t.updated_at.toISOString(),
  }));
}

export async function syncStats(): Promise<Record<string, number>> {
  const { rows } = await query<{ status: string; n: string }>(
    'SELECT status, COUNT(*)::text AS n FROM sync_tasks GROUP BY status',
  );
  const base: Record<string, number> = { queued: 0, running: 0, synced: 0, failed: 0, blocked: 0, archived: 0 };
  for (const r of rows) base[r.status] = Number(r.n);
  return base;
}

/**
 * 执行一条同步任务。
 * 铁律：英文非「已确认」→ 阻断（不推半截内容）；混合条目内部段落服务端剥离后才推对外。
 */
export async function runSyncTask(taskId: string): Promise<{ status: string; reason?: string }> {
  const { rows } = await query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
  const t = rows[0];
  if (!t) throw new DomainError('同步任务不存在', 404);
  if (t.status === 'synced' || t.status === 'archived') return { status: t.status };

  // 英文状态硬拦（AC-P-16）
  if (t.languages.includes('英') && !enAllowsSync(t.en_status)) {
    await query(
      `UPDATE sync_tasks SET status='blocked', blocked_reason=$2, updated_at=now() WHERE id=$1`,
      [taskId, '英文未确认——人工校验 100% 铁律，同步阻断'],
    );
    await query(`UPDATE entries SET sync_status='blocked', blocked_reason=$2 WHERE id=$1`, [
      t.entry_id,
      '英文未确认——同步阻断',
    ]);
    return { status: 'blocked', reason: '英文未确认' };
  }
  if (!t.section_ref) {
    await query(
      `UPDATE sync_tasks SET status='failed', fail_reason=$2, updated_at=now() WHERE id=$1`,
      [taskId, '结构映射缺失：所属章节未配置 Zendesk Section——请先在章节管理修复映射'],
    );
    await query(`UPDATE entries SET sync_status='failed' WHERE id=$1`, [t.entry_id]);
    return { status: 'failed', reason: '结构映射缺失' };
  }

  await query(`UPDATE sync_tasks SET status='running', updated_at=now() WHERE id=$1`, [taskId]);

  const zd = getZendesk();
  const internalOnly = t.visibility === 'internal';
  // 数据泄漏级零容忍：对外正文只由 stripInternal 产物生成
  const publicHtml = internalOnly ? toInternalHtml(t.body) : toPublicHtml(t.body);

  const enPairs = await query<{ en_text: string | null; internal: boolean; seq: number }>(
    'SELECT en_text, internal, seq FROM translation_pairs WHERE entry_id=$1 ORDER BY seq',
    [t.entry_id],
  );
  const enBody = enPairs.rows
    .filter((p) => !p.internal && p.en_text)
    .map((p) => `<p>${p.en_text}</p>`)
    .join('\n');

  try {
    const article = await zd.upsertArticle({
      entryCode: t.code,
      title: t.title,
      publicHtml,
      labels: t.labels ?? [],
      sectionRef: t.section_ref,
      internalOnly,
      enBodyHtml: t.languages.includes('英') && enBody ? enBody : undefined,
    });

    const hash = contentHash(toPlainText(t.body));
    await withTransaction(async (client) => {
      await client.query(`UPDATE sync_tasks SET status='synced', fail_reason=NULL, blocked_reason=NULL, updated_at=now() WHERE id=$1`, [taskId]);
      await client.query(
        `UPDATE entries SET sync_status='synced', blocked_reason=NULL,
           en_status = CASE WHEN en_status='confirmed' THEN 'synced' ELSE en_status END WHERE id=$1`,
        [t.entry_id],
      );
      const { rows: existing } = await client.query('SELECT id FROM sync_mappings WHERE entry_id=$1', [t.entry_id]);
      if (existing[0]) {
        await client.query(
          `UPDATE sync_mappings SET zendesk_ref=$2, published_hash=$3, visibility=$4, updated_at=now() WHERE entry_id=$1`,
          [t.entry_id, article.id, hash, t.visibility],
        );
      } else {
        await client.query(
          `INSERT INTO sync_mappings (id, entry_id, chapter_id, local_label, zendesk_kind, zendesk_ref, visibility, published_hash)
           VALUES ($1,$2,$3,$4,'article',$5,$6,$7)`,
          [newId('map'), t.entry_id, t.chapter_id, `${t.code} ${t.title}`, article.id, t.visibility, hash],
        );
      }
    });
    return { status: 'synced' };
  } catch (err) {
    const e = err as ZendeskApiError;
    const retry = t.retry_count + 1;
    const exhausted = retry >= TUNABLES.syncRetryLimit;
    const reason =
      e instanceof ZendeskApiError && e.status === 429
        ? `Zendesk API 429 限流（Retry-After ${e.retryAfterSec ?? '-'}s）`
        : (e.message ?? '未知错误');
    await query(
      `UPDATE sync_tasks SET status='failed', retry_count=$2, fail_reason=$3, updated_at=now() WHERE id=$1`,
      [taskId, retry, exhausted ? `${reason}（已重试 ${retry} 次，重试耗尽已告警）` : reason],
    );
    await query(`UPDATE entries SET sync_status='failed' WHERE id=$1`, [t.entry_id]);
    return { status: 'failed', reason };
  }
}

/** 处理队列中全部待同步任务（node-cron 分钟级；同步器唯一执行入口） */
export async function drainQueue(): Promise<{ processed: number }> {
  const { rows } = await query<{ id: string }>(`SELECT id FROM sync_tasks WHERE status='queued' ORDER BY created_at`);
  for (const r of rows) await runSyncTask(r.id);
  return { processed: rows.length };
}

export async function retryTask(user: SessionUser, taskId: string): Promise<{ status: string }> {
  const { rows } = await query<TaskRow>(`${TASK_SELECT} WHERE t.id=$1`, [taskId]);
  const t = rows[0];
  if (!t) throw new DomainError('同步任务不存在', 404);
  await writeAudit(user, {
    objectType: 'sync_task',
    objectId: taskId,
    objectLabel: `${t.code} ${t.title}`,
    action: '手动重试同步',
    category: 'review',
    field: '同步状态',
    before: t.status,
    after: 'queued',
  });
  await query(`UPDATE sync_tasks SET status='queued', updated_at=now() WHERE id=$1`, [taskId]);
  const result = await runSyncTask(taskId);
  return { status: result.status };
}

/** drift 检测：比对已发布内容哈希与 Zendesk 端实际内容 */
export async function scanDrift(): Promise<{ detected: number }> {
  const { rows } = await query<{
    entry_id: string; zendesk_ref: string; published_hash: string; code: string; title: string; body: EntryBody;
  }>(
    `SELECT m.entry_id, m.zendesk_ref, m.published_hash, e.code, e.title, e.body
     FROM sync_mappings m JOIN entries e ON e.id = m.entry_id
     WHERE m.zendesk_ref IS NOT NULL`,
  );
  const zd = getZendesk();
  let detected = 0;
  for (const m of rows) {
    const article = await zd.getArticle(m.zendesk_ref);
    if (!article) continue;
    const remoteHash = contentHash(stripTags(article.bodyHtml));
    const localHash = contentHash(stripTags(toPublicHtml(m.body)));
    if (remoteHash !== localHash && article.updatedBy !== 'COOLFLY 知识运营中台') {
      const { rows: dup } = await query(
        `SELECT id FROM drift_records WHERE entry_id=$1 AND resolved_action IS NULL`,
        [m.entry_id],
      );
      if (dup[0]) continue;
      await query(
        `INSERT INTO drift_records (id, entry_id, article_ref, title, changed_by, diff_summary, remote_body)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          newId('drift'),
          m.entry_id,
          `Article ${article.id}`,
          m.title,
          `Zendesk 端 ${article.updatedBy}`,
          `正文与本台已发布版本不一致 · ${new Date(article.updatedAt).toLocaleString('zh-CN')}`,
          stripTags(article.bodyHtml),
        ],
      );
      detected += 1;
    }
  }
  return { detected };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
}

export async function listDrift(): Promise<
  Array<{ id: string; entryCode: string; articleRef: string; title: string; changedBy: string; diffSummary: string; detectedAt: string; resolvedAction: string | null }>
> {
  const { rows } = await query<{
    id: string; article_ref: string; title: string; changed_by: string; diff_summary: string;
    detected_at: Date; resolved_action: string | null; code: string;
  }>(
    `SELECT d.*, e.code FROM drift_records d LEFT JOIN entries e ON e.id = d.entry_id
     ORDER BY d.resolved_action NULLS FIRST, d.detected_at DESC`,
  );
  return rows.map((d) => ({
    id: d.id,
    entryCode: d.code,
    articleRef: d.article_ref,
    title: d.title,
    changedBy: d.changed_by,
    diffSummary: d.diff_summary,
    detectedAt: d.detected_at.toISOString(),
    resolvedAction: d.resolved_action,
  }));
}

/** drift 双处置：覆盖（推本台版本）/ 拉回（Zendesk 端内容进审核队列） */
export async function resolveDrift(
  user: SessionUser,
  driftId: string,
  action: 'overwrite' | 'pull_back',
): Promise<{ action: string }> {
  const { rows } = await query<{
    id: string; entry_id: string; title: string; remote_body: string | null; article_ref: string; code: string; body: EntryBody; visibility: Visibility; current_version: number;
  }>(
    `SELECT d.id, d.entry_id, d.title, d.remote_body, d.article_ref, e.code, e.body, e.visibility, e.current_version
     FROM drift_records d JOIN entries e ON e.id = d.entry_id WHERE d.id=$1`,
    [driftId],
  );
  const d = rows[0];
  if (!d) throw new DomainError('漂移记录不存在', 404);

  if (action === 'overwrite') {
    const taskId = newId('sync');
    await query(
      `INSERT INTO sync_tasks (id, entry_id, version_no, action, target, status, languages)
       VALUES ($1,$2,$3,'drift 覆盖：以本台内容重推',$4,'queued','中')`,
      [taskId, d.entry_id, d.current_version, d.visibility === 'internal' ? '内部知识 · 仅客服 segment' : '帮助中心 · 对外文章'],
    );
    await runSyncTask(taskId);
  } else {
    const paragraphs = (d.remote_body ?? '')
      .split('\n')
      .filter((l) => l.trim())
      .map((text, i) => ({ id: `p_pull_${i}`, text, internal: false, heading: false }));
    await query(
      `UPDATE entries SET body=$2::jsonb, status='pending_review', review_source='feedback',
         submitter_id=$3, submitted_at=now(), updated_at=now(), vector_status='stale' WHERE id=$1`,
      [d.entry_id, JSON.stringify({ paragraphs: paragraphs.length ? paragraphs : [{ id: 'p_pull_0', text: '（Zendesk 端内容为空）', internal: false, heading: false }] }), user.id],
    );
  }

  await query(`UPDATE drift_records SET resolved_action=$2, resolved_by=$3, resolved_at=now() WHERE id=$1`, [
    driftId,
    action,
    user.id,
  ]);
  await writeAudit(user, {
    objectType: 'drift',
    objectId: driftId,
    objectLabel: `${d.code} ${d.title}（${d.article_ref}）`,
    action: action === 'overwrite' ? 'drift 处置：以本台内容覆盖' : 'drift 处置：拉回进审核队列',
    category: 'review',
    field: '漂移处置',
    before: '未处置',
    after: action === 'overwrite' ? '以本台覆盖（Zendesk 端修改丢弃）' : '拉回进审核队列（作为待审来源）',
    note: zhCN.sync.driftGovernance,
  });
  return { action };
}

export async function listMappings(): Promise<Array<{ local: string; zendesk: string; visibility: string }>> {
  const { rows } = await query<{ name: string; lib: string; ref: string | null; internal_only: boolean }>(
    `SELECT c.name, l.name AS lib, c.zendesk_section_ref AS ref, l.internal_only
     FROM chapters c JOIN libraries l ON l.id = c.library_id WHERE c.parent_id IS NOT NULL ORDER BY l.sort_order, c.sort_order`,
  );
  return rows.map((r) => ({
    local: `${r.lib} → ${r.name}`,
    zendesk: r.ref ? `Section ${r.ref}` : '（未映射）',
    visibility: r.internal_only ? '仅客服 segment' : '对外公开',
  }));
}
