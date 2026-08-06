import { TUNABLES } from '@kb/contracts';
import { query } from '../db/pool.js';
import { listEntries, toDto, type EntryDto } from './entries.js';

export interface HealthDto {
  kpis: Array<{ label: string; value: string | number; delta: string }>;
  dist: Array<{ label: string; n: number }>;
  scenes: Array<{ label: string; value: string; pct: string }>;
  risky: Array<{ code: string; score: number; title: string; reason: string; high: boolean }>;
}

/**
 * 场景覆盖率（08-06-2026 用户拍板的口径）：
 *
 *   总体覆盖率 = 知识库已覆盖的场景数 ÷ Zendesk 客诉会话中出现的场景总数
 *
 * 「客诉会话中出现的场景」= 已建场景 ∪ 抽取候选里模型判定但库内还没有的场景（`scene_hint`）
 * ∪ 未命中问题所指向的场景。分母因此会大于库内场景数——50 个场景对上 100 个真实场景就是 50%。
 * 单场景那一列仍给「该场景已发布知识数」的相对饱和度，用于看哪些场景内容太薄。
 */
export async function healthReport(): Promise<HealthDto> {
  const all = await listEntries('');
  const dtos = all.map(toDto);
  const live = dtos.filter((d) => d.status !== 'offline');

  const avgQuality = live.length ? Math.round(live.reduce((a, d) => a + d.quality, 0) / live.length) : 0;
  const withAdopt = dtos.filter((d) => d.adopt > 0);
  const avgAdopt = withAdopt.length
    ? Math.round(withAdopt.reduce((a, d) => a + d.adopt, 0) / withAdopt.length)
    : 0;

  const { rows: sceneRows } = await query<{ id: string; name_zh: string; published: string }>(
    `SELECT s.id, s.name_zh,
            (SELECT COUNT(*) FROM entries e WHERE e.scene_id=s.id AND e.status='published')::text AS published
     FROM scenes s WHERE s.active ORDER BY s.sort_order`,
  );
  const maxPub = Math.max(1, ...sceneRows.map((s) => Number(s.published)));
  const scenes = sceneRows.map((s) => {
    const pub = Number(s.published);
    const v = Math.round((pub / maxPub) * 100);
    return { label: s.name_zh, value: pub === 0 ? '未覆盖' : `${pub} 条`, pct: `${v}%` };
  });

  // 分母：客诉会话里出现过的场景总数 = 库内场景 ∪ 抽取候选里模型判定的新场景 ∪ 未命中指向的场景
  const { rows: unknownRows } = await query<{ n: string }>(
    `SELECT COUNT(DISTINCT hint)::text AS n FROM (
       SELECT btrim(scene_hint) AS hint FROM extract_candidates
        WHERE btrim(scene_hint) <> ''
          AND NOT EXISTS (SELECT 1 FROM scenes s WHERE s.name_zh = btrim(extract_candidates.scene_hint))
       UNION
       SELECT btrim(question) AS hint FROM misses
        WHERE scene_id IS NULL AND btrim(question) <> ''
     ) t`,
  );
  const observedUnknown = Number(unknownRows[0]?.n ?? 0);
  const covered = sceneRows.filter((s) => Number(s.published) > 0).length;
  const observedTotal = sceneRows.length + observedUnknown;
  const coverage = observedTotal ? Math.round((covered / observedTotal) * 100) : 0;

  const count = (s: string): number => dtos.filter((d) => d.status === s).length;

  const risky = dtos
    .filter(
      (d) =>
        d.status !== 'offline' &&
        ((d.status === 'published' && d.adopt < TUNABLES.riskyAdoptPct) || d.confidence < TUNABLES.riskyConfidence),
    )
    .sort((a, b) => a.confidence - b.confidence)
    .map((d) => ({
      code: d.code,
      score: d.quality,
      title: d.titleZh,
      high: d.status === 'published' && d.adopt < 40,
      reason:
        d.status === 'published' && d.adopt < TUNABLES.riskyAdoptPct
          ? `采纳率偏低（${d.adopt}%），建议复核或回滚至更优版本`
          : `召回置信偏低（${Math.round(d.confidence * 100)}%），建议补充内容与同义表达`,
    }));

  return {
    kpis: [
      { label: '平均健康度', value: avgQuality, delta: `${live.length} 条在架知识参与计算` },
      { label: '平均采纳率', value: `${avgAdopt}%`, delta: `${withAdopt.length} 条有采纳数据` },
      {
        label: '场景覆盖率',
        value: `${coverage}%`,
        delta: `已覆盖 ${covered} 个 ÷ 客诉中出现 ${observedTotal} 个（含 ${observedUnknown} 个库内尚无的场景）`,
      },
    ],
    dist: [
      { label: '已发布', n: count('published') },
      { label: '待审核', n: count('pending') },
      { label: '草稿', n: count('draft') },
      { label: '修复中', n: count('fixing') },
      { label: '已下线', n: count('offline') },
    ],
    scenes,
    risky,
  };
}

export type { EntryDto };
