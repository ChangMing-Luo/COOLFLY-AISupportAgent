import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERMISSION_MATRIX,
  PERMISSIONS,
  ROLES,
  canTransitionEntry,
  canTransitionEn,
  enAllowsSync,
  TUNABLES,
} from '@kb/contracts';
import { desensitize, hasInternal, stripInternal, toPublicHtml, toInternalHtml, contentHash } from './content.js';
import { runPublishGate } from './gate.js';

const body = {
  paragraphs: [
    { id: 'p0', text: '退款时限', html: '', internal: false, heading: true },
    { id: 'p1', text: '质量问题：签收后 30 天内可申请全额退款。', html: '', internal: false, heading: false },
    { id: 'p2', text: '内部：超时个案走主管审批，额度上限 $80。', html: '', internal: true, heading: false },
  ],
};

describe('内部段落剥离（RULE-04 数据泄漏级零容忍）', () => {
  it('stripInternal 过滤全部内部段落', () => {
    const kept = stripInternal(body);
    expect(kept).toHaveLength(2);
    expect(kept.every((p) => !p.internal)).toBe(true);
  });

  it('对外 HTML 不含任何内部段落原文', () => {
    const html = toPublicHtml(body);
    expect(html).toContain('质量问题');
    expect(html).not.toContain('主管审批');
    expect(html).not.toContain('$80');
  });

  it('内部渠道 HTML 保留内部段落并带标记', () => {
    const html = toInternalHtml(body);
    expect(html).toContain('主管审批');
    expect(html).toContain('class="internal"');
  });

  it('HTML 转义防注入', () => {
    const html = toPublicHtml({ paragraphs: [{ id: 'x', text: '<script>alert(1)</script>', html: '', internal: false, heading: false }] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('富文本段落：对外正文保留 html 标记，内部段落整段不进对外产物', () => {
    const rich = {
      paragraphs: [
        { id: 'p0', text: '夜视模糊排查', html: '<h2>夜视模糊排查</h2>', internal: false, heading: true },
        { id: 'p1', text: '先擦净镜头保护罩。', html: '<p>先<strong>擦净</strong>镜头保护罩。</p>', internal: false, heading: false },
        { id: 'p2', text: '内部：第三次返修走整机换新。', html: '<p>内部：第三次返修走整机换新。</p>', internal: true, heading: false },
      ],
    };
    const pub = toPublicHtml(rich);
    expect(pub, '富文本标记须原样保留，否则加粗/标题在 Zendesk 端会丢').toContain('<strong>擦净</strong>');
    expect(pub).toContain('<h2>夜视模糊排查</h2>');
    expect(pub, '内部段落原文不得出现在对外正文（RULE-04 零容忍）').not.toContain('整机换新');
    // 内部渠道保留全部段落并标注 internal
    const inner = toInternalHtml(rich);
    expect(inner).toContain('整机换新');
    expect(inner).toContain('class="internal"');
  });

  it('html 为空的机器产出段落仍走转义回退（导入/drift 拉回/挖掘起草）', () => {
    const pub = toPublicHtml({
      paragraphs: [{ id: 'p0', text: '<img src=x onerror=alert(1)>', html: '', internal: false, heading: false }],
    });
    expect(pub).not.toContain('<img');
    expect(pub).toContain('&lt;img');
  });

  it('hasInternal 识别混合条目', () => {
    expect(hasInternal(body)).toBe(true);
    expect(hasInternal({ paragraphs: [{ id: 'a', text: 'x', html: '', internal: false, heading: false }] })).toBe(false);
  });
});

describe('脱敏管道（RULE-05：原文不落库）', () => {
  it('邮箱 / SN / Wi-Fi / 手机号全部打码', () => {
    const raw = '用户 sarah.lee@example.com 报修，SN: CF2024XZ8891，家里 Wi-Fi：Sarah_Home_5G，电话 13800138000';
    const out = desensitize(raw);
    expect(out).not.toContain('sarah.lee@example.com');
    expect(out).not.toContain('CF2024XZ8891');
    expect(out).not.toContain('Sarah_Home_5G');
    expect(out).not.toContain('13800138000');
    expect(out).toContain('[邮箱已脱敏]');
    expect(out).toContain('SN:[已脱敏]');
  });

  it('无敏感信息时原样保留', () => {
    expect(desensitize('太阳能板阴天充不满电')).toBe('太阳能板阴天充不满电');
  });
});

describe('发布门禁三查（AC-P-12 rev6：08-05-2026 由四查收敛）', () => {
  const base = {
    title: '退款政策',
    chapterId: 'ch_refund',
    visibility: 'mixed' as const,
    labels: ['退款'],
    body,
    enStatus: 'confirmed' as const,
    enTitle: 'Refund policy',
  };

  it('三项全过才 passed，且门禁不再产出任何检索代理指标', () => {
    const r = runPublishGate(base);
    expect(r.passed).toBe(true);
    expect(r.checks).toHaveLength(3);
    expect(r.checks.map((c) => c.key)).toEqual(['fields', 'internal', 'english']);
    expect(JSON.stringify(r)).not.toContain('代理');
  });

  it('英文未确认 → 阻断（人工校验 100% 铁律）', () => {
    const r = runPublishGate({ ...base, enStatus: 'pending_human' });
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.key === 'english')?.passed).toBe(false);
  });

  it('英文标题缺失 → 阻断（英文读者会看到中文标题）', () => {
    for (const enTitle of [null, '', '   ']) {
      const r = runPublishGate({ ...base, enTitle });
      expect(r.passed).toBe(false);
      const en = r.checks.find((c) => c.key === 'english');
      expect(en?.passed).toBe(false);
      expect(en?.detail).toContain('英文标题缺失');
    }
  });

  it('字段缺失 → 阻断', () => {
    const r = runPublishGate({ ...base, labels: [] });
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.key === 'fields')?.detail).toContain('标签');
  });

  it('混合可见性但无内部段落标记 → 阻断', () => {
    const r = runPublishGate({
      ...base,
      body: { paragraphs: [{ id: 'a', text: '纯对外内容', html: '', internal: false, heading: false }] },
    });
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.key === 'internal')?.passed).toBe(false);
  });
});

describe('权限矩阵（RULE-01：10 项 × 4 角色）', () => {
  it('矩阵覆盖全部权限点与角色', () => {
    expect(PERMISSIONS).toHaveLength(10);
    expect(ROLES).toHaveLength(4);
    for (const p of PERMISSIONS) {
      for (const r of ROLES) {
        expect(typeof DEFAULT_PERMISSION_MATRIX[p][r]).toBe('boolean');
      }
    }
  });

  it('知识管理员不可审核 / 发布 / 回滚（统一过审铁律）', () => {
    expect(DEFAULT_PERMISSION_MATRIX['review.decide'].kb_manager).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX.publish.kb_manager).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX['version.rollback'].kb_manager).toBe(false);
  });

  it('AI 运营只读 + 建议', () => {
    expect(DEFAULT_PERMISSION_MATRIX['entry.write'].ai_ops).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX['review.decide'].ai_ops).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX.publish.ai_ops).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX['metrics.view'].ai_ops).toBe(true);
    expect(DEFAULT_PERMISSION_MATRIX['suggestion.submit'].ai_ops).toBe(true);
  });

  it('系统管理员管人不管内容（职责分离）', () => {
    expect(DEFAULT_PERMISSION_MATRIX['rbac.manage'].sys_admin).toBe(true);
    expect(DEFAULT_PERMISSION_MATRIX['entry.write'].sys_admin).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX['review.decide'].sys_admin).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX.publish.sys_admin).toBe(false);
    expect(DEFAULT_PERMISSION_MATRIX['suggestion.submit'].sys_admin).toBe(false);
  });

  it('只有知识审核员可发布与回滚', () => {
    const publishers = ROLES.filter((r) => DEFAULT_PERMISSION_MATRIX.publish[r]);
    expect(publishers).toEqual(['kb_reviewer']);
    const rollbackers = ROLES.filter((r) => DEFAULT_PERMISSION_MATRIX['version.rollback'][r]);
    expect(rollbackers).toEqual(['kb_reviewer']);
  });
});

describe('状态机守卫（技术方案 §4.2）', () => {
  it('草稿不可直接跳到已发布（无人审不生效）', () => {
    expect(canTransitionEntry('draft', 'published')).toBe(false);
    expect(canTransitionEntry('pending_review', 'published')).toBe(false);
    expect(canTransitionEntry('approved', 'published')).toBe(true);
  });

  it('英文状态：未生成不可直接确认', () => {
    expect(canTransitionEn('none', 'confirmed')).toBe(false);
    expect(canTransitionEn('pending_human', 'confirmed')).toBe(true);
  });

  it('enAllowsSync 只放行已确认与已同步', () => {
    expect(enAllowsSync('confirmed')).toBe(true);
    expect(enAllowsSync('synced')).toBe(true);
    expect(enAllowsSync('pending_human')).toBe(false);
    expect(enAllowsSync('stale')).toBe(false);
    expect(enAllowsSync('failed')).toBe(false);
  });
});

describe('建议值参数与哈希', () => {
  it('查重线与频次阈值按 v3 定稿', () => {
    expect(TUNABLES.dedupeThreshold).toBe(0.85);
    expect(TUNABLES.frequencyThreshold).toBe(10);
    expect(TUNABLES.syncRetryLimit).toBe(3);
    expect(TUNABLES.sampleFloor).toBe(10);
  });

  it('内容哈希对空白不敏感、对内容敏感（drift 比对基准）', () => {
    expect(contentHash('退款 5 天')).toBe(contentHash('  退款   5 天 '));
    expect(contentHash('退款 5 天')).not.toBe(contentHash('退款 7 天'));
  });
});
