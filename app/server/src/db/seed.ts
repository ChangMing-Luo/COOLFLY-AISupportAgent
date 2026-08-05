import { CATALOG, DEFAULT_PERMISSION_MATRIX, PERMISSIONS, ROLE_LABELS } from '@kb/contracts';
import { pool, query, newId } from './pool.js';
import { hashPassword } from '../core/auth.js';
import { toHtml } from '../core/content.js';

const INITIAL_PASSWORD = process.env.SEED_PASSWORD ?? 'Coolfly@2026';

/** 正文模板（原型 bodyOf / translateBody，逐字一致） */
function bodyZhOf(categoryZh: string): string {
  return [
    `一、适用范围。本条款适用于 COOLFLY 平台出票的${categoryZh}订单。`,
    '二、处理规则。旅客可在起飞前通过 App、官网或客服热线提交申请；系统将根据舱位等级、距起飞时间与航司政策自动计算结果，并在提交后 30 分钟内反馈。',
    '三、特殊情形。因航司原因导致的变更不收取任何费用；不可抗力情形按航司公告执行，坐席须引用当次公告编号。',
    '四、常见追问。若旅客对计算结果有异议，应引导其在订单详情页查看费用明细，必要时转人工复核，复核时限为 1 个工作日。',
  ].join('\n\n');
}

function bodyEnOf(categoryEn: string): string {
  return [
    `I. Scope. These terms apply to ${categoryEn} orders ticketed on the COOLFLY platform.`,
    'II. Handling. Passengers may submit a request before departure via the App, website or service hotline; the system calculates the outcome based on cabin class, time to departure and airline policy, and responds within 30 minutes.',
    'III. Special cases. Changes caused by the carrier incur no fee; force-majeure cases follow the airline announcement, and agents must cite the announcement number.',
    'IV. Follow-ups. If the passenger disputes the result, guide them to the fee breakdown on the order page and escalate to manual review when necessary (SLA: 1 business day).',
  ].join('\n\n');
}

const TITLE_EN: Record<string, string> = {
  '国际机票改签手续费计算规则（2026 版）': 'International Ticket Rebooking Fee Rules (2026 Ed.)',
  婴儿及儿童票行李额度说明: 'Baggage Allowance for Infant & Child Tickets',
  超售航班自愿放弃座位的补偿标准: 'Compensation for Voluntarily Giving Up a Seat on Oversold Flights',
  值机失败常见原因与自助排查路径: 'Common Check-in Failures and Self-service Troubleshooting',
  里程兑换机票的退改规则: 'Change & Refund Rules for Award (Mileage) Tickets',
  签证拒签后的机票退款流程: 'Ticket Refund Process After Visa Denial',
  台风天气航班大面积延误的应答话术: 'Agent Script for Large-scale Typhoon Delays',
  '特殊旅客（孕妇 / 无成人陪伴儿童）承运条件':
    'Carriage Conditions for Special Passengers (Pregnant / Unaccompanied Minor)',
  支付失败但已扣款的处理时效: 'Handling Time for Failed Payment with Successful Charge',
  电子发票开具与重开规则: 'E-invoice Issuance and Re-issuance Rules',
  联程航班误机的保护性改签: 'Protective Rebooking for Missed Connecting Flights',
  '酒店预订取消政策（境内 / 境外差异）': 'Hotel Booking Cancellation Policy (Domestic / Overseas)',
};

const SEED_USERS = [
  { name: '陈默', email: 'chenmo@coolfly.com', role: 'super' as const, dept: '知识中台', review: true, enabled: true, last: '2026-08-05T08:12:00+08:00' },
  { name: '苏见', email: 'sujian@coolfly.com', role: 'ops' as const, dept: '客服运营', review: true, enabled: true, last: '2026-08-05T10:02:00+08:00' },
  { name: '林静', email: 'linjing@coolfly.com', role: 'ops' as const, dept: '客服运营', review: false, enabled: true, last: '2026-08-05T07:58:00+08:00' },
  { name: '周迟', email: 'zhouchi@coolfly.com', role: 'ops' as const, dept: '客服运营', review: false, enabled: true, last: '2026-08-05T09:20:00+08:00' },
  { name: '王一诺', email: 'wangyinuo@coolfly.com', role: 'ops' as const, dept: '产品', review: false, enabled: false, last: '2026-07-22T14:00:00+08:00' },
];

const SEED_TAGS: Array<[string, '业务' | '属性' | '动作' | '人群', string]> = [
  ['国际机票', '业务', '林静'],
  ['手续费', '属性', '周迟'],
  ['改签', '动作', '林静'],
  ['婴儿票', '人群', '苏见'],
  ['值机', '动作', '周迟'],
  ['退票手续费', '属性', '陈默'],
  ['规则', '属性', '林静'],
  ['行李', '业务', '苏见'],
];

interface SeedEntry {
  code: string;
  titleZh: string;
  category: string;
  scene: string;
  status: 'draft' | 'pending' | 'rejected' | 'published' | 'fixing' | 'offline';
  version: string;
  owner: string;
  at: string;
  quality: number;
  confidence: number;
  sync: 'none' | 'pending' | 'synced' | 'failed';
  adopt: number;
  hits: number;
  tags: string[];
}

const SEED_ENTRIES: SeedEntry[] = [
  { code: 'KB-20418', titleZh: '国际机票改签手续费计算规则（2026 版）', category: '机票 · 售后', scene: '改签退票', status: 'published', version: 'v3.2', owner: '林静', at: '2026-08-04T14:22:00+08:00', quality: 78, confidence: 0.96, sync: 'failed', adopt: 31, hits: 2840, tags: ['国际机票', '改签', '手续费'] },
  { code: 'KB-20402', titleZh: '婴儿及儿童票行李额度说明', category: '机票 · 出行前', scene: '行李服务', status: 'published', version: 'v1.4', owner: '周迟', at: '2026-08-02T09:41:00+08:00', quality: 88, confidence: 0.91, sync: 'synced', adopt: 82, hits: 5120, tags: ['婴儿票', '行李'] },
  { code: 'KB-20517', titleZh: '超售航班自愿放弃座位的补偿标准', category: '机票 · 异常处理', scene: '航班异常', status: 'pending', version: 'v2.0', owner: '苏见', at: '2026-08-05T10:12:00+08:00', quality: 76, confidence: 0.88, sync: 'none', adopt: 0, hits: 0, tags: ['改签', '规则'] },
  { code: 'KB-20522', titleZh: '值机失败常见原因与自助排查路径', category: '机票 · 出行前', scene: '值机登机', status: 'draft', version: 'v0.3', owner: '林静', at: '2026-08-05T08:30:00+08:00', quality: 61, confidence: 0.72, sync: 'none', adopt: 0, hits: 0, tags: ['改签', '规则'] },
  { code: 'KB-20489', titleZh: '里程兑换机票的退改规则', category: '会员 · 权益', scene: '会员权益', status: 'rejected', version: 'v1.1', owner: '周迟', at: '2026-08-03T16:55:00+08:00', quality: 54, confidence: 0.63, sync: 'none', adopt: 0, hits: 0, tags: ['改签', '规则'] },
  { code: 'KB-20460', titleZh: '签证拒签后的机票退款流程', category: '机票 · 售后', scene: '改签退票', status: 'published', version: 'v2.6', owner: '苏见', at: '2026-07-29T11:08:00+08:00', quality: 91, confidence: 0.93, sync: 'synced', adopt: 88, hits: 3960, tags: ['改签', '规则'] },
  { code: 'KB-20530', titleZh: '台风天气航班大面积延误的应答话术', category: '机票 · 异常处理', scene: '航班异常', status: 'fixing', version: 'v4.1', owner: '陈默', at: '2026-08-05T09:05:00+08:00', quality: 68, confidence: 0.81, sync: 'synced', adopt: 44, hits: 6210, tags: ['改签', '规则'] },
  { code: 'KB-20301', titleZh: '特殊旅客（孕妇 / 无成人陪伴儿童）承运条件', category: '机票 · 出行前', scene: '特殊旅客', status: 'published', version: 'v5.0', owner: '林静', at: '2026-07-18T15:30:00+08:00', quality: 96, confidence: 0.97, sync: 'synced', adopt: 94, hits: 7180, tags: ['改签', '规则'] },
  { code: 'KB-20544', titleZh: '支付失败但已扣款的处理时效', category: '支付 · 财务', scene: '支付与发票', status: 'pending', version: 'v1.0', owner: '周迟', at: '2026-08-05T11:40:00+08:00', quality: 72, confidence: 0.85, sync: 'none', adopt: 0, hits: 0, tags: ['改签', '规则'] },
  { code: 'KB-20255', titleZh: '电子发票开具与重开规则', category: '支付 · 财务', scene: '支付与发票', status: 'offline', version: 'v3.0', owner: '苏见', at: '2026-06-11T10:02:00+08:00', quality: 43, confidence: 0.58, sync: 'none', adopt: 51, hits: 2010, tags: ['改签', '规则'] },
  { code: 'KB-20536', titleZh: '联程航班误机的保护性改签', category: '机票 · 异常处理', scene: '航班异常', status: 'draft', version: 'v0.1', owner: '陈默', at: '2026-08-05T13:15:00+08:00', quality: 58, confidence: 0.69, sync: 'none', adopt: 0, hits: 0, tags: ['改签', '规则'] },
  { code: 'KB-20421', titleZh: '酒店预订取消政策（境内 / 境外差异）', category: '酒店 · 订单', scene: '酒店订单', status: 'published', version: 'v2.2', owner: '林静', at: '2026-07-26T14:00:00+08:00', quality: 85, confidence: 0.9, sync: 'synced', adopt: 76, hits: 3320, tags: ['改签', '规则'] },
];

/**
 * 逐版本正文快照。回滚要真的把内容换回去、审核 diff 要真的有增删，
 * 所以这些版本的正文必须彼此不同（不能全用同一段模板）。
 */
const VERSION_BODIES: Record<string, { zh: string; en: string }> = {
  'v3.2': {
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的国际机票订单。',
      '二、费率。起飞前 7 日以上按票面价 5%；7 日内至 24 小时按 10%；24 小时至 4 小时按 20%。',
      '三、特殊情形。因航司原因导致的变更不收取任何费用。',
      '四、生效日期。本版自 2026 年 8 月 1 日起执行，此前出票订单按原政策。',
    ].join('\n\n'),
    en: [
      'I. Scope. These terms apply to international air tickets issued on the COOLFLY platform.',
      'II. Fees. 5% of the fare more than 7 days before departure; 10% from 7 days to 24 hours; 20% from 24 hours to 4 hours.',
      'III. Special cases. Changes caused by the carrier incur no fee.',
      'IV. Effective date. This edition takes effect on 1 August 2026; tickets issued earlier follow the previous policy.',
    ].join('\n\n'),
  },
  'v3.1': {
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的国际机票订单。',
      '二、费率。起飞前 7 日以上按票面价 5% 收取；7 日内至 24 小时按 10%。',
      '三、特殊情形。因航司原因导致的变更不收取任何费用。',
    ].join('\n\n'),
    en: [
      'I. Scope. These terms apply to international air tickets issued on the COOLFLY platform.',
      'II. Fees. 5% of the fare more than 7 days before departure; 10% from 7 days to 24 hours.',
      'III. Special cases. Changes caused by the carrier incur no fee.',
    ].join('\n\n'),
  },
  'v3.0': {
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的国际机票订单。',
      '二、费率。起飞前 7 日以上按票面价 5% 收取；7 日内统一按 10%。',
      '三、特殊情形。因航司原因导致的变更不收取任何费用。',
    ].join('\n\n'),
    en: [
      'I. Scope. These terms apply to international air tickets issued on the COOLFLY platform.',
      'II. Fees. 5% of the fare more than 7 days before departure; a flat 10% within 7 days.',
      'III. Special cases. Changes caused by the carrier incur no fee.',
    ].join('\n\n'),
  },
  'v2.8': {
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的国际机票订单。',
      '二、费率。国内与国际分列两套费率表，国际段起飞前 7 日以上按票面价 5% 收取。',
    ].join('\n\n'),
    en: [
      'I. Scope. These terms apply to international air tickets issued on the COOLFLY platform.',
      'II. Fees. Domestic and international fares use separate rate tables; international segments are charged 5% more than 7 days before departure.',
    ].join('\n\n'),
  },
  'v2.6': {
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的机票订单。',
      '二、费率。改签手续费按航司政策执行，具体以出票时费率表为准。',
    ].join('\n\n'),
    en: [
      'I. Scope. These terms apply to air tickets issued on the COOLFLY platform.',
      'II. Fees. Rebooking fees follow the airline policy; refer to the rate table in force at ticketing.',
    ].join('\n\n'),
  },
};

/** 待审条目的线上版本快照：让审核 diff 有真实增删，而不是整篇全新增 */
const PENDING_PRIOR: Record<string, { version: string; at: string; by: string; note: string; zh: string; adopt: number; hits: number }> = {
  'KB-20517': {
    version: 'v1.0',
    at: '2026-06-20T10:30:00+08:00',
    by: '苏见',
    note: '初版：仅说明可改签，未写补偿分档',
    adopt: 58,
    hits: 1240,
    zh: [
      '一、适用范围。本条款适用于 COOLFLY 平台出票的国际与国内机票，因航司超售导致的自愿放弃座位情形。',
      '二、补偿标准。自愿放弃座位的旅客可获得改签至后续航班，补偿金额由航司自行确定。',
      '三、办理方式。旅客须在登机口向地面服务人员登记，签署自愿放弃确认单后由航司出具补偿凭证。',
    ].join('\n\n'),
  },
};

/** 覆盖默认模板的条目正文（与上面的版本快照对齐） */
const ENTRY_BODIES: Record<string, string> = {
  'KB-20418': VERSION_BODIES['v3.2'].zh,
  'KB-20517': [
    '一、适用范围。本条款适用于 COOLFLY 平台出票的国际与国内机票，因航司超售导致的自愿放弃座位情形。',
    '二、补偿标准。自愿放弃座位的旅客可获得改签至后续航班加现金补偿，补偿金额按原票面价的 100%–200% 分档，具体由航司当次公告确定。',
    '三、办理方式。旅客须在登机口向地面服务人员登记，签署自愿放弃确认单后由航司出具补偿凭证。',
    '四、常见追问。补偿到账时限为 7 个工作日；若旅客改签后再次遇到超售，可累计申请补偿。',
  ].join('\n\n'),
};

/** KB-20418 的完整版本历史（原型 versions） */
const SEED_VERSIONS: Array<[string, string, string, string, string, number, number]> = [
  ['v3.2', '2026-08-04T14:22:00+08:00', '林静', '发布', '按 8 月新政更新阶梯费率，新增 24 小时内档位', 31, 2840],
  ['v3.1', '2026-07-21T10:05:00+08:00', '苏见', '发布', '补充国际段联程特例说明', 60, 5120],
  ['v3.0', '2026-06-30T17:40:00+08:00', '陈默', '回滚', '自 v2.8 回滚，v2.9 费率表存在错误', 55, 4310],
  ['v2.8', '2026-06-12T09:20:00+08:00', '林静', '发布', '首次拆分国内 / 国际两套费率', 52, 3980],
  ['v2.6', '2026-05-04T11:12:00+08:00', '周迟', '发布', '初版整理自客服工单 FAQ', 48, 3210],
];

const SEED_TASKS: Array<[string, string, string, string, string, string, number]> = [
  ['CT-3081', '近 7 日高频未命中问题聚类', 'Zendesk 客服会话', 'ready', '林静', '2026-08-05T07:00:00+08:00', 5],
  ['CT-3079', '8 月运价政策客诉聚类', 'Zendesk 客服会话', 'running', '周迟', '2026-08-05T09:20:00+08:00', 6],
  ['CT-3072', '改签退票追问 Top50', 'Zendesk 工单', 'done', '苏见', '2026-08-03T18:00:00+08:00', 24],
  ['CT-3068', '行李服务客诉抽取', 'Zendesk 客服会话', 'failed', '陈默', '2026-08-02T22:10:00+08:00', 0],
];

const SOURCE_TEXT =
  '【Zendesk 会话 · 2026-08-04 19:22 · Zendesk 客服会话】用户：我买的是带婴儿的票，现在想改后天的，婴儿票要单独改吗？坐席：您好，婴儿票是跟随成人票的，成人票改签后婴儿票会自动改到同一航班，不需要单独操作，差价会按新航段的婴儿票价重新算。用户：那要是我只改婴儿不改大人呢？坐席：这个不支持的，婴儿票不能脱离成人票单独存在。';

interface SeedCandidate {
  code: string;
  title: string;
  scene: string;
  tags: string[];
  confidence: number;
  answer: string;
  dupCode?: string;
  dupScore?: number;
}

const SEED_CANDIDATES: SeedCandidate[] = [
  { code: 'EX-01', title: '婴儿票能否单独改签', scene: '改签退票', tags: ['婴儿票', '改签'], confidence: 0.93, answer: '婴儿票不可脱离成人票单独改签。成人票改签后，婴儿票将随成人票自动改期，差价按新航段婴儿票价重新计算。' },
  { code: 'EX-02', title: '值机失败提示「证件信息不符」如何处理', scene: '值机登机', tags: ['值机', '证件'], confidence: 0.87, answer: '提示证件信息不符时，请核对订单证件号与实际出行证件是否一致。不一致需在起飞前 4 小时联系客服修改，修改成功后重新值机。' },
  { code: 'EX-03', title: '国际机票改签手续费怎么算', scene: '改签退票', tags: ['国际机票', '手续费'], confidence: 0.79, answer: '国际机票改签手续费按票价档位与距起飞时间分段收取，具体比例见费率表。', dupCode: 'KB-20418', dupScore: 91 },
  { code: 'EX-04', title: '延误多久可以申请赔偿', scene: '航班异常', tags: ['延误', '赔偿'], confidence: 0.64, answer: '因承运人原因导致的延误达到 4 小时以上，可申请补偿；天气等不可抗力不在补偿范围内。' },
  { code: 'EX-05', title: '改签后原座位是否保留', scene: '改签退票', tags: ['改签', '选座'], confidence: 0.55, answer: '改签会重新出票，原选座失效，需在新航班重新选座。' },
];

const SEED_FEEDBACKS: Array<[string, string, '差评' | '信息有误' | '无法解决', string, string, string, 'open' | 'fixing' | 'closed']> = [
  ['FB-9912', 'KB-20530', '差评', '话术太长，客户等不及，坐席念不完', 'ZD-88231', '2026-08-05T11:20:00+08:00', 'open'],
  ['FB-9908', 'KB-20418', '信息有误', '手续费比例与 8 月新政策不一致', 'ZD-88190', '2026-08-05T09:48:00+08:00', 'open'],
  ['FB-9901', 'KB-20489', '无法解决', '里程票退票规则没写清楚，客户追问三次', 'ZD-88044', '2026-08-04T20:11:00+08:00', 'open'],
  ['FB-9894', 'KB-20255', '差评', '发票重开入口找不到', 'ZD-87920', '2026-08-04T15:02:00+08:00', 'closed'],
];

const SEED_MISSES: Array<[string, string, string, number, number, 'open' | 'planned', string]> = [
  ['MS-441', '婴儿票能不能单独改签', '改签退票', 63, 0, 'open', '改签类 · 婴儿票与成人票联动规则缺失，用户高频追问能否单独改签，属「规则空白」型未命中。'],
  ['MS-438', '值机失败提示证件信息不符', '值机登机', 41, 12, 'open', '值机异常 · 证件信息校验失败的自助处理路径未覆盖，属「流程缺失」型未命中。'],
  ['MS-433', '共享航班的行李额按哪家算', '行李服务', 28, 31, 'planned', '行李规则 · 代码共享航班行李额归属承运方的判定说明不足，属「细节不全」型未命中。'],
  ['MS-421', '里程能不能转给家人', '会员权益', 19, 8, 'open', '会员权益 · 里程转赠规则缺失，涉及亲友账户绑定与限制，属「规则空白」型未命中。'],
];

const SEED_AUDIT: Array<[string, string, string, string, string]> = [
  ['2026-08-05T11:40:00+08:00', '周迟', '提交审核', 'KB-20544 支付失败但已扣款的处理时效', '成功'],
  ['2026-08-05T10:12:00+08:00', '苏见', '提交审核', 'KB-20517 超售航班自愿放弃座位的补偿标准', '成功'],
  ['2026-08-05T09:48:00+08:00', '系统', 'Zendesk 拉取', 'ZD-88190 → FB-9908', '成功'],
  ['2026-08-04T14:22:00+08:00', '林静', '发布', 'KB-20418 v3.2', '成功'],
  ['2026-08-04T14:23:00+08:00', '系统', 'Zendesk 同步', 'KB-20418 英文版本（失败）', '失败'],
  ['2026-08-04T10:02:00+08:00', '苏见', '审核通过', 'KB-20418 v3.2', '成功'],
];

async function main(): Promise<void> {
  await query(`TRUNCATE TABLE
      sync_logs, sync_mappings, misses, feedbacks, extract_candidates, collect_tasks,
      entry_metrics, entry_versions, entry_tags, entries, tags, scenes, categories,
      audit_logs, permission_matrix, sessions, users
    RESTART IDENTITY CASCADE`);

  /* 用户 */
  const pwd = await hashPassword(INITIAL_PASSWORD);
  const userId = new Map<string, string>();
  for (const u of SEED_USERS) {
    const id = newId('usr');
    userId.set(u.name, id);
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, department, review_granted, enabled, must_change_password, last_active_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9)`,
      [id, u.name, u.email, pwd, u.role, u.dept, u.review, u.enabled, u.last],
    );
  }

  /* 权限矩阵 */
  for (const p of PERMISSIONS) {
    for (const role of ['super', 'ops'] as const) {
      await query(
        `INSERT INTO permission_matrix (permission, role, allowed) VALUES ($1,$2,$3)
         ON CONFLICT (permission, role) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()`,
        [p, role, DEFAULT_PERMISSION_MATRIX[p][role]],
      );
    }
  }

  /* 分类 + 场景 */
  const catId = new Map<string, string>();
  const catEn = new Map<string, string>();
  const sceneId = new Map<string, string>();
  CATALOG.forEach((c, ci) => {
    catEn.set(c.zh, c.en);
  });
  let sceneSeq = 0;
  for (let ci = 0; ci < CATALOG.length; ci += 1) {
    const c = CATALOG[ci];
    const id = newId('cat');
    catId.set(c.zh, id);
    await query(
      `INSERT INTO categories (id, code, name_zh, name_en, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [id, `CAT-${401 + ci}`, c.zh, c.en, ci],
    );
    for (const s of c.scenes) {
      const sid = newId('scn');
      sceneId.set(s.zh, sid);
      await query(
        `INSERT INTO scenes (id, code, category_id, name_zh, name_en, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
        [sid, `SCENE-${201 + sceneSeq}`, id, s.zh, s.en, sceneSeq],
      );
      sceneSeq += 1;
    }
  }

  /* 标签 */
  const tagId = new Map<string, string>();
  for (let i = 0; i < SEED_TAGS.length; i += 1) {
    const [name, type, by] = SEED_TAGS[i];
    const id = newId('tag');
    tagId.set(name, id);
    await query(`INSERT INTO tags (id, code, name, type, created_by) VALUES ($1,$2,$3,$4,$5)`, [
      id,
      `TAG-${301 + i}`,
      name,
      type,
      by,
    ]);
  }

  /* 条目 */
  const entryId = new Map<string, string>();
  for (const e of SEED_ENTRIES) {
    const id = newId('ent');
    entryId.set(e.code, id);
    const translated = e.status === 'published' || e.status === 'offline' || e.status === 'fixing';
    const bodyZh = toHtml(ENTRY_BODIES[e.code] ?? bodyZhOf(e.category));
    const bodyEn = translated
      ? toHtml(VERSION_BODIES[e.version]?.en ?? bodyEnOf(catEn.get(e.category) ?? e.category))
      : '';
    const titleEn = translated ? (TITLE_EN[e.titleZh] ?? '') : '';
    const owner = userId.get(e.owner) ?? null;
    await query(
      `INSERT INTO entries
        (id, code, title_zh, title_en, body_zh, body_en, category_id, scene_id, status, version,
         sync_status, translated, en_edited, owner_id, owner_name, note, reject_reason, source,
         confidence, quality, created_at, updated_at, published_at, submitter_id, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,$13,$14,'',$15,'人工撰写',$16,$17,$18,$18,$19,$13,$20)`,
      [
        id,
        e.code,
        e.titleZh,
        titleEn,
        bodyZh,
        bodyEn,
        catId.get(e.category) ?? null,
        sceneId.get(e.scene) ?? null,
        e.status,
        e.version,
        e.sync,
        translated,
        owner,
        e.owner,
        e.status === 'rejected' ? '内容与新政策不一致，费率档位需按 8 月新政更新后再提交。' : null,
        e.confidence,
        e.quality,
        e.at,
        e.status === 'published' ? e.at : null,
        e.status === 'pending' ? e.at : null,
      ],
    );
    for (const t of e.tags) {
      const tid = tagId.get(t);
      if (tid) await query(`INSERT INTO entry_tags (entry_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, tid]);
    }
    await query(
      `INSERT INTO entry_metrics (entry_id, hits, views, adopt_rate, refreshed_at) VALUES ($1,$2,$3,$4,$5)`,
      [id, e.hits, e.hits * 4, e.adopt, e.hits ? e.at : null],
    );
    if (e.sync === 'synced' || e.sync === 'failed') {
      await query(
        `INSERT INTO sync_mappings (entry_id, zendesk_article_ref, published_hash, updated_at) VALUES ($1,$2,$3,$4)`,
        [id, e.sync === 'synced' ? `art_${e.code}` : null, null, e.at],
      );
    }
  }

  /* KB-20418 版本历史；其余条目补一条当前版本 */
  const kb418 = entryId.get('KB-20418');
  if (kb418) {
    for (let i = SEED_VERSIONS.length - 1; i >= 0; i -= 1) {
      const [v, at, by, act, note, adopt, hits] = SEED_VERSIONS[i];
      const snap = VERSION_BODIES[v];
      await query(
        `INSERT INTO entry_versions (id, entry_id, version, act, note, author_id, author_name,
                                     title_zh, title_en, body_zh, body_en, adopt_rate, hits, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          newId('ver'),
          kb418,
          v,
          act,
          note,
          userId.get(by) ?? null,
          by,
          '国际机票改签手续费计算规则（2026 版）',
          TITLE_EN['国际机票改签手续费计算规则（2026 版）'],
          toHtml(snap?.zh ?? ''),
          toHtml(snap?.en ?? ''),
          adopt,
          hits,
          at,
        ],
      );
    }
  }
  for (const e of SEED_ENTRIES) {
    if (e.code === 'KB-20418') continue;
    const id = entryId.get(e.code)!;
    const prior = PENDING_PRIOR[e.code];
    if (prior) {
      await query(
        `INSERT INTO entry_versions (id, entry_id, version, act, note, author_id, author_name,
                                     title_zh, title_en, body_zh, body_en, adopt_rate, hits, created_at)
         VALUES ($1,$2,$3,'发布',$4,$5,$6,$7,'',$8,'',$9,$10,$11)`,
        [
          newId('ver'),
          id,
          prior.version,
          prior.note,
          userId.get(prior.by) ?? null,
          prior.by,
          e.titleZh,
          toHtml(prior.zh),
          prior.adopt,
          prior.hits,
          prior.at,
        ],
      );
    }
    await query(
      `INSERT INTO entry_versions (id, entry_id, version, act, note, author_id, author_name,
                                   title_zh, title_en, body_zh, body_en, adopt_rate, hits, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        newId('ver'),
        id,
        e.version,
        e.status === 'published' ? '发布' : '创建',
        e.status === 'published' ? '当前线上版本' : '初始版本',
        userId.get(e.owner) ?? null,
        e.owner,
        e.titleZh,
        TITLE_EN[e.titleZh] ?? '',
        toHtml(ENTRY_BODIES[e.code] ?? bodyZhOf(e.category)),
        e.status === 'published' ? toHtml(bodyEnOf(catEn.get(e.category) ?? e.category)) : '',
        e.adopt,
        e.hits,
        e.at,
      ],
    );
  }

  /* 采集任务 + 抽取候选 */
  const taskId = new Map<string, string>();
  for (const [code, title, source, state, owner, at, n] of SEED_TASKS) {
    const id = newId('tsk');
    taskId.set(code, id);
    await query(
      `INSERT INTO collect_tasks (id, code, title, source, state, owner_id, owner_name, candidate_count, source_text, source_meta, created_at, ran_at, fail_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)`,
      [
        id,
        code,
        title,
        source,
        state,
        userId.get(owner) ?? null,
        owner,
        n,
        code === 'CT-3081' ? SOURCE_TEXT : '',
        `来自 Zendesk · ${source} · 共 24 段 · 已解析 24 段`,
        at,
        state === 'failed' ? 'Zendesk 会话拉取超时（UND_ERR_CONNECT_TIMEOUT），本批次未产出候选' : null,
      ],
    );
  }
  const activeTask = taskId.get('CT-3081')!;
  for (const c of SEED_CANDIDATES) {
    await query(
      `INSERT INTO extract_candidates (id, code, task_id, title, answer, scene_id, tags, confidence, dup_entry_id, dup_score, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
      [
        newId('cnd'),
        c.code,
        activeTask,
        c.title,
        c.answer,
        sceneId.get(c.scene) ?? null,
        JSON.stringify(c.tags),
        c.confidence,
        c.dupCode ? (entryId.get(c.dupCode) ?? null) : null,
        c.dupScore ?? null,
        '2026-08-05T07:00:00+08:00',
      ],
    );
  }

  /* 反馈 */
  for (const [code, kb, type, text, conv, at, state] of SEED_FEEDBACKS) {
    await query(
      `INSERT INTO feedbacks (id, code, entry_id, entry_code, type, text, conversation, state, occurred_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
      [newId('fb'), code, entryId.get(kb) ?? null, kb, type, text, conv, state, at],
    );
  }

  /* 未命中 */
  for (const [code, q, scene, n7, rate, state, summary] of SEED_MISSES) {
    await query(
      `INSERT INTO misses (id, code, question, scene_id, count_7d, hit_rate, state, ai_summary, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
      [newId('ms'), code, q, sceneId.get(scene) ?? null, n7, rate, state, summary],
    );
  }

  /* 审计 */
  for (const [at, who, act, obj, result] of SEED_AUDIT) {
    await query(
      `INSERT INTO audit_logs (id, at, actor_id, actor_name, actor_role, action, object_type, object_code, object_label, result)
       VALUES ($1,$2,$3,$4,$5,$6,'entry',$7,$8,$9)`,
      [
        newId('aud'),
        at,
        userId.get(who) ?? null,
        who,
        who === '系统' ? '系统' : ROLE_LABELS[who === '陈默' ? 'super' : 'ops'],
        act,
        obj.split(' ')[0],
        obj,
        result,
      ],
    );
  }

  /* 同步日志（对应审计里的两条 Zendesk 同步） */
  await query(
    `INSERT INTO sync_logs (id, at, entry_id, entry_code, object_label, result, message, duration_ms, payload_no, actor_name)
     VALUES ($1,$2,$3,'KB-20418','KB-20418 英文版本（失败）','失败','Zendesk 目录字段校验未通过（缺少「生效日期 / Effective date」）',157,'#88210','系统'),
            ($4,$5,$6,'KB-20421','KB-20421 英文版本（成功）','成功','',120,'#88211','系统')`,
    [
      newId('slog'),
      '2026-08-04T14:23:00+08:00',
      entryId.get('KB-20418') ?? null,
      newId('slog'),
      '2026-08-04T14:23:30+08:00',
      entryId.get('KB-20421') ?? null,
    ],
  );

  console.log('种子数据写入完成：');
  console.log(`  用户 ${SEED_USERS.length} 个（初始密码：${INITIAL_PASSWORD}）`);
  console.log(`  分类 ${CATALOG.length} / 场景 ${sceneSeq} / 标签 ${SEED_TAGS.length}`);
  console.log(`  条目 ${SEED_ENTRIES.length} / 采集任务 ${SEED_TASKS.length} / 候选 ${SEED_CANDIDATES.length}`);
  console.log(`  反馈 ${SEED_FEEDBACKS.length} / 未命中 ${SEED_MISSES.length} / 审计 ${SEED_AUDIT.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('种子写入失败：', err);
  process.exit(1);
});
