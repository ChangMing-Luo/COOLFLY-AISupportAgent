# 间接竞品/可借鉴方案调研：AI 智能客服平台（消费品牌/电商/IoT 向）

- 调研时间：08-03-2026 15:56:36
- 调研方法：WebSearch + WebFetch 真实检索（官方定价页/官方帮助文档优先，第三方数据显式标注）
- 调研目的：为 COOLFLY App 内智能客服升级提供「自研 vs 采购」决策依据与设计借鉴
- COOLFLY 场景锚点：智能喂鸟器+App，北美市场，月咨询 1500-2000 条，3 人菲律宾客服团队（¥15-20k/月合计），已有自研 App 内 AI 客服 + 120 篇飞书知识库文档，未来客服工作台计划用 Zendesk

> 数据可信度标注约定：【官方】= 厂商官网/官方文档原文；【第三方】= 第三方分析/评测（可能有偏，仅作参考）；【未找到公开资料】= 检索未命中。

---

## 1. Intercom Fin（重点对象）

### ① 定位与目标客户
AI-first 客服 Agent，宣称"highest-performing AI Agent"。既可以跑在 Intercom 全家桶里，也可以**独立部署在第三方帮助台（含 Zendesk）之上**——这是对 COOLFLY 最关键的一点。目标客户从 SMB 到 Enterprise 全覆盖。
- 来源【官方】：https://fin.ai/pricing

### ② 核心能力
- 知识库问答：接入知识源（帮助中心、文档、URL 等）自动回答
- 渠道：Voice、Email、Messenger、Slack、WhatsApp、SMS、Instagram、Facebook Messenger、**Fin over API**（可接自有前端）【官方，fin.ai/pricing】
- App SDK 嵌入：Intercom 官方 iOS/Android SDK，Messenger 以原生 bottom sheet 呈现，Fin 可直接跑在 App 内 Messenger 上
  - 来源【官方】：https://developers.intercom.com/installing-intercom/ios/about-the-sdk 、https://github.com/intercom/intercom-ios 、https://www.intercom.com/help/en/articles/6705301-use-the-messenger-in-your-mobile-app
- 接 Zendesk：**官方产品 "Fin for Zendesk"**——Fin 可直接部署在现有 Zendesk 实例上，API 连接、同步数据，"When Fin isn't able to resolve an issue, it automatically transfers to your human team in Zendesk"；支持 Zendesk messaging 渠道（web、iOS、Android、WhatsApp 等）
  - 来源【官方】：https://fin.ai/help/en/articles/10602087-fin-for-zendesk-explained 、https://intercom.help/fin4all/en/articles/10614168-how-fin-integrates-with-zendesk 、https://fin.ai/help/en/articles/10614196-fin-messenger-zendesk-setup
- 转人工机制：Fin 无法解决时自动转交人工（在 Zendesk 场景下直接转 Zendesk 人工队列）【官方，同上】

### ③ 定价
- **$0.99 / outcome**（按结果计费），每月最低 50 outcomes；"No setup, integration, or platform fees"【官方：https://fin.ai/pricing 】
- billable outcome 四类：Resolution（用户在 Fin 最后回答后不再求助）$0.99、Procedure handoff $0.99、Disqualification $0.99、Qualification $9.99【官方：https://fin.ai/pricing 】
- Fin for Zendesk 场景：$49/月底价含 50 次 resolution，超出 $0.99/次【官方：https://fin.ai/help/en/articles/13975743-fin-for-zendesk-explained 】
- 注意：Resolution 定义是"用户没再继续求助"即计费——用户放弃/流失也可能被计为 resolution，实际账单可能高于直觉

### ④ 官方声称解决率
- "our average resolution rate across customers has increased every month and now stands at 76%"（2026 年，官方博客）【官方：https://www.intercom.com/blog/from-resolutions-to-outcomes-evolving-how-fin-delivers-value/ 】
- Fin for Zendesk 宣传页称"resolving up to 86% of your support volume"（up to 口径，营销上限值）【官方：fin.ai help】

### ⑤ COOLFLY 适配度：★★★★☆（采购路线首选）
- 能嵌自有 App（官方移动 SDK）✅；能接 Zendesk（官方产品线）✅；与"现在 App 内 AI + 未来 Zendesk 工作台"的路线完全吻合
- 成本测算：月咨询 1500-2000 条，若 Fin 解决 60% ≈ 900-1200 outcomes/月 ≈ **$891-1188/月（约 ¥6.4-8.6k/月）**，接近 COOLFLY 3 人客服团队成本（¥15-20k/月）的一半——对低客单价（$50）硬件品牌偏贵
- 风险：知识库需从飞书迁移/同步到 Fin 支持的知识源；resolution 计费口径对"用户放弃"不友好

---

## 2. Zendesk AI（Answer Bot → AI agents）（重点对象）

### ① 定位与目标客户
Zendesk Suite 内置 AI 能力：AI agents（面客机器人，前身 Answer Bot）+ Copilot（坐席辅助）。目标客户为已用/将用 Zendesk 做工作台的团队——正是 COOLFLY 的未来路径。
- 来源【官方】：https://www.zendesk.com/service/ai-agents/

### ② 核心能力
- 知识库问答：连接帮助中心 + 外部知识源（Google Drive、PDF 等）【官方，同上】
- 引导排障：多步 workflow，"理解意图、提出澄清问题并实时适应"；Advanced 版支持对话流编排【官方，同上】
- 转人工：升级时"将问题智能地路由到正确的团队"；官方计费文档明确**转人工的对话不计为 automated resolution（不收费）**【官方：https://support.zendesk.com/hc/en-us/articles/5352026794010-About-automated-resolutions-for-AI-agents 】
- 多语言：官方宣称支持 80 种语言，按用户输入自动切换【官方：zendesk.com/service/ai-agents/】
- App SDK 嵌入：Zendesk Messaging SDK（iOS 14+ / Android API 21+），官方文档明确"可在 messaging 渠道加 AI agent，先由 AI 交互再转人工"
  - 来源【官方】：https://support.zendesk.com/hc/en-us/articles/4408827701530-Getting-started-with-messaging-for-your-website-help-center-and-mobile-apps 、https://developer.zendesk.com/documentation/classic-web-widget-sdks/

### ③ 定价
- Suite 底座：$55/坐席/月（Team）~ $115/坐席/月（Professional），年付【第三方汇总：https://www.voiceflow.com/blog/zendesk-pricing 】
- AI agents 按 automated resolution 计费；官方定义：客户问题在无人工介入下解决且经 LLM 验证才计数；各套餐含少量免费额度（Team 5 次/坐席/月，Growth/Professional 10 次，Enterprise 15 次），可加购（100 次起）【官方：https://support.zendesk.com/hc/en-us/articles/5352026794010 】
- 超额单价官方未公开；第三方报约 **$1.50/次（承诺量）~ $2.00/次（按量）**【第三方：https://www.eesel.ai/blog/zendesk-automated-resolutions 、https://coworker.ai/blog/zendesk-ai-pricing 】
- 有第三方称 2026 年 5 月起 resolution 分层（Assisted Escalation / Contained 免费，仅 Verified Resolution 扣额度）【第三方：https://servicedeskagents.com/vs-zendesk/ ，未在官方文档直接核实，官方有"automated resolution tiers"文章佐证方向：https://support.zendesk.com/hc/en-us/articles/9570369117338 】

### ④ 官方声称解决率
- 官方宣传"解决高达 80% 客户互动"（up to 口径）；客户案例：Hello Sugar 66% 自动化、Babbel 50%+【官方：https://www.zendesk.com/service/ai-agents/ 】

### ⑤ COOLFLY 适配度：★★★★☆（若确定上 Zendesk，则是"顺路"选项）
- 能嵌自有 App ✅（Messaging SDK）；与 Zendesk 工作台零缝隙 ✅（同一家）
- 成本测算：3 坐席 × $55-115 + resolution 费。若 AI 解决 900-1200 次/月、按第三方 $1.5/次估 ≈ $1350-1800/月 AI 费 + $165-345/月坐席费，**合计约 ¥11-15.5k/月**，比 Fin 更贵（第三方价，需询价核实）
- 优点：转人工不计费的口径对 COOLFLY 友好；一家供应商减少集成成本
- 缺点：AI 部分单价（第三方口径）是几家里最高的；面客 bot 的知识问答能力在第三方评测中常被认为弱于 Fin（【第三方】各对比文，谨慎采信）

---

## 3. Gorgias（Shopify 电商向）（重点对象）

### ① 定位与目标客户
电商专用客服台+AI，深度绑定 Shopify（宣称服务"40% of Shopify brands"），客户以 DTC 消费品牌为主（Tommy John、Orthofeet 等）。按 ticket 计价、不按坐席。
- 来源【官方】：https://www.gorgias.com/pricing

### ② 核心能力
- AI Agent（Support）：官方宣称"60% of inquiries resolved instantly"；另有 Shopping Assistant（导购）【官方：gorgias.com/pricing】
- 电商动作能力：订单查询、退换货等 Shopify 原生操作（电商场景强，IoT 排障场景弱）
- App SDK 嵌入：无官方原生 iOS/Android SDK；官方文档给的是 chat widget 方案，可通过 WebView 嵌入原生 App（需处理 originWhitelist 等）；npm 有 `@frontend-sdk/gorgias`（web 向）
  - 来源：https://docs.gorgias.com/en-US/install-chat-and-enable-ai-agent-on-gorgias-4462157 【官方】、https://www.npmjs.com/package/@frontend-sdk/gorgias 、https://www.eesel.ai/blog/gorgias-sdk 【第三方】
- 转人工：AI 无法解决即转人工，转人工的对话不计 AI 费（转为普通 helpdesk 工单）【官方：https://www.gorgias.com/blog/ai-agent-pricing 】

### ③ 定价
- Helpdesk 按月 ticket 量阶梯（50~5000 tickets/月），"never priced per agent"；具体套餐价官方页不直接公示【官方：gorgias.com/pricing】
- AI Agent：**$0.90/resolved conversation（多数套餐，年付）、Starter $1.00/次**；billable 定义="AI 完全独立解决且对话关闭，无人工介入"；转人工不重复收费【官方：https://www.gorgias.com/blog/ai-agent-pricing 】
- 注意【第三方】：AI 解决的对话同时也消耗 helpdesk ticket 额度（双计量）——https://www.getmacha.com/blog/gorgias-pricing-explained

### ④ 官方声称解决率
- "60% of inquiries resolved instantly"【官方：gorgias.com/pricing】

### ⑤ COOLFLY 适配度：★★☆☆☆
- 强项在 Shopify 订单类自动化，COOLFLY 的核心痛点是**硬件装机/联网排障**，非订单售后；无原生移动 SDK，App 嵌入靠 WebView，体验打折
- 且 COOLFLY 工作台已定 Zendesk，Gorgias 本质是"替代 Zendesk 的电商 helpdesk"，路线冲突
- 借鉴价值：按 resolution 收费+转人工不收费的定价设计；电商动作型 AI（查订单→办退货）的"能执行动作"思路，对应 COOLFLY 未来"调用配对定位接口"的方向

---

## 4. Tidio / Lyro AI（重点对象）

### ① 定位与目标客户
中小企业向聊天+AI 客服，主打性价比与快速上手；客户覆盖电商/SaaS/服务业。
- 来源【官方】：https://www.tidio.com/pricing/

### ② 核心能力
- Lyro AI Agent：知识库问答型 AI，官方宣称可自动解决 67%（up to 口径）【官方：https://www.tidio.com/ai-agent/ 】
- App SDK 嵌入：**有官方 Mobile SDK（iOS/Android）**，可把 livechat + Lyro AI 直接嵌进自有 App，官方称集成 15-30 分钟【官方：https://www.tidio.com/mobile-sdk/ 、https://help.tidio.com/hc/en-us/articles/5463607160860-Widget-SDK 】
- 转人工：Lyro 支持转人工（转到 Tidio 自家收件箱）；与 Zendesk 的衔接仅为一般性集成，非原生工作台【官方集成目录，深度未验证】
- 多语言：Lyro 支持多语言问答【官方：tidio.com/ai-agent/】

### ③ 定价
- 免费版 $0（50 对话/月）；Starter $24.17/月；Growth 自 $49.17/月；Plus 自 $300/月；Premium 议价（自 3000 Lyro 对话起，"Guaranteed 50% Lyro AI resolution rate"）【官方：tidio.com/pricing/】
- Lyro 独立计费：自 $32.50/月起（含 50 Lyro 对话）；计费单位是 **Lyro conversation（AI 至少回复一次即计费）**——与 Fin/Gorgias 的"按解决计费"不同，**没解决也收钱**【官方：tidio.com/pricing/】

### ④ 官方声称解决率
- "automatically resolve up to 67% of inquiries"；新闻稿称平均 64%、峰值 90%【官方：https://www.tidio.com/blog/lyro-achieves-best-resolution-rates-in-industry/ 】
- Premium 套餐提供"50% 解决率保证"【官方：tidio.com/pricing/】——侧面说明 64-67% 是理想口径，保证线只有 50%

### ⑤ COOLFLY 适配度：★★★☆☆（低成本采购路线的备选）
- 有原生 Mobile SDK ✅，价格量级最低：1500-2000 对话/月若全走 Lyro，按对话计费约落在 Plus 档（$300+/月 ≈ ¥2.2k+/月）
- 缺点：按"AI 回复即计费"而非按解决计费；与 Zendesk 工作台衔接弱；引导式多步排障能力弱于 Fin/Zendesk Advanced（知识问答型为主）

---

## 5. Ada（可选对象，简要）

### ① 定位与目标客户
企业级 AI 客服平台（Enterprise CX），客户多为大体量 B2C（航司、金融、电信、大型电商）。
- 来源【官方】：https://www.ada.cx/

### ② 核心能力
- 知识库问答 + 多步 Reasoning + 动作执行（API 调用）；多渠道（web/移动/语音/邮件）；官方提供移动 SDK（iOS/Android）嵌入
- 转人工与 Zendesk：官方支持与 Zendesk 等工作台的 handoff 集成【官方平台页：https://www.ada.cx/platform/ ；SDK/集成细节页未逐一核验】

### ③ 定价
- 无公开价格页（仅 Book a Demo）【官方】；第三方报价：起步约 $30k/年，企业单 $100k-300k+/年，按对话计费（含失败转人工的对话也收费）【第三方：https://www.featurebase.app/blog/ada-cx-pricing 、https://corepiper.com/blog/ada-ai-review-2026-pricing-worth-it/ 】

### ④ 官方声称解决率
- 官方/第三方口径：企业部署自动解决率 70-84%，客户案例常引"80%+ automated resolution"【第三方汇总，官方逐案例页未逐一核验：https://myaskai.com/blog/ada-ai-agent-complete-guide-2026 】

### ⑤ COOLFLY 适配度：★☆☆☆☆
- 起步 $30k/年（¥21w+/年）远超 COOLFLY 体量（月咨询 1500-2000 条），直接排除；仅作能力上限参照

## 6. Decagon（可选对象，简要）

- 定位：新一代企业级 AI Agent（Notion、Duolingo 等客户），无自助注册、无公开定价，纯企业销售【第三方：https://www.eesel.ai/blog/decagon-ai-pricing 】
- 定价：按对话或按解决议价；第三方估 $0.99/对话或 $1.5/解决左右；真实合同数据 $105k-923k/年（中位约 $433k/年，Vendr 数据）【第三方：https://myaskai.com/blog/decagon-pricing-explained 、https://quiq.com/blog/decagon-pricing/ 】
- COOLFLY 适配度：★☆☆☆☆，体量完全不匹配，仅作参照。其"AOR（自动解决率）+ 按结果计费"是行业风向标。

## 7. Crisp（可选对象，简要）

- 定位：中小企业全渠道客服，按 workspace 平价收费（非按坐席）；Free / Mini $45 / Essentials $95 / Plus $295 / Enterprise【官方：https://crisp.chat/en/pricing/ 】
- AI：各档含 AI credits（Mini $5≈90 次自动对话、Essentials $25≈450 次、Plus $75≈1350 次），支持"fully autonomous AI agent"+自有数据训练【官方：同上】
- 有 iOS/Android SDK（Crisp 官方 SDK 生态，未逐一核验能力边界）
- COOLFLY 适配度：★★☆☆☆：价格最低（Plus $295/月 ≈ 覆盖 1350 次 AI 对话，正好匹配 COOLFLY 月咨询量），但 AI 排障深度与 Zendesk 衔接最弱，更像"廉价全家桶"而非"嵌入自有体系的 AI 大脑"

---

## 8. 横向对比表

| 平台 | AI 计费模式 | 单价 | 官方解决率口径 | 原生 App SDK | 接 Zendesk | COOLFLY 月成本估算* |
|---|---|---|---|---|---|---|
| Intercom Fin | 按 outcome（解决/交接） | $0.99/outcome【官方】 | 平均 76%【官方】 | ✅ 官方 iOS/Android SDK | ✅ 官方 Fin for Zendesk | ~$900-1200（≈¥6.5-8.6k） |
| Zendesk AI agents | 按 automated resolution（转人工免费） | 官方未公开；第三方 $1.5-2/次 | up to 80%；案例 50-80%【官方】 | ✅ Messaging SDK | ✅（原生同厂） | ~$1500-2100 含坐席（≈¥11-15.5k） |
| Gorgias | 按 resolved conversation | $0.90-1.00/次【官方】 | 60% 即时解决【官方】 | ❌（WebView 嵌入） | ❌（自身是 Zendesk 替代品） | 路线冲突，不测算 |
| Tidio Lyro | 按 AI 对话（回复即计费） | Plus $300+/月 或 Lyro 自 $32.5/月【官方】 | up to 67%（保证线 50%）【官方】 | ✅ 官方 Mobile SDK | ⚠️ 一般集成 | ~$300-500（≈¥2.2-3.6k） |
| Ada | 按对话，年费合同 | $30k+/年起【第三方】 | 70-84%【第三方】 | ✅ | ✅ | 体量不匹配 |
| Decagon | 议价 | 合同中位 $433k/年【第三方】 | 未公开统一口径 | — | — | 体量不匹配 |
| Crisp | workspace 月费+AI credits | Plus $295/月≈1350 次 AI 对话【官方】 | 未找到公开解决率数据 | ✅ | ⚠️ 一般集成 | ~$295（≈¥2.1k） |

*按月咨询 1500-2000 条、AI 触达其中大部分、解决率 50-60% 估算；Zendesk 含 3 坐席 Suite 费；汇率按 1 USD ≈ 7.2 CNY。

---

## 9. 自研（LLM+自有知识库）vs 采购平台

### 成本量级对比（按 COOLFLY 月 1500-2000 条咨询）

| 项 | 自研（现路线延续） | 采购 Fin | 采购 Zendesk AI | 采购 Tidio/Crisp |
|---|---|---|---|---|
| 月度直接成本 | LLM API 费：每会话按 10-20 轮、每轮数千 token 估算，量级约 **$30-150/月**（模型与用量相关，未验证的推断） | ~$900-1200/月 | ~$1500-2100/月（第三方价） | ~$300-500/月 |
| 一次性/人力成本 | 开发+持续调优人力（已有底子，边际投入为主） | 集成+知识库迁移，人力小 | 集成+知识库迁移 | 集成，人力最小 |
| 年度量级 | ¥数千-1.5w（API）+人力 | ≈¥8-10w/年 | ≈¥13-19w/年 | ≈¥2.5-4.5w/年 |

### 自研优势（对 COOLFLY）
1. **成本量级差 10-30 倍**：按 resolution 计费的平台年费 ¥8-19w，直逼 3 人客服团队年成本（¥18-24w）的一半；自研 API 成本仅 ¥1w 上下量级。对 $50 客单价硬件品牌，采购平台的单次解决成本（$1-2）占客单价 2-4%，偏重。
2. **已有资产**：自研 App 内 AI 客服已在跑 + 120 篇飞书知识库——采购平台意味着知识库要迁出飞书体系、重建同步链路。
3. **IoT 排障是非标场景**：装机/联网/配对定位类引导排障需要设备状态、SN、固件版本等私有上下文，未来还要调自有接口（配对定位）——平台的"动作"能力都要二次开发，自研反而路径短。
4. **数据主权**：会话数据全量自持，便于回填基线、迭代知识库。

### 采购优势
1. **解决率工程是护城河**：Fin 76% 平均解决率背后是意图理解、追问澄清、防幻觉、resolution 验证等大量工程，自研短期难追平。
2. **转人工/多语言/多渠道开箱即用**：尤其 Fin for Zendesk 与未来工作台无缝；自研要自己做 App→Zendesk 的工单桥接。
3. **无维护负担**：3 人客服团队没有工程能力，自研依赖公司研发资源持续投入。

### 判断（供 PRD 拍板参考）
- 【推断，来源：本调研+COOLFLY 体量】COOLFLY 月咨询 1500-2000 条属小体量，且核心痛点（装机排障）高度垂直、已有自研底子——**第一版继续自研（LLM+自有知识库）性价比显著更高**；采购平台的钱花在了 COOLFLY 用不满的通用能力上。
- 但应**按平台的设计范式来自研**（见下节），并保留两个后手：①未来接 Zendesk 时评估 Fin for Zendesk（$49/月起小规模试点即可验证）；②若自研解决率长期卡在 40% 以下、且团队无力迭代，再切采购。

---

## 10. 值得借鉴的设计（写进 COOLFLY 方案）

1. **"resolution"的严格定义与验证（Zendesk）**：Zendesk 只有"无人工介入 + LLM 验证确实解决"才算 automated resolution，转人工一律不算。COOLFLY 的核心指标"自助解决率（未转人工且 48h 未复问）"应同样引入验证口径，防止把"用户放弃"算成"解决"（Fin 的计费口径就有这个坑）。
   - 来源：https://support.zendesk.com/hc/en-us/articles/5352026794010
2. **转人工衔接三要素（Fin for Zendesk）**：①AI 判定无法解决即自动转，不让用户反复要求；②转交时带完整会话上下文进工单；③在用户已有渠道内无缝continue，不换入口。COOLFLY 第一版"带 SN 转人工"应对齐：转人工时自动附会话摘要+SN+设备状态。
   - 来源：https://fin.ai/help/en/articles/10602087-fin-for-zendesk-explained
3. **引导式排障=澄清式追问（Zendesk AI agents）**："理解意图、提出澄清问题并实时适应"的多步流程，而非一次性长答案。装机/联网问题应做成决策树式引导（问一步→用户操作→下一步），这正是 Zendesk Advanced 对话流和 Fin Procedure 的做法。
   - 来源：https://www.zendesk.com/service/ai-agents/
4. **解决/未解决的显式确认（Fin）**：Fin 的 resolution 判定依赖"最后回答后用户是否继续求助"。更好的做法（Tidio/Zendesk 均有）是回答后显式问"解决了吗？"并把答案回流指标与知识库优化。
5. **保证线与理想值分开（Tidio）**：Tidio 官方宣传 67% 但合同只敢保证 50%——COOLFLY 定目标时同样应设"目标值（高频类 60%）+ 底线值"双口径，避免用厂商营销口径校准预期。
   - 来源：https://www.tidio.com/pricing/
6. **知识库多源接入（Zendesk/Fin）**：平台都支持帮助中心+外部文档（PDF/Drive）混合接入并统一检索。COOLFLY 的 120 篇飞书文档应建立"飞书=编辑源 → 导出/同步 → 检索库"的单向同步管线，而非在两处维护。

---

## 11. 来源清单（本报告全部引用）

官方：
- https://fin.ai/pricing
- https://fin.ai/help/en/articles/10602087-fin-for-zendesk-explained
- https://fin.ai/help/en/articles/13975743-fin-for-zendesk-explained
- https://fin.ai/help/en/articles/10614196-fin-messenger-zendesk-setup
- https://intercom.help/fin4all/en/articles/10614168-how-fin-integrates-with-zendesk
- https://www.intercom.com/blog/from-resolutions-to-outcomes-evolving-how-fin-delivers-value/
- https://developers.intercom.com/installing-intercom/ios/about-the-sdk
- https://www.intercom.com/help/en/articles/6705301-use-the-messenger-in-your-mobile-app
- https://www.zendesk.com/service/ai-agents/
- https://support.zendesk.com/hc/en-us/articles/5352026794010-About-automated-resolutions-for-AI-agents
- https://support.zendesk.com/hc/en-us/articles/9570369117338-About-automated-resolution-tiers
- https://support.zendesk.com/hc/en-us/articles/4408827701530-Getting-started-with-messaging-for-your-website-help-center-and-mobile-apps
- https://www.gorgias.com/pricing
- https://www.gorgias.com/blog/ai-agent-pricing
- https://docs.gorgias.com/en-US/install-chat-and-enable-ai-agent-on-gorgias-4462157
- https://www.tidio.com/pricing/
- https://www.tidio.com/ai-agent/
- https://www.tidio.com/mobile-sdk/
- https://www.tidio.com/blog/lyro-achieves-best-resolution-rates-in-industry/
- https://www.ada.cx/ 、https://www.ada.cx/platform/
- https://crisp.chat/en/pricing/

第三方（估价/评测，谨慎采信）：
- https://www.voiceflow.com/blog/zendesk-pricing
- https://www.eesel.ai/blog/zendesk-automated-resolutions
- https://coworker.ai/blog/zendesk-ai-pricing
- https://servicedeskagents.com/vs-zendesk/
- https://www.getmacha.com/blog/gorgias-pricing-explained
- https://www.featurebase.app/blog/ada-cx-pricing
- https://corepiper.com/blog/ada-ai-review-2026-pricing-worth-it/
- https://myaskai.com/blog/ada-ai-agent-complete-guide-2026
- https://www.eesel.ai/blog/decagon-ai-pricing
- https://myaskai.com/blog/decagon-pricing-explained
- https://quiq.com/blog/decagon-pricing/
- https://www.eesel.ai/blog/gorgias-sdk
- https://www.npmjs.com/package/@frontend-sdk/gorgias
