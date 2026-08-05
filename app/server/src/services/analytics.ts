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
 * 场景覆盖率的口径（真实可算，不用常量）：
 * 单场景 = 已发布知识数 /（已发布知识数 + 该场景待处理未命中数）；
 * 总体   = 已有已发布知识的场景数 / 全部启用场景数。
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

  const { rows: sceneRows } = await query<{ id: string; name_zh: string; published: string; misses: string }>(
    `SELECT s.id, s.name_zh,
            (SELECT COUNT(*) FROM entries e WHERE e.scene_id=s.id AND e.status='published')::text AS published,
            (SELECT COUNT(*) FROM misses m WHERE m.scene_id=s.id AND m.state='open')::text AS misses
     FROM scenes s WHERE s.active ORDER BY s.sort_order`,
  );
  const scenes = sceneRows.map((s) => {
    const pub = Number(s.published);
    const miss = Number(s.misses);
    const v = pub + miss === 0 ? 0 : Math.round((pub / (pub + miss)) * 100);
    return { label: s.name_zh, value: `${v}%`, pct: `${v}%` };
  });
  const covered = sceneRows.filter((s) => Number(s.published) > 0).length;
  const coverage = sceneRows.length ? Math.round((covered / sceneRows.length) * 100) : 0;

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
      { label: '场景覆盖率', value: `${coverage}%`, delta: `${covered} / ${sceneRows.length} 个二级场景已有已发布知识` },
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
