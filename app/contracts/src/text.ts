/**
 * 界面文案资源（zh-CN）——文案不硬编码语言，加语言 = 加资源文件（PRD §5.1 / 技术方案 §3.2）。
 * 定稿口径唯一落点：PRD §5.10 文案定稿表。
 */
export const zhCN = {
  app: {
    brand: 'COOLFLY',
    title: '知识运营中台',
    subtitle: '运行时 = Zendesk · 本台 = 唯一权威源',
  },
  nav: {
    groupWorkbench: '工作台',
    groupProduction: '知识生产',
    groupQuality: '质量与发布',
    groupData: '数据',
    groupGovernance: '治理',
    work: '我的工作台',
    kb: '知识库总览',
    entry: '条目工作台',
    mine: 'AI 对话挖掘',
    review: '审核中心',
    sync: '同步中心 · Zendesk',
    dash: '数据看板',
    feedback: '反馈回流',
    logs: '操作日志',
    rbac: '用户与权限',
    meta: '元数据管理',
  },
  crumbs: {
    work: '工作台',
    kb: '知识生产 / 知识库总览',
    entry: '知识生产 / 知识库总览 / 条目',
    mine: '知识生产 / AI 对话挖掘',
    review: '质量与发布 / 审核中心',
    sync: '质量与发布 / 同步中心',
    dash: '数据 / 数据看板',
    feedback: '数据 / 反馈回流',
    logs: '治理 / 操作日志',
    rbac: '治理 / 用户与权限',
    meta: '治理 / 元数据管理',
  },
  ironLaw: {
    publishBlocked: '发布权限仅知识审核员——统一过审铁律：任何角色无绕过审核的发布路径。',
    readOnlyEditor: '当前角色（AI 运营）对编辑器只读，无法修改内容。',
    rejectReasonRequired: '驳回理由必填——审核意见会回传给提交人并留痕。',
    matrixAdminOnly: '权限矩阵仅系统管理员可修改',
  },
  gate: {
    fields: '格式与字段完整性（标题/章节/可见性/标签已填）',
    internal: '敏感信息与内部口径（内部段落已标记，不会进对外文章）',
    english: '英文版本状态（未确认则同步将被阻断）',
    passed: '门禁通过：正文已保存、英文已确认，可发布并同步。',
  },
  translation: {
    staleHint: '中文已变更 → 英文置为待重新校验，同步阻断',
    internalSkip: '内部段落不翻译、不同步到对外帮助中心',
    confirmRequired: '英文「已确认」前不可同步到 Zendesk（人工校验 100% 铁律）',
  },
  summary: {
    purpose: '只服务本台内部：AI 对话挖掘做语义查重的比对基准，与 Zendesk AI 索引无关',
    generatedOnPublish: '摘要在条目发布时由 LLM 依标题与正文生成；可人工改写，改写后不再被 AI 覆盖',
    notPublished: '本条目尚未发布，摘要将在首次发布时生成',
    humanEdited: '摘要已人工校正：后续发布不会用 AI 结果覆盖',
    generateFailed: '本次摘要生成失败（LLM 不可用），保留上一次摘要——不阻塞发布',
  },
  sync: {
    stateMachine:
      '待同步 → 同步中 → 已同步 / 失败（自动重试 3 次后告警）；「已阻断」= 英文未校验或条目被驳回，不推半截内容。下线 = Zendesk 归档不物理删除。',
    driftGovernance:
      '治理 = Guide 编辑权限收权（流程）+ 漂移检测（技术兜底）+ 覆盖策略。覆盖动作仅审核员可执行。',
    driftAlert: (n: number) => `检测到 ${n} 篇文章在 Zendesk 端被直接修改（内容漂移）`,
    mappingNote:
      '映射 Zendesk：知识库 → Help Center brand、目录 → Category、章节 → Section、条目 → Article、条目内锚点 → 文章内 anchor',
  },
  mine: {
    admission: '沉淀判断三重准入：①频次达阈值 ②LLM 语义查重 ③缺口判定',
    dedupeDegraded: '语义查重未生效——当前按字面相似度粗判，结果仅供参考',
    dedupeHigh: '查重 ≥0.85 → 不新建，挂修订',
    discarded: '已丢弃候选（留痕）：同主题再达阈值会重新出现',
    emptyBatch: '无新候选：均未达频次阈值，如实标注',
  },
  dash: {
    exploreNote:
      '客服工作数据由 Zendesk Explore 承担——工单量、首次响应、CSAT、客服人效等报表在 Explore 原生查看，本台不重建。',
    sampleShort: '样本积累中',
    reviewOverdue: '复核已到期',
    reviewDueSoon: '复核到期',
  },
  audit: {
    appendOnly: '操作日志只增不改不删、长期保留',
    tabs: { all: '全部', content: '内容变更', review: '审核与发布', admin: '权限与系统' },
  },
  common: {
    confirm: '确认',
    cancel: '取消',
    save: '保存中文草稿',
    submitReview: '提交审核',
    publish: '发布并同步',
    approve: '通过',
    reject: '驳回',
    rollback: '回滚',
    retry: '重试',
    noPermission: '当前角色无此操作权限',
  },
} as const;

export type TextResource = typeof zhCN;
