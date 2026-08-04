import { canTransitionEn, zhCN, type EnStatus, type EntryBody, type SessionUser } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { writeAudit } from '../core/audit.js';
import { getLlm } from '../integrations/llm.js';
import { DomainError } from './entries.js';

interface Row {
  id: string;
  code: string;
  title: string;
  body: EntryBody;
  en_status: EnStatus;
}

async function load(entryId: string): Promise<Row> {
  const { rows } = await query<Row>('SELECT id, code, title, body, en_status FROM entries WHERE id=$1', [entryId]);
  const e = rows[0];
  if (!e) throw new DomainError('条目不存在', 404);
  return e;
}

async function setEnStatus(entryId: string, from: EnStatus, to: EnStatus): Promise<void> {
  if (!canTransitionEn(from, to)) {
    throw new DomainError(`英文状态非法流转：${from} → ${to}`, 409);
  }
  await query('UPDATE entries SET en_status=$2, updated_at=now() WHERE id=$1', [entryId, to]);
}

export async function listPairs(entryId: string): Promise<
  Array<{ id: string; paragraphId: string; zh: string; en: string | null; internal: boolean; humanEdited: boolean; editNote: string | null }>
> {
  const { rows } = await query<{
    id: string; paragraph_id: string; zh_text: string; en_text: string | null; internal: boolean; human_edited: boolean; edit_note: string | null;
  }>('SELECT * FROM translation_pairs WHERE entry_id=$1 ORDER BY seq', [entryId]);
  return rows.map((p) => ({
    id: p.id,
    paragraphId: p.paragraph_id,
    zh: p.zh_text,
    en: p.en_text,
    internal: p.internal,
    humanEdited: p.human_edited,
    editNote: p.edit_note,
  }));
}

/** 触发 AI 翻译：内部段落跳过（不翻译、不同步）；失败保留上次英文并阻断同步 */
export async function translate(user: SessionUser, entryId: string): Promise<{ enStatus: EnStatus }> {
  const e = await load(entryId);
  await setEnStatus(entryId, e.en_status, 'translating');
  const llm = getLlm();
  const segments = e.body.paragraphs
    .filter((p) => !p.internal)
    .map((p) => ({ paragraphId: p.id, zh: p.text }));
  try {
    const result = await llm.translateToEnglish(segments);
    const map = new Map(result.map((r) => [r.paragraphId, r.en]));
    await query('DELETE FROM translation_pairs WHERE entry_id=$1', [entryId]);
    let seq = 0;
    for (const p of e.body.paragraphs) {
      await query(
        `INSERT INTO translation_pairs (id, entry_id, paragraph_id, seq, zh_text, en_text, internal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId('pair'), entryId, p.id, seq, p.text, p.internal ? null : (map.get(p.id) ?? null), p.internal],
      );
      seq += 1;
    }
    await setEnStatus(entryId, 'translating', 'pending_human');
    await writeAudit(user, {
      objectType: 'entry', objectId: entryId, objectLabel: `${e.code} ${e.title}`,
      action: 'AI 翻译', category: 'content', field: '英文状态', before: e.en_status, after: 'pending_human',
      note: `${zhCN.translation.internalSkip}；provider=${llm.mode}`,
    });
    return { enStatus: 'pending_human' };
  } catch (err) {
    await setEnStatus(entryId, 'translating', 'failed');
    await writeAudit(user, {
      objectType: 'entry', objectId: entryId, objectLabel: `${e.code} ${e.title}`,
      action: '翻译失败', category: 'content', field: '英文状态', before: 'translating', after: 'failed',
      note: `${(err as Error).message}；保留上次英文内容，同步阻断，可重试`,
    });
    return { enStatus: 'failed' };
  }
}

/** 人工逐段修订（可修正表述，不得改政策口径；修订留痕） */
export async function editPair(
  user: SessionUser,
  entryId: string,
  pairId: string,
  enText: string,
  note: string,
): Promise<void> {
  const { rows } = await query<{ en_text: string | null; zh_text: string }>(
    'SELECT en_text, zh_text FROM translation_pairs WHERE id=$1 AND entry_id=$2',
    [pairId, entryId],
  );
  const p = rows[0];
  if (!p) throw new DomainError('段落不存在', 404);
  await query(
    'UPDATE translation_pairs SET en_text=$2, human_edited=TRUE, edit_note=$3, updated_at=now() WHERE id=$1',
    [pairId, enText, note],
  );
  const e = await load(entryId);
  await writeAudit(user, {
    objectType: 'entry', objectId: entryId, objectLabel: `${e.code} ${e.title}`,
    action: '人工修订英文', category: 'content', field: '英文段落',
    before: p.en_text ?? '（空）', after: enText, note,
  });
}

/** 标记已确认——人工校验 100% 铁律的唯一放行点 */
export async function confirmTranslation(user: SessionUser, entryId: string): Promise<{ enStatus: EnStatus }> {
  const e = await load(entryId);
  const { rows } = await query<{ missing: string }>(
    `SELECT COUNT(*)::text AS missing FROM translation_pairs WHERE entry_id=$1 AND internal=FALSE AND (en_text IS NULL OR en_text='')`,
    [entryId],
  );
  if (Number(rows[0]?.missing ?? '0') > 0) {
    throw new DomainError('仍有非内部段落未生成英文，无法确认', 409);
  }
  await setEnStatus(entryId, e.en_status, 'confirmed');
  await query(`UPDATE entries SET blocked_reason=NULL WHERE id=$1`, [entryId]);
  await writeAudit(user, {
    objectType: 'entry', objectId: entryId, objectLabel: `${e.code} ${e.title}`,
    action: '英文人工校验确认', category: 'content', field: '英文状态', before: e.en_status, after: 'confirmed',
    note: zhCN.translation.confirmRequired,
  });
  return { enStatus: 'confirmed' };
}
