import {
  enAllowsSync,
  zhCN,
  type EnStatus,
  type GateResult,
  type Visibility,
  type EntryBody,
} from '@kb/contracts';
import { hasInternal, stripInternal, toPublicHtml } from './content.js';

export interface GateInput {
  title: string;
  chapterId: string;
  visibility: Visibility;
  labels: string[];
  body: EntryBody;
  enStatus: EnStatus;
}

/**
 * 发布门禁三查（技术方案 §6.6）——全过才置「已发布」并写同步任务，
 * 同事务收口，不存在「门禁不过但已入队」中间态。
 * 原第④查「代理评测（本台向量检索召回验证）」于 08-05-2026 随向量能力删除一并退役：
 * 真实检索由 Zendesk AI 承担，本台不再自建任何检索代理指标。
 */
export function runPublishGate(input: GateInput): GateResult {
  const checks: GateResult['checks'] = [];

  // ① 格式与字段完整性
  const missing: string[] = [];
  if (!input.title.trim()) missing.push('标题');
  if (!input.chapterId) missing.push('章节');
  if (!input.visibility) missing.push('可见性');
  if (input.labels.length === 0) missing.push('标签');
  checks.push({
    key: 'fields',
    label: zhCN.gate.fields,
    passed: missing.length === 0,
    detail: missing.length === 0 ? '标题/章节/可见性/标签均已填写' : `缺失字段：${missing.join('、')}`,
    hard: true,
  });

  // ② 敏感信息与内部口径：混合条目内部段落必须已标记，剥离产物不得含内部内容
  const internalPresent = hasInternal(input.body);
  const publicHtml = toPublicHtml(input.body);
  const internalTexts = input.body.paragraphs.filter((p) => p.internal).map((p) => p.text);
  const leaked = internalTexts.some((t) => t.trim().length > 0 && publicHtml.includes(t.trim()));
  const internalOk =
    !leaked && (input.visibility !== 'mixed' || internalPresent) && stripInternal(input.body).length > 0;
  checks.push({
    key: 'internal',
    label: zhCN.gate.internal,
    passed: internalOk,
    detail: leaked
      ? '剥离产物仍含内部段落文本——内部口径外泄风险，阻断'
      : input.visibility === 'mixed' && !internalPresent
        ? '可见性为「对外公开 + 内部段落」但正文未标记任何内部段落'
        : stripInternal(input.body).length === 0
          ? '剥离内部段落后对外正文为空'
          : '内部段落已标记，剥离产物不含内部内容',
    hard: true,
  });

  // ③ 英文版本状态：未「已确认」→ 阻断
  const enOk = enAllowsSync(input.enStatus);
  checks.push({
    key: 'english',
    label: zhCN.gate.english,
    passed: enOk,
    detail: enOk ? '英文已确认，可随同步推送 en-us' : '英文未确认——同步将被阻断（人工校验 100% 铁律）',
    hard: true,
  });

  return {
    passed: checks.every((c) => !c.hard || c.passed),
    checks,
  };
}
