import type { SessionUser } from '@kb/contracts';
import { getMatrix, hasPermission } from '../core/rbac.js';
import { withCodeRetry } from '../core/codes.js';
import { query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { fmtShort, fmtFull } from '../core/fmt.js';
import { getZendesk } from '../integrations/zendesk.js';
import { DomainError, actorOf } from './entries.js';
import { assertCategoryPublished } from './gates.js';
import { logSync, syncCategory, syncScene } from './sync.js';

/* ══════════ 类型 ══════════ */

export type ReviewObjectType = 'category' | 'scene' | 'entry';
export type ReviewAction = 'create' | 'update' | 'publish' | 'unpublish' | 'rollback';

export const OBJECT_LABEL: Record<ReviewObjectType, string> = {
  category: '知识分类',
  scene: '问题场景',
  entry: '知识正文',
};

export const ACTION_LABEL: Record<ReviewAction, string> = {
  create: '新增',
  update: '更新',
  publish: '上架',
  unpublish: '下架',
  rollback: '回滚',
};

export interface ReviewRequestDto {
  id: string;
  code: string;
  objectType: ReviewObjectType;
  objectTypeLabel: string;
  objectId: string;
  objectCode: string;
  objectLabel: string;
  action: ReviewAction;
  actionLabel: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  statusLabel: string;
  autoApproved: boolean;
  submitter: string;
  submittedAt: string;
  submittedAtFull: string;
  reviewer: string;
  reviewedAt: string;
  comment: string;
  payload: Record<string, unknown>;
  before: Record<string, unknown>;
  /** 三维摘要：分类 / 场景 / 正文——审核队列与记录都按这三列展示 */
  dimCategory: string;
  dimScene: string;
  dimBody: string;
}

interface Row {
  id: string;
  code: string;
  object_type: ReviewObjectType;
  object_id: string;
  object_code: string;
  object_label: string;
  action: ReviewAction;
  payload: Record<string, unknown>;
  before_snapshot: Record<string, unknown>;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  auto_approved: boolean;
  submitter_name: string;
  submitted_at: Date;
  reviewer_name: string;
  reviewed_at: Date | null;
  comment: string;
}

const STATUS_LABEL = {
  pending: '待审核',
  processing: '处理中',
  approved: '通过',
  rejected: '驳回',
} as const;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toDto(r: Row): ReviewRequestDto {
  const p = r.payload ?? {};
  return {
    id: r.id,
    code: r.code,
    objectType: r.object_type,
    objectTypeLabel: OBJECT_LABEL[r.object_type],
    objectId: r.object_id,
    objectCode: r.object_code,
    objectLabel: r.object_label,
    action: r.action,
    actionLabel: ACTION_LABEL[r.action],
    status: r.status,
    statusLabel: STATUS_LABEL[r.status],
    autoApproved: r.auto_approved,
    submitter: r.submitter_name,
    submittedAt: fmtShort(r.submitted_at),
    submittedAtFull: fmtFull(r.submitted_at),
    reviewer: r.reviewer_name,
    reviewedAt: r.reviewed_at ? fmtShort(r.reviewed_at) : '—',
    comment: r.comment,
    payload: p,
    before: r.before_snapshot ?? {},
    dimCategory: str(p.categoryZh) || (r.object_type === 'category' ? str(p.nameZh) : '') || '—',
    dimScene: str(p.sceneZh) || (r.object_type === 'scene' ? str(p.nameZh) : '') || '—',
    dimBody: str(p.bodySummary) || (r.object_type === 'entry' ? str(p.titleZh) : '') || '—',
  };
}

/* ══════════ 编号 ══════════ */

async function nextCode(): Promise<string> {
  const { rows } = await query<{ max: string | null }>(
    `SELECT MAX(CAST(SUBSTRING(code FROM 'RV-([0-9]+)') AS INT))::text AS max
     FROM review_requests WHERE code ~ '^RV-[0-9]+$'`,
  );
  return `RV-${Number(rows[0]?.max ?? 5000) + 1}`;
}

/* ══════════ 自动过审 ══════════ */

export async function canAutoApprove(user: SessionUser): Promise<boolean> {
  const matrix = await getMatrix();
  return hasPermission(matrix, user.role, user.reviewGranted, 'review.auto');
}

/* ══════════ 提交 ══════════ */

export interface SubmitArgs {
  objectType: ReviewObjectType;
  objectId: string;
  objectCode: string;
  objectLabel: string;
  action: ReviewAction;
  payload: Record<string, unknown>;
  before?: Record<string, unknown>;
}

export interface SubmitResult {
  request: ReviewRequestDto;
  /** 自动过审时为 true，表示已直接生效 */
  applied: boolean;
  message: string;
  /** 生效动作里如果碰了 Zendesk，这里带回真实结果 */
  sync?: { ok: boolean; message: string };
}

/**
 * 提交一条审核请求。分类、场景、知识正文共用这一条流水线：
 * - 无「自动过审」权限 → 落 pending，等审核中心处理；
 * - 有「自动过审」权限 → 当场批准并生效，但记录照样完整落库（auto_approved=true）。
 */
export async function submitRequest(user: SessionUser, args: SubmitArgs): Promise<SubmitResult> {
  const auto = await canAutoApprove(user);
  const id = newId('rr');
  // 取号与插入一起重试：撞号失败会让「条目已 pending 但队列里没有」的孤儿出现
  const code = await withCodeRetry(async () => {
    const next = await nextCode();
    await query(
      `INSERT INTO review_requests
         (id, code, object_type, object_id, object_code, object_label, action, payload, before_snapshot,
          status, auto_approved, submitter_id, submitter_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12)`,
      [
        id,
        next,
        args.objectType,
        args.objectId,
        args.objectCode,
        args.objectLabel,
        args.action,
        JSON.stringify(args.payload),
        JSON.stringify(args.before ?? {}),
        auto,
        user.id,
        user.name,
      ],
    );
    return next;
  });
  await writeAudit(actorOf(user), {
    action: `提交审核 · ${OBJECT_LABEL[args.objectType]}${ACTION_LABEL[args.action]}`,
    objectType: args.objectType,
    objectCode: args.objectCode,
    objectLabel: `${code} ${args.objectLabel}`,
  });

  if (!auto) {
    return {
      request: await findRequest(code),
      applied: false,
      message: `已提交审核（${code}），通过后生效。`,
    };
  }
  const out = await decide(user, code, 'approved', '自动过审（管理员权限）');
  return {
    request: out.request,
    applied: true,
    message: out.sync && !out.sync.ok ? `已自动过审并生效，但 Zendesk 同步失败：${out.sync.message}` : '已自动过审并生效。',
    sync: out.sync,
  };
}

/**
 * 沿用已发布对象时的留痕：采纳向导要求「提交后生成分类、场景、正文三条审核记录」，
 * 但沿用一个已经在线的分类并不需要人再批一次——直接以 approved 落一条记录，
 * 既有完整痕迹，又不会在待审队列里堆无意义的请求。
 */
export async function recordReuse(
  user: SessionUser,
  args: Omit<SubmitArgs, 'action'> & { note: string },
): Promise<ReviewRequestDto> {
  const id = newId('rr');
  const code = await withCodeRetry(async () => {
    const next = await nextCode();
    await query(
      `INSERT INTO review_requests
         (id, code, object_type, object_id, object_code, object_label, action, payload, before_snapshot,
          status, auto_approved, submitter_id, submitter_name, reviewer_id, reviewer_name, reviewed_at, comment)
       VALUES ($1,$2,$3,$4,$5,$6,'update',$7,'{}'::jsonb,'approved',FALSE,$8,$9,$8,$9,now(),$10)`,
      [
        id,
        next,
        args.objectType,
        args.objectId,
        args.objectCode,
        args.objectLabel,
        JSON.stringify({ ...args.payload, noop: true }),
        user.id,
        user.name,
        args.note,
      ],
    );
    return next;
  });
  return findRequest(code);
}

/* ══════════ 查询 ══════════ */

export async function findRequest(code: string): Promise<ReviewRequestDto> {
  const { rows } = await query<Row>('SELECT * FROM review_requests WHERE code=$1', [code]);
  if (!rows[0]) throw new DomainError(`审核记录不存在：${code}`, 404);
  return toDto(rows[0]);
}

/** 待审队列。processing（已被认领、正在生效）也算未结案，否则它会从队列里凭空消失 */
export async function listPending(): Promise<ReviewRequestDto[]> {
  const { rows } = await query<Row>(
    `SELECT * FROM review_requests WHERE status IN ('pending','processing') ORDER BY submitted_at`,
  );
  return rows.map(toDto);
}

export async function listRecords(limit = 200): Promise<ReviewRequestDto[]> {
  const { rows } = await query<Row>(
    `SELECT * FROM review_requests WHERE status IN ('approved','rejected')
     ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toDto);
}

/** 某个对象上尚未结案的请求（用于界面显示「审核中，不可重复提交」） */
export async function openRequestFor(
  objectType: ReviewObjectType,
  objectId: string,
): Promise<ReviewRequestDto | null> {
  const { rows } = await query<Row>(
    `SELECT * FROM review_requests WHERE object_type=$1 AND object_id=$2 AND status IN ('pending','processing')
     ORDER BY submitted_at DESC LIMIT 1`,
    [objectType, objectId],
  );
  return rows[0] ? toDto(rows[0]) : null;
}

/** 关掉某对象未结案的请求（知识正文走原有 approve/reject 时回写） */
export async function closeOpenRequests(
  objectType: ReviewObjectType,
  objectId: string,
  user: SessionUser,
  status: 'approved' | 'rejected',
  comment: string,
): Promise<void> {
  await query(
    `UPDATE review_requests SET status=$3, reviewer_id=$4, reviewer_name=$5, reviewed_at=now(), comment=$6
     WHERE object_type=$1 AND object_id=$2 AND status IN ('pending','processing')`,
    [objectType, objectId, status, user.id, user.name, comment],
  );
}

/* ══════════ 审核裁决 ══════════ */

export interface DecideResult {
  request: ReviewRequestDto;
  sync?: { ok: boolean; message: string };
}

export async function decide(
  user: SessionUser,
  code: string,
  verdict: 'approved' | 'rejected',
  comment: string,
): Promise<DecideResult> {
  // 抢占式认领：把 pending 原子地翻成 processing，谁翻成功谁才有权继续。
  // 原来是先 SELECT 判 pending、再慢悠悠调 Zendesk、最后才 close，中间几秒的窗口里
  // 另一个审核人可以对同一条做出相反裁决——终态出现「记录=驳回、对象已上架且已建 Category」。
  const { rows: claimed } = await query<Row>(
    `UPDATE review_requests SET status='processing', reviewer_id=$2, reviewer_name=$3
     WHERE code=$1 AND status='pending' RETURNING *`,
    [code, user.id, user.name],
  );
  const r = claimed[0];
  if (!r) {
    const { rows: cur } = await query<Row>('SELECT * FROM review_requests WHERE code=$1', [code]);
    if (!cur[0]) throw new DomainError(`审核记录不存在：${code}`, 404);
    throw new DomainError(
      cur[0].status === 'processing'
        ? '该请求正在被其他审核人处理，请稍后刷新查看结论。'
        : `该请求已${STATUS_LABEL[cur[0].status as keyof typeof STATUS_LABEL] ?? cur[0].status}，不可重复处理。`,
      409,
    );
  }

  try {
    if (verdict === 'rejected') {
      await close(r, user, 'rejected', comment);
      if (r.object_type === 'entry') {
        const { reject } = await import('./review.js');
        await reject(user, r.object_code, comment || '审核驳回');
      } else {
        await revertPending(r);
      }
      return { request: await findRequest(code) };
    }

    // 知识正文沿用原有六态机的发布路径（版本、快照、指标、Zendesk 一并处理）
    if (r.object_type === 'entry') {
      const { approve } = await import('./review.js');
      await approve(user, r.object_code, comment);
      await close(r, user, 'approved', comment);
      return { request: await findRequest(code) };
    }

    const sync = await applyTaxonomy(r, user);
    // 生效失败就不能标「通过」——否则记录说通过、Zendesk 没动，且无处重试。
    // 退回 pending，审核人修好外部依赖后原样再点一次。
    if (!sync.ok) {
      await releaseClaim(r);
      await writeAudit(actorOf(user), {
        action: `审核生效失败 · ${OBJECT_LABEL[r.object_type]}${ACTION_LABEL[r.action]}`,
        objectType: r.object_type,
        objectCode: r.object_code,
        objectLabel: `${r.code} ${r.object_label}`,
        result: '失败',
        detail: sync.message,
      });
      throw new DomainError(`生效失败，请求已退回待审可重试：${sync.message}`, 502);
    }
    await close(r, user, 'approved', comment);
    await writeAudit(actorOf(user), {
      action: `审核通过 · ${OBJECT_LABEL[r.object_type]}${ACTION_LABEL[r.action]}`,
      objectType: r.object_type,
      objectCode: r.object_code,
      objectLabel: `${r.code} ${r.object_label}`,
    });
    return { request: await findRequest(code), sync };
  } catch (err) {
    // 认领后中途抛错（门禁 409、条目状态已变、外部异常）必须把 processing 放回去，
    // 否则请求会永久卡在中间态，队列里既看不见、也没人能再处理
    await releaseClaim(r);
    throw err;
  }
}

/** 把认领中的请求放回待审（仅当它还停在 processing） */
async function releaseClaim(r: Row): Promise<void> {
  await query(
    `UPDATE review_requests SET status='pending', reviewer_id=NULL, reviewer_name='' WHERE id=$1 AND status='processing'`,
    [r.id],
  );
}

async function close(
  r: Row,
  user: SessionUser,
  status: 'approved' | 'rejected',
  comment: string,
): Promise<void> {
  await query(
    `UPDATE review_requests SET status=$2, reviewer_id=$3, reviewer_name=$4, reviewed_at=now(), comment=$5
     WHERE id=$1 AND status='processing'`,
    [r.id, status, user.id, user.name, comment],
  );
}

/** 驳回时把 pending 状态退回原样：新建的留 draft，其它回到变更前状态 */
async function revertPending(r: Row): Promise<void> {
  const table = r.object_type === 'category' ? 'categories' : 'scenes';
  const before = str(r.before_snapshot?.status) || 'draft';
  await query(`UPDATE ${table} SET status=$2, updated_at=now() WHERE id=$1 AND status='pending'`, [
    r.object_id,
    before,
  ]);
}

/* ══════════ 分类 / 场景的生效动作 ══════════ */

async function applyTaxonomy(r: Row, user: SessionUser): Promise<{ ok: boolean; message: string }> {
  const p = r.payload ?? {};
  if (p.noop === true) return { ok: true, message: '沿用已发布对象，无需同步 Zendesk。' };
  if (r.object_type === 'category') {
    if (r.action === 'unpublish') return unpublishCategory(r, user);
    await query(
      `UPDATE categories SET name_zh=COALESCE(NULLIF($2,''), name_zh), name_en=COALESCE(NULLIF($3,''), name_en),
              status='published', active=TRUE, updated_at=now()
       WHERE id=$1`,
      [r.object_id, str(p.nameZh), str(p.nameEn)],
    );
    const s = await syncCategory(actorOf(user), r.object_id);
    const restored = r.action === 'publish' ? await restoreCascadedScenes(r, user) : 0;
    return {
      ok: s.ok,
      message: restored ? `${s.message}；同时恢复了随其下架的 ${restored} 个场景` : s.message,
    };
  }

  if (r.action === 'unpublish') return unpublishScene(r, user);
  // 父分类必须复查：门禁只在**提交时**跑过，提交到人工审批之间父分类可能已被下架。
  // publish 动作的 payload 不带 categoryId，得从库里取，否则这道复查会被整体跳过。
  const categoryId = str(p.categoryId) || (await sceneParentId(r.object_id));
  if (categoryId) await assertCategoryPublished(categoryId);
  await query(
    `UPDATE scenes SET name_zh=COALESCE(NULLIF($2,''), name_zh), name_en=COALESCE(NULLIF($3,''), name_en),
            category_id=COALESCE(NULLIF($4,''), category_id), status='published', active=TRUE, updated_at=now()
     WHERE id=$1`,
    [r.object_id, str(p.nameZh), str(p.nameEn), categoryId],
  );
  const s = await syncScene(actorOf(user), r.object_id);
  return { ok: s.ok, message: s.message };
}

async function sceneParentId(sceneId: string): Promise<string> {
  const { rows } = await query<{ category_id: string }>('SELECT category_id FROM scenes WHERE id=$1', [sceneId]);
  return rows[0]?.category_id ?? '';
}

/**
 * 分类重新上架时，把当初随它一起被下架的场景恢复回来。
 *
 * 原来下架是级联的、上架不是：分类回来了，其下场景仍是 offline，而 `catalogTree`
 * 只暴露 published 的分类与场景，编辑器下拉与目录浏览就都是空的——用户看到的
 * 「分类下架再上架，里面的东西不见了」就是这个不对称。
 *
 * 只恢复当初被这次下架带走的那些（记在 payload.cascadedSceneIds 里），
 * 本来就已经单独下架的场景保持原样。Zendesk Section 已随 Category 被硬删，
 * ref 已清空，恢复时重新建目录。
 */
async function restoreCascadedScenes(r: Row, user: SessionUser): Promise<number> {
  const { rows } = await query<{ ids: string[] | null }>(
    `SELECT (
       SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'cascadedSceneIds'))
       FROM review_requests
       WHERE object_type='category' AND object_id=$1 AND action='unpublish' AND status='approved'
       ORDER BY reviewed_at DESC NULLS LAST LIMIT 1
     ) AS ids`,
    [r.object_id],
  );
  const ids = (rows[0]?.ids ?? []).filter(Boolean);
  if (!ids.length) return 0;
  const { rows: restored } = await query<{ id: string }>(
    `UPDATE scenes SET status='published', active=TRUE, updated_at=now()
     WHERE id = ANY($1::text[]) AND category_id=$2 AND status='offline'
     RETURNING id`,
    [ids, r.object_id],
  );
  for (const s of restored) await syncScene(actorOf(user), s.id);
  return restored.length;
}

/**
 * 分类下架 = 删除 Zendesk Category。
 * Zendesk 删 Category 会**连带硬删**其下全部 Section 与 Article，所以本地这一侧必须
 * 与场景下架对齐地把整棵子树都处理掉：场景 offline、其下已发布知识 offline、
 * 并清掉 `sync_mappings.zendesk_article_ref`。
 *
 * 原实现只改了 categories 与 scenes 两张表，完全没碰 entries 与 sync_mappings，后果是：
 * 线上文章已被删，中台仍显示「已发布 / 已同步」；投票回流对死 id 恒 404 静默中断；
 * 之后重新同步会拿着已不存在的 article ref 走更新路径，PUT/POST 双 404 陷入死循环。
 *
 * 被连带下架的场景 id 记进审核请求的 payload，重新上架时据此把子树一并恢复。
 */
async function unpublishCategory(r: Row, user: SessionUser): Promise<{ ok: boolean; message: string }> {
  const { rows } = await query<{ zendesk_category_ref: string | null; name_zh: string; code: string }>(
    'SELECT zendesk_category_ref, name_zh, code FROM categories WHERE id=$1',
    [r.object_id],
  );
  const c = rows[0];
  if (!c) throw new DomainError('分类不存在', 404);

  // 记下「因这次下架而被连带下架」的场景，供重新上架时恢复；已经是下架态的不记（本就该保持下架）
  const { rows: cascaded } = await query<{ id: string }>(
    `SELECT id FROM scenes WHERE category_id=$1 AND status <> 'offline'`,
    [r.object_id],
  );

  /** 本地这一侧的整棵子树：分类 → 场景 → 条目 → 文章映射，一次落齐 */
  const applyLocal = async (): Promise<number> => {
    await query(`UPDATE review_requests SET payload = payload || $2::jsonb WHERE id=$1`, [
      r.id,
      JSON.stringify({ cascadedSceneIds: cascaded.map((s) => s.id) }),
    ]);
    await query(`UPDATE categories SET status='offline', active=FALSE, updated_at=now() WHERE id=$1`, [r.object_id]);
    await query(
      `UPDATE scenes SET status='offline', active=FALSE, zendesk_section_ref=NULL, updated_at=now()
       WHERE category_id=$1`,
      [r.object_id],
    );
    // 线上文章会被 Zendesk 连带删除，本地条目必须同步落到 offline，并断开已失效的文章映射
    await query(
      `UPDATE entries SET status='offline', sync_status='none', updated_at=now()
       WHERE category_id=$1 AND status='published'`,
      [r.object_id],
    );
    const { rowCount } = await query(
      `DELETE FROM sync_mappings WHERE entry_id IN (SELECT id FROM entries WHERE category_id=$1)`,
      [r.object_id],
    );
    return rowCount ?? 0;
  };

  if (!c.zendesk_category_ref) {
    await applyLocal();
    return { ok: true, message: '该分类未同步过 Zendesk，仅本地下架。' };
  }
  const started = Date.now();
  try {
    // 先动 Zendesk，成功了再改本地——反过来的话远端删除失败会留下
    // 「本地整棵子树已下架、线上原封不动」的半截状态，而且重试通道已被自己堵死
    // （requestMetaToggle 对非 published 对象拒绝再次下架）
    await getZendesk().deleteCategory(c.zendesk_category_ref);
    const unmapped = await applyLocal();
    await query('UPDATE categories SET zendesk_category_ref=NULL WHERE id=$1', [r.object_id]);
    await logSync({
      entryId: null,
      entryCode: c.code,
      objectLabel: `${c.name_zh} → 删除 Zendesk 目录（Category）`,
      result: '成功',
      message: `删除 Category ${c.zendesk_category_ref}，其下 Section 与 Article 一并移除；本地连带下架 ${cascaded.length} 个场景、断开 ${unmapped ?? 0} 条文章映射`,
      durationMs: Date.now() - started,
      actorName: user.name,
      action: 'category-delete',
      target: 'Category',
    });
    return { ok: true, message: `已删除 Zendesk 目录（Category ${c.zendesk_category_ref}）。` };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await logSync({
      entryId: null,
      entryCode: c.code,
      objectLabel: `${c.name_zh} → 删除 Zendesk 目录（Category）`,
      result: '失败',
      message,
      durationMs: Date.now() - started,
      actorName: user.name,
      action: 'category-delete',
      target: 'Category',
    });
    return { ok: false, message };
  }
}

/** 场景下架 = 先归档该 Section 下已同步的文章，再删除 Section */
async function unpublishScene(r: Row, user: SessionUser): Promise<{ ok: boolean; message: string }> {
  const { rows } = await query<{ zendesk_section_ref: string | null; name_zh: string; code: string }>(
    'SELECT zendesk_section_ref, name_zh, code FROM scenes WHERE id=$1',
    [r.object_id],
  );
  const s = rows[0];
  if (!s) throw new DomainError('场景不存在', 404);

  if (!s.zendesk_section_ref) {
    await query(`UPDATE scenes SET status='offline', active=FALSE, updated_at=now() WHERE id=$1`, [r.object_id]);
    return { ok: true, message: '该场景未同步过 Zendesk，仅本地下架。' };
  }
  const started = Date.now();
  const zd = getZendesk();
  try {
    // 先归档该场景下的已发布知识——直接删 Section 会把文章一起带走，痕迹与状态都对不上
    const { rows: arts } = await query<{ code: string; ref: string }>(
      `SELECT e.code, m.zendesk_article_ref AS ref FROM entries e
       JOIN sync_mappings m ON m.entry_id = e.id
       WHERE e.scene_id=$1 AND m.zendesk_article_ref IS NOT NULL`,
      [r.object_id],
    );
    for (const a of arts) await zd.archiveArticle(a.ref);
    await zd.deleteSection(s.zendesk_section_ref);
    // Zendesk 侧全部落定后才动本地：中途失败时本地零变更，请求留在 pending 可原样重试
    await query(`UPDATE scenes SET status='offline', active=FALSE, zendesk_section_ref=NULL, updated_at=now() WHERE id=$1`, [
      r.object_id,
    ]);
    await query(
      `UPDATE entries SET status='offline', sync_status='none', updated_at=now()
       WHERE scene_id=$1 AND status='published'`,
      [r.object_id],
    );
    // Section 被删，其下文章一并消失——留着映射会让后续同步拿死 id 走更新路径，PUT/POST 双 404
    await query(`DELETE FROM sync_mappings WHERE entry_id IN (SELECT id FROM entries WHERE scene_id=$1)`, [
      r.object_id,
    ]);
    await logSync({
      entryId: null,
      entryCode: s.code,
      objectLabel: `${s.name_zh} → 删除 Zendesk 目录（Section）`,
      result: '成功',
      message: `归档 ${arts.length} 篇文章后删除 Section ${s.zendesk_section_ref}`,
      durationMs: Date.now() - started,
      actorName: user.name,
      action: 'section-delete',
      target: 'Section',
    });
    return {
      ok: true,
      message: `已归档 ${arts.length} 篇文章并删除 Zendesk 目录（Section ${s.zendesk_section_ref}）。`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    await logSync({
      entryId: null,
      entryCode: s.code,
      objectLabel: `${s.name_zh} → 删除 Zendesk 目录（Section）`,
      result: '失败',
      message,
      durationMs: Date.now() - started,
      actorName: user.name,
      action: 'section-delete',
      target: 'Section',
    });
    return { ok: false, message };
  }
}

/** 下架影响面预览：前端二次确认弹窗照这个如实列后果 */
export async function unpublishImpact(
  kind: 'category' | 'scene',
  id: string,
): Promise<{ name: string; scenes: number; entries: number; zendeskRef: string | null; lines: string[] }> {
  if (kind === 'category') {
    const { rows } = await query<{
      name_zh: string;
      zendesk_category_ref: string | null;
      scenes: string;
      entries: string;
    }>(
      `SELECT c.name_zh, c.zendesk_category_ref,
              (SELECT COUNT(*) FROM scenes s WHERE s.category_id=c.id)::text AS scenes,
              (SELECT COUNT(*) FROM entries e WHERE e.category_id=c.id AND e.status='published')::text AS entries
       FROM categories c WHERE c.id=$1`,
      [id],
    );
    const c = rows[0];
    if (!c) throw new DomainError('分类不存在', 404);
    return {
      name: c.name_zh,
      scenes: Number(c.scenes),
      entries: Number(c.entries),
      zendeskRef: c.zendesk_category_ref,
      lines: [
        `本地下架分类「${c.name_zh}」，其下 ${c.scenes} 个问题场景一并下架`,
        c.zendesk_category_ref
          ? `删除 Zendesk 目录 Category ${c.zendesk_category_ref}——Zendesk 会连带删除其下全部 Section 与 Article（不可恢复）`
          : '该分类尚未同步 Zendesk，本次只影响本地',
        `${c.entries} 条已发布知识将不再对客可见`,
      ],
    };
  }
  const { rows } = await query<{ name_zh: string; zendesk_section_ref: string | null; entries: string }>(
    `SELECT s.name_zh, s.zendesk_section_ref,
            (SELECT COUNT(*) FROM entries e WHERE e.scene_id=s.id AND e.status='published')::text AS entries
     FROM scenes s WHERE s.id=$1`,
    [id],
  );
  const s = rows[0];
  if (!s) throw new DomainError('场景不存在', 404);
  return {
    name: s.name_zh,
    scenes: 0,
    entries: Number(s.entries),
    zendeskRef: s.zendesk_section_ref,
    lines: [
      `本地下架场景「${s.name_zh}」`,
      `${s.entries} 条已发布知识会先在 Zendesk 归档（draft=true），随后一并下线`,
      s.zendesk_section_ref
        ? `删除 Zendesk 目录 Section ${s.zendesk_section_ref}（不可恢复）`
        : '该场景尚未同步 Zendesk，本次只影响本地',
    ],
  };
}
