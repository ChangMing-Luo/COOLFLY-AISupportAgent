/**
 * Zendesk 工单快照同步（08-05-2026 新增）——只读拉取，不写 Zendesk。
 *
 * 为什么落原始快照而不是直接算统计：
 * 增量导出只能沿游标向前推进，历史重拉代价极高。若像 signals.ts 那样
 * 「拉一条算一条直接 UPSERT 进统计表」，口径一改（例如场景分类换字段）
 * 就必须重拉全量。快照层让口径变更退化为一条重算 SQL。
 *
 * 游标语义（Zendesk 官方）：首次传 start_time，之后传 after_cursor，
 * 只认 end_of_stream 判完——count 不是可靠的完成标志。
 */
import { query } from '../db/pool.js';
import { getZendesk, type ZendeskTicketSnapshot } from '../integrations/zendesk.js';

const SOURCE_KEY = 'zendesk_tickets';

/** 单轮页数上限：防拉取失控。触顶不静默——如实回传 capped 由界面标注。 */
const MAX_PAGES_PER_RUN = 50;

/** 首次同步的回看窗口（无游标时生效） */
const INITIAL_LOOKBACK_DAYS = 30;

export interface TicketSyncResult {
  pages: number;
  tickets: number;
  endOfStream: boolean;
  capped: boolean;
  degraded: string[];
}

async function loadCursor(): Promise<string | null> {
  const { rows } = await query<{ cursor: string | null }>(
    'SELECT cursor FROM sync_cursors WHERE source_key=$1',
    [SOURCE_KEY],
  );
  return rows[0]?.cursor ?? null;
}

async function saveCursor(cursor: string | null, endOfStream: boolean, error: string | null): Promise<void> {
  await query(
    `INSERT INTO sync_cursors (source_key, cursor, end_of_stream, last_run_at, last_error)
     VALUES ($1,$2,$3,now(),$4)
     ON CONFLICT (source_key) DO UPDATE SET
       cursor=EXCLUDED.cursor, end_of_stream=EXCLUDED.end_of_stream,
       last_run_at=now(), last_error=EXCLUDED.last_error`,
    [SOURCE_KEY, cursor, endOfStream, error],
  );
}

async function upsertTicket(t: ZendeskTicketSnapshot): Promise<void> {
  await query(
    `INSERT INTO zendesk_tickets (
       ticket_id, status, channel, subject, tags, custom_fields, ticket_form_id, group_id,
       satisfaction_score, reopens, replies, full_resolution_min, created_at, updated_at, solved_at, snapshot_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (ticket_id) DO UPDATE SET
       status=EXCLUDED.status, channel=EXCLUDED.channel, subject=EXCLUDED.subject,
       tags=EXCLUDED.tags, custom_fields=EXCLUDED.custom_fields,
       ticket_form_id=EXCLUDED.ticket_form_id, group_id=EXCLUDED.group_id,
       satisfaction_score=EXCLUDED.satisfaction_score,
       reopens=EXCLUDED.reopens, replies=EXCLUDED.replies,
       full_resolution_min=EXCLUDED.full_resolution_min,
       updated_at=EXCLUDED.updated_at, solved_at=EXCLUDED.solved_at, snapshot_at=now()`,
    [
      t.id, t.status, t.channel, t.subject,
      JSON.stringify(t.tags), JSON.stringify(t.customFields),
      t.ticketFormId, t.groupId, t.satisfactionScore,
      t.reopens, t.replies, t.fullResolutionMin,
      t.createdAt, t.updatedAt, t.solvedAt,
    ],
  );
}

/**
 * 拉一轮工单快照。断点续传：每页落库后立刻推进游标，
 * 中途失败下一轮从断点继续，不重头也不跳页。
 */
export async function syncTickets(): Promise<TicketSyncResult> {
  const zd = getZendesk();
  const degraded: string[] = [];
  let cursor = await loadCursor();
  const startTimeSec = cursor
    ? undefined
    : Math.floor(Date.now() / 1000) - INITIAL_LOOKBACK_DAYS * 86400;

  let pages = 0;
  let tickets = 0;
  let endOfStream = false;

  while (pages < MAX_PAGES_PER_RUN) {
    let page;
    try {
      page = await zd.fetchTicketPage({ startTimeSec, cursor });
    } catch (err) {
      const msg = (err as Error).message;
      degraded.push(`第 ${pages + 1} 页拉取失败：${msg}`);
      await saveCursor(cursor, false, msg);
      return { pages, tickets, endOfStream: false, capped: false, degraded };
    }

    for (const t of page.tickets) {
      try {
        await upsertTicket(t);
        tickets += 1;
      } catch (err) {
        degraded.push(`工单 ${t.id} 落库失败：${(err as Error).message}`);
      }
    }
    pages += 1;
    cursor = page.afterCursor;
    endOfStream = page.endOfStream;
    await saveCursor(cursor, endOfStream, null);

    if (endOfStream || !cursor) break;
  }

  const capped = !endOfStream && pages >= MAX_PAGES_PER_RUN;
  if (capped) {
    degraded.push(`本轮拉满 ${MAX_PAGES_PER_RUN} 页上限，仍未到流末尾——剩余数据下一轮从游标继续`);
  }
  return { pages, tickets, endOfStream, capped, degraded };
}
