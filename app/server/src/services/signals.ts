/**
 * 信号采集（PRD §4.3 四渠道信号矩阵 / §8.2 指标口径）——08-05-2026 补齐。
 *
 * 修复的缺口：signal_events / entry_effect_metrics / knowledge_gaps /
 * no_result_keywords / coverage_scenes 五张表此前**只在 seed.ts 被写**，
 * 服务端没有任何采集代码——反馈回流与数据看板即使配上 Zendesk 凭据也不会有数据。
 *
 * 确定性档位（PRD §4.3，如实标注不含糊）：
 *   - 必得：文章投票（up/down）、工单 solved/reopen/CSAT、客服 flag
 *   - 待核实：bot 锚点引用、客服面板引用、浏览行为、搜索无结果关键词（依订阅档位）
 * 待核实信号不进任何达标判定，只做趋势参考——本模块把档位一并落库，看板据此标注。
 */
import { TUNABLES } from '@kb/contracts';
import { query, newId } from '../db/pool.js';
import { getZendesk } from '../integrations/zendesk.js';

export interface CollectResult {
  articles: number;
  signals: number;
  gaps: number;
  keywords: number;
  scenes: number;
  degraded: string[];
}

/**
 * 采集一轮（挂 cron，也可手动触发）。
 * 单个条目采集失败不中断整轮——失败项计入 degraded 如实上报。
 */
export async function collectSignals(sinceIso?: string): Promise<CollectResult> {
  const since = sinceIso ?? new Date(Date.now() - 7 * 86400000).toISOString();
  const zd = getZendesk();
  const degraded: string[] = [];

  // ① 条目效果：文章投票（必得）+ 工单解决信号（必得）
  const { rows: mapped } = await query<{ entry_id: string; code: string; zendesk_ref: string }>(
    `SELECT m.entry_id, e.code, m.zendesk_ref
       FROM sync_mappings m JOIN entries e ON e.id = m.entry_id
      WHERE m.zendesk_kind = 'article'`,
  );

  let ticket = { solved: 0, reopened: 0, csatGood: 0, csatBad: 0 };
  try {
    ticket = await zd.fetchTicketSignals(since);
  } catch (err) {
    degraded.push(`工单解决信号采集失败：${(err as Error).message}`);
  }
  // 工单口径解决率：solved / (solved + reopened)，全库共用（条目级为近似归因，看板已标注）
  const ticketTotal = ticket.solved + ticket.reopened;
  const ticketSolveRate = ticketTotal > 0 ? (ticket.solved / ticketTotal) * 100 : null;

  let articles = 0;
  let signals = 0;
  for (const m of mapped) {
    let votes = { up: 0, down: 0 };
    try {
      votes = await zd.fetchArticleVotes(m.zendesk_ref);
    } catch (err) {
      degraded.push(`${m.code} 投票采集失败：${(err as Error).message}`);
      continue;
    }
    const refs = votes.up + votes.down;
    // 引用数低于样本下限不出解决率（PRD §8.2「样本积累中」，防误导性数值）
    const solveRate = refs >= TUNABLES.sampleFloor ? ticketSolveRate : null;
    await query(
      `INSERT INTO entry_effect_metrics (entry_id, bot_refs, agent_refs, downvotes, flags, solve_rate, refreshed_at)
       VALUES ($1,$2,$3,$4,COALESCE((SELECT flags FROM entry_effect_metrics WHERE entry_id=$1),0),$5,now())
       ON CONFLICT (entry_id) DO UPDATE SET
         bot_refs=EXCLUDED.bot_refs, agent_refs=EXCLUDED.agent_refs,
         downvotes=EXCLUDED.downvotes, solve_rate=EXCLUDED.solve_rate, refreshed_at=now()`,
      [m.entry_id, votes.up, 0, votes.down, solveRate === null ? null : solveRate.toFixed(2)],
    );
    articles += 1;

    if (votes.down > 0) {
      await query(
        `INSERT INTO signal_events (id, entry_id, topic, channel, signal_type, certainty, excerpt, occurred_at)
         VALUES ($1,$2,NULL,'帮助中心','文章被踩','必得',$3,now())`,
        [newId('sig'), m.entry_id, `${m.code} 被踩 ${votes.down} 次（本轮采集，赞 ${votes.up}）`],
      );
      signals += 1;
    }
  }

  if (ticketTotal > 0) {
    await query(
      `INSERT INTO signal_events (id, entry_id, topic, channel, signal_type, certainty, excerpt, occurred_at)
       VALUES ($1,NULL,$2,'邮件 + 转人工','工单解决信号','必得',$3,now())`,
      [
        newId('sig'),
        '工单解决与满意度',
        `solved ${ticket.solved} / reopen ${ticket.reopened}；CSAT 好评 ${ticket.csatGood} / 差评 ${ticket.csatBad}`,
      ],
    );
    signals += 1;
  }

  // ② 搜索无结果关键词（档位相关，不可得时如实标注不编数）
  let keywords = 0;
  try {
    const rows = await zd.fetchNoResultSearches(since);
    if (rows.length === 0) {
      degraded.push('搜索无结果关键词：当前订阅/接口不可得（Explore 能力），本轮未采集——看板如实标「待核实」');
    }
    for (const k of rows) {
      const { rows: hit } = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM entries WHERE status='published' AND (title ILIKE $1 OR labels::text ILIKE $1)`,
        [`%${k.keyword}%`],
      );
      const verdict = Number(hit[0]!.n) > 0 ? '有条目但命名不匹配' : '无对应条目';
      await query(
        `INSERT INTO no_result_keywords (id, keyword, weekly_count, verdict, level)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (keyword) DO UPDATE SET weekly_count=EXCLUDED.weekly_count, verdict=EXCLUDED.verdict, level=EXCLUDED.level`,
        [newId('nrk'), k.keyword, k.count, verdict, k.count >= 20 ? 'bad' : 'warn'],
      );
      keywords += 1;
    }
  } catch (err) {
    degraded.push(`搜索无结果关键词采集失败：${(err as Error).message}`);
  }

  // ③ 场景覆盖：条目按一级场景分布（本台自有数据，必得）
  const { rows: sceneRows } = await query<{ scene_l1: string; n: string }>(
    `SELECT scene_l1, COUNT(*)::text AS n FROM entries
      WHERE status='published' AND scene_l1 <> '' GROUP BY scene_l1 ORDER BY scene_l1`,
  );
  const total = sceneRows.reduce((n, r) => n + Number(r.n), 0);
  let scenes = 0;
  for (const [i, r] of sceneRows.entries()) {
    const pct = total > 0 ? Math.round((Number(r.n) / total) * 100) : 0;
    await query(
      `INSERT INTO coverage_scenes (id, name, entry_count, coverage_pct, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO UPDATE SET entry_count=EXCLUDED.entry_count, coverage_pct=EXCLUDED.coverage_pct`,
      [newId('scn'), r.scene_l1, Number(r.n), pct, i],
    );
    scenes += 1;
  }

  // ④ 知识缺口：被踩多但无高解决率的条目 → 修订；无结果关键词无对应条目 → 立新条
  let gaps = 0;
  const { rows: weak } = await query<{ code: string; title: string; downvotes: number }>(
    `SELECT e.code, e.title, m.downvotes
       FROM entry_effect_metrics m JOIN entries e ON e.id = m.entry_id
      WHERE m.downvotes > 0 ORDER BY m.downvotes DESC LIMIT 10`,
  );
  for (const w of weak) {
    await query(
      `INSERT INTO knowledge_gaps (id, topic, weekly_count, source_split, coverage_verdict, action)
       VALUES ($1,$2,$3,$4,'已覆盖但答不好','挂为修订建议')
       ON CONFLICT (topic) DO UPDATE SET weekly_count=EXCLUDED.weekly_count, source_split=EXCLUDED.source_split`,
      [newId('gap'), `${w.code} ${w.title}`, String(w.downvotes), `帮助中心被踩 ${w.downvotes} 次`],
    );
    gaps += 1;
  }
  const { rows: uncovered } = await query<{ keyword: string; weekly_count: number }>(
    `SELECT keyword, weekly_count FROM no_result_keywords WHERE verdict='无对应条目' ORDER BY weekly_count DESC LIMIT 10`,
  );
  for (const u of uncovered) {
    await query(
      `INSERT INTO knowledge_gaps (id, topic, weekly_count, source_split, coverage_verdict, action)
       VALUES ($1,$2,$3,$4,'未覆盖','起草新条目')
       ON CONFLICT (topic) DO UPDATE SET weekly_count=EXCLUDED.weekly_count, source_split=EXCLUDED.source_split`,
      [newId('gap'), `搜索无结果：${u.keyword}`, String(u.weekly_count), `帮助中心搜索 ${u.weekly_count} 次/周`],
    );
    gaps += 1;
  }

  return { articles, signals, gaps, keywords, scenes, degraded };
}
