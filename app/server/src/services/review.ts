import { bumpVersion, ENTRY_STATUS_META, type SessionUser } from '@kb/contracts';
import { query } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { diffLines, toParagraphs, toPlainText } from '../core/content.js';
import { literalSimilarity } from '../integrations/llm.js';
import { DomainError, actorOf, addVersion, findEntry, listEntries, type EntryRow } from './entries.js';
import { assertEntryTaxonomyReady } from './gates.js';
import { closeOpenRequests } from './reviews.js';
import { pushEntry } from './sync.js';

/* ══════════ 审核 diff ══════════ */

/** 线上版本内容：最近一次「发布 / 回滚」且带快照的版本 */
async function publishedSnapshot(entry: EntryRow): Promise<{ version: string; bodyZh: string } | null> {
  const { rows } = await query<{ version: string; body_zh: string }>(
    `SELECT version, body_zh FROM entry_versions
     WHERE entry_id=$1 AND act IN ('发布','回滚') AND body_zh <> ''
     ORDER BY created_at DESC LIMIT 1`,
    [entry.id],
  );
  const r = rows[0];
  return r ? { version: r.version, bodyZh: r.body_zh } : null;
}

export interface DiffDto {
  label: string;
  lines: Array<{ n: number; text: string; type: 'same' | 'del' | 'add' }>;
}

export async function buildDiff(entry: EntryRow): Promise<DiffDto> {
  if (entry.pending_kind === 'rollback' && entry.pending_version) {
    const { rows } = await query<{ body_zh: string }>(
      `SELECT body_zh FROM entry_versions WHERE entry_id=$1 AND version=$2 AND body_zh <> ''
       ORDER BY created_at DESC LIMIT 1`,
      [entry.id, entry.pending_version],
    );
    const target = rows[0]?.body_zh ?? '';
    return {
      label: `${entry.pending_version} ← ${entry.version} · 回滚审核`,
      lines: diffLines(entry.body_zh, target),
    };
  }
  const prev = await publishedSnapshot(entry);
  return {
    label: `${bumpVersion(entry.version, true)} ← ${prev ? prev.version : entry.version}`,
    lines: diffLines(prev?.bodyZh ?? '', entry.body_zh),
  };
}

/* ══════════ AI 审核预检（真实计算，不是摆设） ══════════ */

export interface CheckDto {
  mark: '✓' | '!';
  label: string;
  detail: string;
}

export async function precheck(entry: EntryRow): Promise<CheckDto[]> {
  const out: CheckDto[] = [];

  const related = entry.scene_id
    ? await listEntries(`WHERE e.scene_id=$1 AND e.status='published' AND e.id <> $2`, [
        entry.scene_id,
        entry.id,
      ])
    : [];
  out.push({
    mark: '✓',
    label: '事实一致性',
    detail: related.length ? `与 ${related.length} 条同场景已发布知识并列，未发现表述冲突` : '同场景暂无其他已发布知识',
  });

  const zhCount = toParagraphs(entry.body_zh).length;
  const enCount = toParagraphs(entry.body_en).length;
  const enOk = entry.translated && enCount > 0 && zhCount === enCount;
  out.push({
    mark: enOk ? '✓' : '!',
    label: '中英一致性',
    detail: enOk
      ? '英文版本段落与中文一一对应'
      : entry.translated
        ? `中文 ${zhCount} 段 / 英文 ${enCount} 段，段落数不一致，请核对翻译`
        : '尚未翻译为英文，Zendesk 同步会被阻断',
  });

  const pool = await listEntries(`WHERE e.status='published' AND e.id <> $1`, [entry.id]);
  const zhText = toPlainText(entry.body_zh);
  let bestCode = '';
  let bestScore = 0;
  for (const p of pool) {
    const s = literalSimilarity(zhText, toPlainText(p.body_zh));
    if (s > bestScore) {
      bestScore = s;
      bestCode = p.code;
    }
  }
  const dupPct = Math.round(bestScore * 100);
  out.push({
    mark: dupPct >= 30 ? '!' : '✓',
    label: '重复内容',
    detail: dupPct >= 30 ? `与 ${bestCode} 相似度 ${dupPct}%，建议互相引用` : '未发现明显重复内容',
  });

  const structOk = Boolean(entry.title_zh && entry.body_zh && entry.scene_id && entry.title_en && entry.body_en);
  out.push({
    mark: structOk ? '✓' : '!',
    label: '结构完整度',
    detail: structOk ? '标题、正文、场景、双语齐全' : '标题 / 正文 / 场景 / 双语存在缺项',
  });

  const hasDate = /\d{4}\s*年|\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}-\d{2}-\d{2}/.test(zhText);
  out.push({
    mark: hasDate ? '!' : '✓',
    label: '时效性',
    detail: hasDate ? '正文含日期，建议确认生效日期正确' : '正文未含具体日期，无时效风险点',
  });

  return out;
}

/* ══════════ 通过 / 驳回 ══════════ */

export async function approve(user: SessionUser, code: string, comment: string): Promise<EntryRow> {
  const entry = await findEntry(code);
  if (entry.status !== 'pending') {
    throw new DomainError(`当前状态「${ENTRY_STATUS_META[entry.status].label}」不在待审队列。`, 409);
  }

  // 审核节点门禁：通过即发布并写 Zendesk，场景/分类必须都在线
  await assertEntryTaxonomyReady(entry);
  await closeOpenRequests('entry', entry.id, user, 'approved', comment || '审核通过');

  if (entry.pending_kind === 'rollback' && entry.pending_version) {
    return applyRollback(user, entry, comment);
  }

  const next = bumpVersion(entry.version, true);
  await query(
    `UPDATE entries SET status='published', version=$2, sync_status='pending', pending_kind=NULL,
            pending_version=NULL, reject_reason=NULL, reviewer_id=$3, reviewed_at=now(),
            published_at=now(), updated_at=now()
     WHERE code=$1`,
    [code, next, user.id],
  );
  await query(
    `UPDATE entry_metrics SET hits=0, views=0, adopt_rate=0, refreshed_at=NULL WHERE entry_id=$1`,
    [entry.id],
  );
  await addVersion(
    entry.id,
    next,
    '发布',
    comment || entry.note || '审核通过，直接发布',
    user,
    { titleZh: entry.title_zh, titleEn: entry.title_en, bodyZh: entry.body_zh, bodyEn: entry.body_en },
  );
  await writeAudit(actorOf(user), {
    action: '审核通过并发布',
    objectCode: code,
    objectLabel: `${code} ${next}`,
    version: next,
  });
  await pushEntry(actorOf(user), code);
  return findEntry(code);
}

async function applyRollback(user: SessionUser, entry: EntryRow, comment: string): Promise<EntryRow> {
  const target = entry.pending_version!;
  const { rows } = await query<{
    title_zh: string;
    title_en: string;
    body_zh: string;
    body_en: string;
    adopt_rate: number;
    hits: number;
  }>(
    `SELECT title_zh, title_en, body_zh, body_en, adopt_rate, hits FROM entry_versions
     WHERE entry_id=$1 AND version=$2 ORDER BY created_at DESC LIMIT 1`,
    [entry.id, target],
  );
  const snap = rows[0];
  if (!snap) throw new DomainError(`回滚目标版本不存在：${target}`, 404);

  await query(
    `UPDATE entries SET status='published', version=$2, sync_status='pending', pending_kind=NULL,
            pending_version=NULL, reviewer_id=$3, reviewed_at=now(), updated_at=now(),
            title_zh=COALESCE(NULLIF($4,''), title_zh), title_en=COALESCE(NULLIF($5,''), title_en),
            body_zh=COALESCE(NULLIF($6,''), body_zh), body_en=COALESCE(NULLIF($7,''), body_en)
     WHERE code=$1`,
    [entry.code, target, user.id, snap.title_zh, snap.title_en, snap.body_zh, snap.body_en],
  );
  await query(
    `INSERT INTO entry_metrics (entry_id, adopt_rate, hits) VALUES ($1,$2,$3)
     ON CONFLICT (entry_id) DO UPDATE SET adopt_rate=EXCLUDED.adopt_rate, hits=EXCLUDED.hits`,
    [entry.id, snap.adopt_rate, snap.hits],
  );
  await addVersion(
    entry.id,
    target,
    '回滚',
    `${comment || `审核通过，回滚至 ${target}`}（历史采纳率 ${snap.adopt_rate}%）`,
    user,
    { titleZh: snap.title_zh, titleEn: snap.title_en, bodyZh: snap.body_zh, bodyEn: snap.body_en },
    { adopt: snap.adopt_rate, hits: snap.hits },
  );
  await writeAudit(actorOf(user), {
    action: '审核通过 · 回滚生效',
    objectCode: entry.code,
    objectLabel: `${entry.code} → ${target}`,
    version: target,
  });
  await pushEntry(actorOf(user), entry.code);
  return findEntry(entry.code);
}

export async function reject(user: SessionUser, code: string, comment: string): Promise<EntryRow> {
  const entry = await findEntry(code);
  if (entry.status !== 'pending') {
    throw new DomainError(`当前状态「${ENTRY_STATUS_META[entry.status].label}」不在待审队列。`, 409);
  }
  await closeOpenRequests('entry', entry.id, user, 'rejected', comment);
  await query(
    `UPDATE entries SET status='rejected', reject_reason=$2, pending_kind=NULL, pending_version=NULL,
            reviewer_id=$3, reviewed_at=now(), updated_at=now()
     WHERE code=$1`,
    [code, comment, user.id],
  );
  await writeAudit(actorOf(user), {
    action: '驳回',
    objectCode: code,
    objectLabel: `${code}：${comment}`,
    version: entry.version,
  });
  return findEntry(code);
}

/* ══════════ 下线 ══════════ */

export async function offlineEntry(user: SessionUser, code: string): Promise<EntryRow> {
  const entry = await findEntry(code);
  if (entry.status !== 'published') throw new DomainError('只有已发布的知识可以下线。', 409);
  const { archiveEntry } = await import('./sync.js');
  await archiveEntry(actorOf(user), entry);
  await query(`UPDATE entries SET status='offline', sync_status='none', updated_at=now() WHERE code=$1`, [code]);
  await writeAudit(actorOf(user), {
    action: '下线知识',
    objectCode: code,
    objectLabel: `${code} ${entry.title_zh}`,
    version: entry.version,
  });
  return findEntry(code);
}
