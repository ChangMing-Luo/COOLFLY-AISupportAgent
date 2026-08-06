import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERMISSION_MATRIX,
  ENTRY_STATUS_META,
  bumpVersion,
  canTransition,
  priorVersion,
} from '@kb/contracts';
import { hasPermission } from './rbac.js';
import { diffLines, toHtml, toParagraphs, toPlainText, desensitize } from './content.js';
import { fmtShort, greetingOf } from './fmt.js';

describe('状态机与版本号', () => {
  it('六态文案与 tag 类与原型一致', () => {
    expect(ENTRY_STATUS_META.published.label).toBe('已发布');
    expect(ENTRY_STATUS_META.published.tagClass).toBe('tag-accent');
    expect(ENTRY_STATUS_META.fixing.tagClass).toBe('tag-accent-2');
    expect(ENTRY_STATUS_META.pending.tagClass).toBe('tag-outline');
    expect(ENTRY_STATUS_META.draft.readable).toBe('草稿 · 编辑中，尚未提交审核');
  });

  it('审核通过是大版本 +1，创建修订是小版本 +1', () => {
    expect(bumpVersion('v3.2', true)).toBe('v4.0');
    expect(bumpVersion('v3.2', false)).toBe('v3.3');
    expect(bumpVersion('v0.1', true)).toBe('v1.0');
    expect(priorVersion('v3.2')).toBe('v3.1');
    expect(priorVersion('v3.0')).toBe('v2.0');
  });

  it('非法流转被拒：待审核不可直接回草稿，已下线只能回草稿', () => {
    expect(canTransition('draft', 'pending')).toBe(true);
    expect(canTransition('pending', 'published')).toBe(true);
    expect(canTransition('pending', 'draft')).toBe(false);
    expect(canTransition('offline', 'draft')).toBe(true);
    expect(canTransition('offline', 'published')).toBe(false);
  });
});

describe('权限：审核是单独授予项', () => {
  it('矩阵关闭时，未授权的运营不可审核，已授权的可以', () => {
    const m = structuredClone(DEFAULT_PERMISSION_MATRIX);
    expect(hasPermission(m, 'ops', false, 'review.decide')).toBe(false);
    expect(hasPermission(m, 'ops', true, 'review.decide')).toBe(true);
    expect(hasPermission(m, 'super', true, 'review.decide')).toBe(true);
  });

  it('系统管理对运营恒关，与审核授权无关', () => {
    const m = structuredClone(DEFAULT_PERMISSION_MATRIX);
    expect(hasPermission(m, 'ops', true, 'admin.manage')).toBe(false);
    expect(hasPermission(m, 'super', true, 'admin.manage')).toBe(true);
  });
});

describe('正文与 diff', () => {
  it('纯文本 → HTML 分段，HTML → 段落数组可逆', () => {
    const zh = '一、适用范围。甲。\n\n二、处理规则。乙。';
    const html = toHtml(zh);
    expect(html).toBe('<p>一、适用范围。甲。</p><p>二、处理规则。乙。</p>');
    expect(toParagraphs(html)).toEqual(['一、适用范围。甲。', '二、处理规则。乙。']);
    expect(toHtml(html)).toBe(html);
  });

  it('富文本净化：脚本与事件处理器被剥掉，编辑器白名单节点原样保留', () => {
    // 正文有三条不经 TipTap 的入库路径（一键导入原文 / 采纳向导带入的 Zendesk 会话 / 模型译文），
    // 而详情页是 dangerouslySetInnerHTML 直渲——净化必须在服务端做
    expect(toHtml('<img src=x onerror="alert(1)">')).toBe('<img src="x" />');
    expect(toHtml('<p>正常</p><script>alert(1)</script>')).toBe('<p>正常</p>');
    expect(toHtml('<a href="javascript:alert(1)">点我</a>')).not.toContain('javascript:');
    expect(toHtml('<p onclick="steal()">正文</p>')).toBe('<p>正文</p>');
    // iframe 只放行 YouTube，别的站点一律丢弃
    expect(toHtml('<iframe src="https://evil.example/x"></iframe>')).toBe('');
    expect(toHtml('<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>')).toContain('youtube-nocookie');
    // 白名单节点与外链属性保留（外链补 rel 防反向控制）
    const rich = '<h2>标题</h2><ul><li>项</li></ul><table><tbody><tr><td>格</td></tr></tbody></table>';
    expect(toHtml(rich)).toBe(rich);
    expect(toHtml('<a href="https://coolfly.com">官网</a>')).toContain('rel="noopener noreferrer"');
  });

  it('段落级 diff 用最长公共子序列，未改动段判为 same', () => {
    const before = toHtml(['一、适用范围。', '二、费率。旧口径。', '三、特殊情形。'].join('\n\n'));
    const after = toHtml(['一、适用范围。', '二、费率。新口径。', '三、特殊情形。', '四、生效日期。'].join('\n\n'));
    const lines = diffLines(before, after);
    expect(lines.map((l) => l.type)).toEqual(['same', 'del', 'add', 'same', 'add']);
    expect(lines[1].text).toContain('旧口径');
    expect(lines[2].text).toContain('新口径');
    expect(lines.map((l) => l.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('空线上版本时全部判为新增（首次发布的诚实表现）', () => {
    const lines = diffLines('', toHtml('一、新条目。'));
    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe('add');
  });

  it('列表项与换行不会被吞成一段', () => {
    const html = '<p>甲<br>乙</p><ul><li>丙</li><li>丁</li></ul>';
    expect(toPlainText(html)).toBe('甲\n乙\n\n· 丙\n· 丁');
  });

  it('客诉原文落库前脱敏', () => {
    const raw = '联系 a.b+1@mail.com 或 13812345678，卡号 6222021234567890123';
    const out = desensitize(raw);
    expect(out).not.toContain('a.b+1@mail.com');
    expect(out).not.toContain('13812345678');
    expect(out).toContain('[邮箱已脱敏]');
    expect(out).toContain('[手机号已脱敏]');
    expect(out).toContain('[卡号已脱敏]');
  });
});

describe('展示格式', () => {
  it('列表时间为 MM-DD HH:mm（本地时区）', () => {
    expect(fmtShort('2026-08-04T14:22:00+08:00')).toBe('08-04 14:22');
    expect(fmtShort(null)).toBe('—');
  });

  it('问候语按时段变化', () => {
    expect(greetingOf('陈默', new Date('2026-08-05T09:00:00+08:00'))).toBe('早上好，陈默');
    expect(greetingOf('林静', new Date('2026-08-05T14:00:00+08:00'))).toBe('下午好，林静');
    expect(greetingOf('周迟', new Date('2026-08-05T21:00:00+08:00'))).toBe('晚上好，周迟');
  });
});
