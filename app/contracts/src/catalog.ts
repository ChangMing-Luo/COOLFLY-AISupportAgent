/**
 * 目录基线与固定文案。
 * 来源：doc/v4/spec/prototype.logic.js —— CATALOG(1-14) / TITLE_EN(26-39) / 抽取配置(554)。
 * 这些是**种子基线**，运行期以数据库为准（分类与场景可在元数据中心增删改）。
 */

export interface SeedScene {
  zh: string;
  en: string;
}
export interface SeedCategory {
  zh: string;
  en: string;
  scenes: SeedScene[];
}

export const CATALOG: SeedCategory[] = [
  {
    zh: '机票 · 售后',
    en: 'Air Ticket · After-sales',
    scenes: [
      { zh: '改签退票', en: 'Rebooking & Refund' },
      { zh: '退款处理', en: 'Refund Processing' },
    ],
  },
  {
    zh: '机票 · 出行前',
    en: 'Air Ticket · Pre-trip',
    scenes: [
      { zh: '值机登机', en: 'Check-in & Boarding' },
      { zh: '行李服务', en: 'Baggage Service' },
      { zh: '特殊旅客', en: 'Special Passengers' },
    ],
  },
  {
    zh: '机票 · 异常处理',
    en: 'Air Ticket · Irregularity',
    scenes: [{ zh: '航班异常', en: 'Flight Irregularity' }],
  },
  {
    zh: '会员 · 权益',
    en: 'Membership · Benefits',
    scenes: [{ zh: '会员权益', en: 'Membership Benefits' }],
  },
  {
    zh: '酒店 · 订单',
    en: 'Hotel · Orders',
    scenes: [{ zh: '酒店订单', en: 'Hotel Order' }],
  },
  {
    zh: '支付 · 财务',
    en: 'Payment · Billing',
    scenes: [{ zh: '支付与发票', en: 'Payment & Invoice' }],
  },
];

/** 抽取配置卡（原型固定四行，来源与阈值由环境配置驱动） */
export const EXTRACT_CONFIG_LABELS = {
  source: '来源',
  model: '抽取模型',
  threshold: '置信度阈值',
  dedupe: '查重相似度',
} as const;

/** 编辑器快捷标签建议池（原型 edVals.tagSug） */
export const TAG_SUGGESTIONS = ['退票', '国际机票', '费率表', '不可抗力'] as const;

/** 审核快捷驳回语（原型 rvVals.quick） */
export const REJECT_QUICK_REASONS = [
  '费率与新政策不符',
  '缺少生效日期',
  '英文翻译有误',
  '话术过长需精简',
] as const;

/** 未命中处理流程五步（原型 drawerVals miss.steps） */
export const MISS_STEPS = [
  { label: '登记未命中问题', desc: '召回为空或低置信的提问自动聚类到此，并生成 AI 摘要。' },
  { label: '新建条目 · 撰写新知识', desc: '直接新建草稿，用新知识覆盖该未命中场景。' },
  { label: '补全正文并翻译', desc: '补全中文正文、选择场景，翻译为英文。' },
  { label: '提交审核并发布', desc: '审核通过后写入知识库并同步 Zendesk。' },
  { label: '回流验证', desc: '在坐席 / 用户侧验证该问题已可命中。' },
] as const;
