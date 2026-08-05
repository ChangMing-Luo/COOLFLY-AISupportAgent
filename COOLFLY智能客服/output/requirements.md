# COOLFLY 智能客服 Requirements Contract

## Metadata

- work_type: feature
- workflow_mode: standard
- revision: 6
- source_prd: PRD详细版.md（952 行，commit a91bee9 Zendesk 转向大重构：D-10 架构基准——C 端服务归 Zendesk 生态（Guide/AI bot/Support/Explore），自研范围=知识运营中台十视图五组（功能标准=v3 原型）；§13 一致性自检为 ID 权威）
- status: active
- generated_from: 阶段 5.5.1（本文件为机器需求契约，不复制 PRD 研究过程；价值、场景与取舍解释见 PRD）

### revision 2 · source_ids_changed（08-04-2026 F09 知识库管理台增量）

- **新增稳定对象（Revision 起始=2，只增补不重排）**：US-F09-01/02/03（×3）、REQ-F09-01…06（×6）、AC-F09-01…07（×7；AC-F09-01–05 对照 PRD AC-M-13/14/15、AC-E-13/14，AC-F09-06/07 为契约层增补）。
- **语义变更的既有对象（ID 不变，Revision 1→2）**：
  - REQ-F05-01：回流消化工作面从「导出文件」升级为 F09 管理台审核队列，周度导出保留为导出能力（PRD §5.6，08-04-2026 拍板）。
  - REQ-F05-02：知识变更生效链路从「飞书修订→导出+定期增量重建索引」改为「管理台发布→发布门禁→索引更新」（PRD §4.4/§5.10）；AC-F05-02 文字随之同步（语义收敛、24h 承诺不变）。
  - External capability configuration 与 Capability prerequisites 的飞书行：从「持续导出+定期增量重建」改为「一次性迁移导入 F09 管理台」，此后管理台=知识库唯一权威源、不做双向同步（PRD §9.2/§0.4）。
  - 阶段二储备登记：「AI 生成型知识库」中的会话提炼与管理台已随 F09 提前进 MVP；阶段二仅保留多渠道客诉采集扩展。

### revision 3 · source_ids_changed（08-04-2026 F09 第二轮增强：效果看板 + 界面语言）

- **新增稳定对象（Revision 起始=3，只增补不重排）**：US-F09-04（×1，PRD §2.4）；REQ-F09-07（知识库效果看板：四卡+条目效果列表，口径引 §8.2、零新增埋点）、REQ-F09-08（界面语言：100% 简体中文 + 界面/内容语言分离 + 语言资源加载）（×2）；AC-F09-08/09/10（×3；AC-F09-08 对照 PRD AC-M-16、AC-F09-09 对照 AC-E-15，AC-F09-10 为契约层增补——REQ-F09-08 界面语言条款在 PRD §10 无对应 AC，按 §5.10「权威源与界面语言」节提炼最小 AC，不新增行为）。
- **语义变更的既有对象**：无。界面语言强化条款独立落 REQ-F09-08（管理台全域横切约束，作用面覆盖全部导航区而非仅条目管理，故不并入 REQ-F09-01）；REQ-F09-01 既有「界面简体中文」表述与之一致，不改义、不标 revision。REQ-F09-07 全部指标由 §4.2 既有埋点聚合（零新增埋点），不触动 REQ-F06-04 语义。

### revision 4 · source_ids_changed（08-04-2026 F09 第三轮重构：五区导航 + 章节树 + 统一过审 + AI 每日抓取 + 全中文含示例）

- **新增稳定对象（Revision 起始=4，只增补不重排）**：REQ-F09-09（知识库总页面章节树：大/小两级书目录式导航、章节运营维护、含条目章节禁删）、REQ-F09-10（AI 录入界面：每日抓取批次展示 + 草稿入队；取舍理由——PRD §5.10 第 ④ 导航区含独立界面（抓取批次列表）与独立异常路径（批次失败/空批次如实标注），为可独立验收的新行为面，并入 REQ-F09-04 会使审核队列语义与批次界面语义混载，故新增 REQ 而非扩写既有 REQ）（×2）；AC-F09-11/12（×2；对照 PRD AC-M-17/18）；AC-F09-13（×1，契约层增补——AI 录入批次展示与失败/空批次如实标注，行为提炼自 PRD §5.10 交互逻辑 4/异常场景，不新增行为）。
- **语义变更的既有对象（ID 不变，Revision→4）**：
  - REQ-F09-01：条目管理归属「知识库总页面」，条目按章节组织（章节树导航拆分至 REQ-F09-09）、编辑器表单增「所属章节」字段、修订须重新过审（统一过审）。
  - REQ-F09-02：录入/批量导入从「先进『待整理』队列」改为**统一进审核队列**（原「待整理」队列已并入审核队列，来源标注「人工录入」「批量导入」区分）；人工审核通过后才正式转入知识库总页面，不存在直接发布入库路径。
  - REQ-F09-03：AI 整理建议增第 ④ 类「所属章节归类建议」；「拒绝不阻塞人工直接编辑与发布」随统一过审修订为「拒绝不阻塞提交进审核队列」（对应 AC-E-13 语义修订）。
  - REQ-F09-04：审核队列=人工+AI 统一入口（来源标注：人工录入/批量导入/AI 录入，可按来源筛选；AI 草稿按频次降序、人工/导入条目按提交时间降序）；「无人审不生效」铁律从"仅 AI 草稿"扩展为**全部新条目/修订**；通过并过发布门禁后条目转入知识库总页面对应章节。
  - REQ-F09-07：原「效果看板（第 5 导航区）」改组更名为「数据看板（第 1 导航区）·知识库数据子看板」（四卡+条目效果列表内容与口径不变），同区新增**客服工作数据子看板**（F06 同源聚合数据在管理台内呈现，两处呈现不重复建设，F06 独立看板页保留）。
  - REQ-F09-08：全中文范围扩展至**界面示例内容**；条目内容语言从「保持英文」修订为**由录入时语言字段选择决定**（§4.1，不再限定必须英文；服务 App 英文用户的生产条目为英文）。
  - US-F09-01/02/04（PRD §2.4 第三轮修订随文更新，见各 US 块内标注）：US-F09-01 增章节归类建议+录入过审后才入总页面；US-F09-02 改为人工+AI 每日抓取草稿统一流入审核队列；US-F09-04 看板归属改为「数据看板·知识库数据子看板」。
  - AC-F09-03（↔AC-M-15 扩展：未审核范围含人工录入与批量导入）、AC-F09-04（↔AC-E-13 修订：不阻塞提交进审核队列）、AC-F09-08（↔AC-M-16 改组：数据看板·知识库数据子看板+同区客服工作数据看板可见）；AC-F09-09（↔AC-E-15）仅随看板更名同步文字、口径不变不计语义变更。

### revision 5 · source_ids_changed（08-04-2026 架构转向 D-10：F01–F08 全系 retire + 中台十视图契约）

- **转向依据**：PRD 重大转向声明 + 决策 D-10（项目纪要 08-04-2026 18:30:58 用户拍板）——C 端服务由 Zendesk 生态承担（Guide 帮助中心中英双语文章 / AI bot 在线聊天自动回答 / Support 邮件与转人工工单 / Explore 客服工作报表），自研范围收缩为**知识运营中台**（独立内部 Web，十视图五组，功能标准=v3 原型 output/pages/知识运营中台v3.dc.html）；App 侧本期完全不动。ID 纪律：已发布 ID 永不重编号，retired 对象保留原 ID 与 EARS 正文（契约史料），新增只增补新 ID。
- **retire（每条附 Retirement note=承接方）**：
  - F01–F08 全系：US×20（US-F01-01…US-F08-02，含契约层增补 US-F07-01）、REQ×37（REQ-F01-01…REQ-F08-03）、AC×54（AC-F01-01…AC-F08-04，含契约层增补 8 条）——承接方逐功能登记见各 Feature 节头与 PRD §0.4。
  - F09 旧对象（五区版语义被 v3 十视图取代）：US-F09-01…04（×4，被 US-F09-05…16 新序列取代，PRD §2.4）；REQ-F09-01/03/05/06/09/10（×6，承接=十视图新 REQ，见各块 Retirement note）；AC-F09-01…05、AC-F09-07/08/09/11/12/13（×11，PRD 对照 AC-M-13…18 / AC-E-13…15 已随 PRD §10.5 全系废止，承接=AC-P 系列新契约 AC）。
  - NFR-001（App 无障碍）/NFR-003（App 性能预期）/NFR-005（引擎演进约束）×3 retired（App/引擎侧来源章节废止；知识条目渠道中立由中台 schema 继承 §4.1）。
- **修订续用（Revision→5）**：REQ-F09-02（录入与批量导入——入库面换锚审核中心+同步 Zendesk）、REQ-F09-04（审核队列→统一过审铁律横切+四眼原则）、REQ-F09-07（数据看板→十视图⑦三页签，数据源换锚 Zendesk 信号）、REQ-F09-08（界面语言延续；条目内容语言修订=中文权威源+英文同步版本）；AC-F09-06/AC-F09-10（契约层增补，随更名与口径同步文字）；NFR-002（合规，来源改 §9.7）、NFR-004（数据治理，来源改 §4.6）。
- **新增稳定对象（Revision 起始=5，只增补不重排）**：US-F09-05…16（×12，PRD §2.4 现役 US 入册）；REQ-F09-11…19（×9：我的工作台/知识库总览/条目工作台/AI 对话挖掘/审核中心/同步中心/反馈回流/操作日志/用户与权限——十视图⑦数据看板承载于修订后 REQ-F09-07，统一过审铁律承载于修订后 REQ-F09-04，不另建重复 REQ）；AC-F09-14…38（×25，一一对应 PRD §10.1 AC-P-01…25，双 ID 表增行）。
- **External capability configuration / Capability prerequisites 重写**：Zendesk 全套（Guide/AI bot/Support/Explore/API）入册；LLM API 用途更新（挖掘聚类起草/中→英翻译/整理建议）；飞书=一次性迁移不变；新增中台内部账号体系（surface=admin，RBAC 视图⑩承载，关联 REQ-F09-19）；G2/G3 标 retired-by-Zendesk、G1 用途改挖掘冷启动语料、G4 保留。

### revision 6 · source_ids_changed（08-05-2026 四项变更：删向量 / 门禁三查 / 取消四眼 / 结构树对齐原型 / 审核 git diff / LLM 语义查重）

- **变更依据**：用户 08-05-2026 四项需求 + 三个开放点拍板（项目纪要 10:31:03 / 10:39:11）。①删除向量设计与相关技术栈集成；②知识库总览结构树 UX/UI 与 v3 原型一致（三级折叠树）；③取消四眼原则（不可自审）限制；④审核中心变更对照改「摘要 + 点击查看 git diff」两层。开放点拍板：发布门禁四查→**三查**（第④查代理评测随向量退役）；挖掘查重改 **LLM 语义查重**（条目 AI 摘要 + 粗筛 Top-5 + LLM 判定理由）；授权对本地库执行破坏性 DDL。
- **修订续用（Revision→6，ID 与 Anchor 不变）**：REQ-F09-04（删四眼硬约束，两条统一过审铁律不变）、REQ-F09-07（条目效果列表删「向量化状态」列）、REQ-F09-12（结构树两级→**三级**；条目列表删向量列）、REQ-F09-13（**向量状态面板整体删除 → AI 摘要面板**；效果五卡→四卡）、REQ-F09-14（三重准入②向量查重→**LLM 语义查重**两段式 + 判定理由 + 降级标注）、REQ-F09-15（变更对照→**两层 git diff**；门禁四查→**三查**；去四眼）；AC-F09-15/17/22/23/25/30/36（随各自 Parent REQ 同步修订，AC-F09-36 由「四眼原则不可自审自发」修订为「审核员自审可执行且留痕」，**ID 不复用不退役**——PRD 对照 ID AC-P-23 同为原地修订）。
- **新增稳定对象（Revision 起始=6，只增补不重排）**：AC-F09-39（↔ PRD AC-P-26 · AI 摘要与语义查重：摘要生成时机与来源徽章、人工校正不被覆盖、候选卡查重理由可见、LLM 不可用如实标注）（×1）。
- **retire**：无。本轮无对象退役——「四眼原则」与「代理评测」是**行为**废止而非对象废止，承载它们的 AC-F09-36 / REQ-F09-15 均原地修订续用，避免双 ID 漂移。
- **术语与外部依赖同步**：PRD 术语表「四眼原则」标已废止（保留仅为追溯）、「代理评测」「向量化状态」条目删除并新增「AI 摘要」；External capability 的 RBAC 行由「审核员 ≥2 人=四眼最低人数前提」改为「≥1 人，2 人下限解除」；数据库选型删除 pgvector。

## ID 体系与映射说明

- F01–F09 / FR-F01–FR-F09 / US-F0x-nn / A-001–A-007：**原样引用 PRD 既有稳定 ID**，不重排、不改义；F01–F08 与 FR-F01–FR-F08 已全系 retired（PRD §0.4/§5.2），F09/FR-F09 为现役唯一功能组（范围升级为知识运营中台）。
- **REQ 层为本契约按规范增补**（PRD 只有 FR/AC 两层，无 REQ 编号）：以组级 FR-F0x 为锚新增 `REQ-F0x-nn`，每条 REQ 标注 `Anchor: FR-F0x` 与 PRD 章节出处；只增补不重排；retired REQ 保留原 Anchor 引用（史料）。
- **AC 双 ID 制**：PRD 原 AC-M·E·S·C·I 系列（55 条）已随 PRD §10.5 **全系 retired**（对应契约 AC 同步 retired，映射表保留为史料）；现役 PRD 系列 = **AC-P-01…25**（PRD §10.1，中台十视图），本契约以 `AC-F09-14…38` 一一对应（每块以 `- PRD 对照 ID:` 行保留双向映射）。完整对照表（含 retired 史料行）：

| 契约 ID | PRD ID | 契约 ID | PRD ID |
| :--- | :--- | :--- | :--- |
| AC-F01-01 | AC-M-04 | AC-F02-05 | AC-S-10 |
| AC-F01-02 | AC-M-05 | AC-F02-06 | AC-S-11 |
| AC-F01-03 | AC-E-01 | AC-F02-07 | AC-I-02 |
| AC-F01-04 | AC-E-02 | AC-F03-01 | AC-M-06 |
| AC-F01-05 | AC-E-03 | AC-F03-02 | AC-M-07 |
| AC-F01-06 | AC-E-04 | AC-F03-03 | AC-E-07 |
| AC-F01-07 | AC-E-06 | AC-F03-04 | AC-E-08 |
| AC-F01-08 | AC-E-12 | AC-F03-05 | AC-E-09 |
| AC-F01-09 | AC-S-02 | AC-F03-06 | AC-E-10 |
| AC-F01-10 | AC-S-03 | AC-F03-07 | AC-S-07 |
| AC-F01-11 | AC-S-04 | AC-F03-08 | AC-I-01 |
| AC-F01-12 | AC-S-05 | AC-F03-09 | AC-I-03 |
| AC-F01-13 | AC-S-06 | AC-F03-10 | AC-I-05 |
| AC-F01-14 | AC-S-08 | AC-F04-01 | AC-M-08 |
| AC-F01-15 | AC-S-09 | AC-F04-02 | AC-M-12 |
| AC-F01-16 | AC-I-04 | AC-F05-01 | AC-M-09 |
| AC-F01-17 | AC-C-01 | AC-F06-01 | AC-M-10 |
| AC-F01-18 | AC-C-02 | AC-F07-01 | AC-C-05 |
| AC-F01-19 | AC-C-03 | AC-F07-02 | AC-C-06 |
| AC-F02-01 | AC-M-02 | AC-F08-01 | AC-M-01 |
| AC-F02-02 | AC-M-03 | AC-F08-02 | AC-M-11 |
| AC-F02-03 | AC-E-05 | AC-F08-03 | AC-E-11 |
| AC-F02-04 | AC-S-01 | AC-F08-04 | AC-C-04 |
| AC-F09-01 | AC-M-13 | AC-F09-04 | AC-E-13 |
| AC-F09-02 | AC-M-14 | AC-F09-05 | AC-E-14 |
| AC-F09-03 | AC-M-15 | AC-F09-08 | AC-M-16 |
| AC-F09-09 | AC-E-15 | AC-F09-11 | AC-M-17 |
| AC-F09-12 | AC-M-18 | — | — |

**现役对照（revision 5 增补，AC-F09-14…38 ↔ AC-P-01…25）**：

| 契约 ID | PRD ID | 契约 ID | PRD ID |
| :--- | :--- | :--- | :--- |
| AC-F09-14 | AC-P-01 | AC-F09-15 | AC-P-02 |
| AC-F09-16 | AC-P-03 | AC-F09-17 | AC-P-04 |
| AC-F09-18 | AC-P-05 | AC-F09-19 | AC-P-06 |
| AC-F09-20 | AC-P-07 | AC-F09-21 | AC-P-08 |
| AC-F09-22 | AC-P-09 | AC-F09-23 | AC-P-10 |
| AC-F09-24 | AC-P-11 | AC-F09-25 | AC-P-12 |
| AC-F09-26 | AC-P-13 | AC-F09-27 | AC-P-14 |
| AC-F09-28 | AC-P-15 | AC-F09-29 | AC-P-16 |
| AC-F09-30 | AC-P-17 | AC-F09-31 | AC-P-18 |
| AC-F09-32 | AC-P-19 | AC-F09-33 | AC-P-20 |
| AC-F09-34 | AC-P-21 | AC-F09-35 | AC-P-22 |
| AC-F09-36 | AC-P-23 | AC-F09-37 | AC-P-24 |
| AC-F09-38 | AC-P-25 | — | — |

- **契约层增补对象**（PRD 无对应 ID）：retired 史料=US-F07-01、AC-F01-20/21、AC-F02-08、AC-F03-11、AC-F05-02、AC-F06-02/03/04、AC-F09-07/13（随所属面 retire）；现役=AC-F09-06（批量导入部分失败逐条报告）、AC-F09-10（界面语言最小 AC）——2 条，行为均提炼自 PRD §5.10 已写死内容，不新增行为。
- **NFR-001–NFR-005 为本契约按模板编号**：现役 NFR-002（合规，PRD §9.7）/NFR-004（数据治理，PRD §4.6）；NFR-001/003/005 retired（来源章节随 F01–F08 废止）。
- 占位规范：「建议值 · 终稿前确认」与 `[PRD 定数 · Zendesk 基线后回填]` 原样保留（清单权威=PRD §13.2），本契约不编数；原 `[PRD 定数 · Gx 后回填]` 占位随 F01–F08 retire 停用（史料保留原文）。
- 未决项（不阻塞契约定稿，PRD §13.3）：拍板 3（上线时间表与迁移节奏，D-10 后重估）、中台账号体系方案终确认、Zendesk 信号可得性（核实清单①③⑤）——兜底规则均已写死。

## External capability configuration

| Capability | Credential owner | Configuration actor | Surface | Scope | Lifecycle | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Zendesk Guide（帮助中心：对外文章中英双语 + Category/Section 结构 + labels，PRD §9.2） | 内部技术团队 | 内部技术团队 | none | system | ready（账号在用/试用中，D-10 用户确认）；结构映射失败→同步阻断并提示先修复映射（§7.2）；Guide 编辑权限收权=drift 治理前提（核实清单⑤，§7.3） | MVP | REQ-F09-12、REQ-F09-16 |
| Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识，PRD §9.2） | 内部技术团队 | 内部技术团队 | none | system | automated resolution 口径与计费依订阅档位（核实清单③，§0.6）；bot 行为配置属 Zendesk 侧运营，不在中台界面内 | MVP | REQ-F09-14、REQ-F09-17 |
| Zendesk Support（人工工单：邮件+转人工 + 客服 Knowledge 面板·仅客服 segment，PRD §9.2） | 内部技术团队 | 内部技术团队 | none | system | Knowledge 面板引用事件待核实（§0.6）；工单信号必得，回流兜底闭环成立 | MVP | REQ-F09-16、REQ-F09-17 |
| Zendesk Explore（客服工作数据报表：工单量/首响/CSAT/人效，本台不重建，PRD §9.2） | 内部技术团队 | 内部技术团队 | none | system | Explore 不可用时客服侧报表暂缺，不影响中台知识闭环；数据看板③页签仅口径说明与指向 | MVP | REQ-F09-07 |
| Zendesk API（同步推送 / 会话与工单拉取（挖掘）/ drift 比对，PRD §9.2/§7.2） | 内部技术团队 | 内部技术团队 | deployment-secret | system | committed；429 限流→批次失败如实标注次日重拉、同步退避重试、初始迁移分批推送避开峰值（节奏「建议值 · 终稿前确认」）；凭据失效→告警指向 owner | MVP | REQ-F09-14、REQ-F09-16 |
| LLM API（挖掘聚类起草 / 中→英翻译 / 整理建议；硬条件=供应商提供 DPA 且输入不用于训练，PRD §9.2/§9.7） | 内部技术团队 | 内部技术团队 | deployment-secret | system | 待配置（上线前完成）；不可用时人工路径照常（AI 为增强不是依赖，§7.1）；翻译失败保留上次英文并阻断同步 | MVP | REQ-F09-13、REQ-F09-14 |
| 飞书知识库导出（120+ 篇一次性迁移导入审核队列，来源标注「批量导入」，PRD §9.2/§9.5） | 用户团队 | 用户团队导出 / 内部技术团队导入 | deployment-secret | system | 一次性：迁移完成即生命周期结束、不留同步链路，此后中台=知识唯一权威源、不做双向同步；导出失败→人工整理逐条录入 | MVP 前 | REQ-F09-02 |
| 中台内部账号体系（RBAC 四角色真实账号；「建议值 邮箱+密码邀请制、首次登录强制改密 · 终稿前确认」，PRD §0.5） | 内部技术团队 | 系统管理员（视图⑩ 用户与权限） | admin | system | 新前置：用户创建须选角色与知识库范围、禁用即时失效、权限矩阵与用户变更全量写审计日志；未就绪=RBAC 与审计失去主体、不满足上线条件 | MVP | REQ-F09-19 |

> 方案商设备日志接口：**不存在（A-003，依据等级 A）**，设备诊断为后置阶段储备（PRD §0.1），不列为本契约外部能力。
>
> 阶段二储备登记（仅方向登记，不新增本契约 REQ/AC，PRD §0.1 后置清单）：App 接入 Zendesk SDK/Messaging（存量自研客服入口改造，D-10 拍板本期不动）；语音/无屏交互渠道；知识库多渠道采集扩展（应用商店评分/更多客服邮箱源进 AI 对话挖掘）；设备状态诊断；中台 UI 多语言切换（REQ-F09-08 语言资源机制已预留）。

## Capability prerequisites

| Prerequisite | Status | Owner | Evidence or deadline | Fallback | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Zendesk 账号与订阅（Guide/AI bot/Support/Explore） | ready | 用户团队 | 已有账号在用/试用中（用户确认 08-04-2026，D-10）；订阅档位与 automated resolution 计费口径在核实清单①③（§0.6） | 无——Zendesk 为本架构基座；档位不足→范围与指标口径重估 | MVP | REQ-F09-14、REQ-F09-16 |
| Zendesk API 凭据（Guide 文章读写 / 工单与会话读取 / Knowledge 面板） | committed | 内部技术团队 | 同步中心、AI 对话挖掘、drift 检测均依赖；限流边界 §7.2 | 无 API→同步退化为人工粘贴、挖掘退化为人工整理（价值大减，不作为验收态） | MVP | REQ-F09-14、REQ-F09-16 |
| 中台内部账号体系（新前置） | committed | 内部技术团队 | 上线前就绪（PRD §0.5，未就绪=不上线）；方案「建议值 邮箱+密码邀请制、首次登录强制改密 · 终稿前确认」 | 无降级态——无账号体系则权限矩阵与审计日志失去主体，不可上线 | MVP | REQ-F09-19 |
| LLM API 选型与部署（DPA 硬条件） | committed | 内部技术团队 | 上线前完成（PRD §9.7 上线前置） | 不可用→挖掘/翻译/建议退化为纯人工路径照常（闭环价值大减，AI 为增强不是依赖） | MVP | REQ-F09-13、REQ-F09-14 |
| 飞书知识库（120+ 篇）导出 | ready | 用户团队 | 已存在（用户确认）；一次性导出→批量导入进审核队列（PRD §9.5） | 导出失败→人工整理逐条录入 | MVP 前 | REQ-F09-02 |
| G1 · 现有 AI 客服历史数据导出 | ready | 用户团队 | 可导出（用户确认）；**用途改为 AI 对话挖掘冷启动语料**（高频问题聚类初始输入 + 初始场景集参照，PRD §9.3）；原基线回填职能由 Zendesk 基线取代（§8.3 检查点） | 无导出→挖掘仅靠 Zendesk 增量会话冷启动，起量慢 | MVP 前 | REQ-F09-14 |
| G2 · 现有系统能力盘点【retired-by-Zendesk，08-04-2026 D-10】 | ready | 内部技术团队 | 前置已解除：拍板 1 随 D-10 关闭、盘点对象消失（PRD §9.3）；剩余价值（客户端错误态清单）归后置 App 接入阶段 | 无需回退——不再是任何现役 REQ 的前置；本行仅作 retired 登记留档 | 后置 | REQ-F08-02（retired 关联留档） |
| G3 · 人工渠道通路查证【retired-by-Zendesk，08-04-2026 D-10】 | ready | 用户团队 | 前置已解除：转人工与回复通路=Zendesk Support 原生能力（PRD §9.3），无需查证自研通路 | 无需回退——本行仅作 retired 登记留档 | 后置 | REQ-F03-03（retired 关联留档） |
| G4 · 退货归因数据链路查证（原因码枚举 / SN↔订单↔用户映射链） | committed | 用户团队 | 保留——价值账重校准（A-005/A-006）仍需该链路（PRD §9.3/§8.3/§11.2） | 映射链不存在→退货归因降级为"原因码粗分类+月度趋势"，价值账重校准承诺同步降级 | MVP 前 | REQ-F09-07 |
| RBAC 角色到人（拍板 2 兼任映射延续；审核员 ≥1 人，系统管理员 1 人；08-05-2026 四眼原则取消后 2 人下限解除） | committed | 企业家 | 上线前名单落实（PRD §9.4） | 单审核员场景下发布制衡完全依赖事后审计（审计日志 append-only）——建议仍配 2 名审核员，但不再是上线硬前提 | MVP | REQ-F09-19、REQ-F09-04 |

> Zendesk 事实核实清单（5 项，owner=用户团队，PRD §0.6）：①订阅档位与各能力开通状态；②帮助中心存量文章盘点（与初始迁移认领对齐，§9.5）；③AI agent 配置现状与 automated resolution 计费口径；④App 聊天入口现状确认（本期不动的基线）；⑤API 凭证权限与 Guide 编辑权限收权（drift 治理前提，§7.3）。核实前信号矩阵相应行标「待核实」、不进达标判定。

---

## Feature F01 · 智能问答会话（FR-F01 · **retired 08-04-2026 D-10** · 承接=Zendesk AI bot；本节 US/REQ/AC 全部 retired，EARS 正文保留为契约史料，ID 永不复用）

### US-F01-01 · 英文提问高频问题，知识库多轮对话解答

- Role: App 用户
- Goal: 用英文直接提问安装/联网/配对/会员问题，几分钟内解决
- Value: 高频问题自助解决时长从人工 1–2 小时降至 ≤10 分钟（假设值）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-02 · 没把握时明说不确定并给转人工

- Role: App 用户
- Goal: AI 对事实性问题没把握时明说"不确定"并主动给转人工入口
- Value: 不被编造答案害着白折腾
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-03 · 愤怒/退款时先安抚、出口置顶

- Role: App 用户
- Goal: 打出退款/愤怒字眼时先被安抚，直接看到置顶转人工与退货政策入口
- Value: 情绪崩溃路径不被技术追问二次激怒（退货率直接来源）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-04 · 连续两次答不上直接给大按钮

- Role: App 用户
- Goal: 同一会话连续两次拒答后直接看到转人工大按钮
- Value: 不被消耗第三次耐心
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-05 · 非英语输入得到兜底说明与转人工

- Role: App 用户
- Goal: 非英语输入收到英文+所用语言模板句说明，照常拿到转人工入口
- Value: 不被无声忽略
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-06 · 开场即知对面是 AI

- Role: App 用户
- Goal: 会话开场知道对面是 AI 助手
- Value: 对回复能力有正确预期（兼加州 bot 披露合规）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### US-F01-07 · Membership 按钮零打字直达会员问答

- Role: App 用户
- Goal: 点首屏 Membership 按钮直接进入会员问答，跳过打字
- Value: 中老年用户（打字意愿低）零门槛咨询会员问题
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）

### REQ-F01-01 · 对话决策总顺序（步骤 0 语言检测 → 关键词规则 → 意图分类 → 路由）

- Story: US-F01-01
- Related-Stories: US-F01-03、US-F01-05（语义关联；契约 Story 取主故事）
- Anchor: FR-F01（PRD §3.1/§3.2/§5.2 交互逻辑 1）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 用户消息进入会话
THE SYSTEM SHALL 按写死顺序处理：步骤 0 语言检测 → 退款/愤怒关键词规则（确定性，清单 v1 见 PRD §12.7）→ 意图分类（知识求解/情绪/闲聊/流程推进/追问澄清五类）→ 仅知识求解类进入三层拒答 → 生成回答或拒答 → 路由出口。
IF 消息为非英语 THEN THE SYSTEM SHALL 直接返回非英语兜底模板（含转人工按钮），不进入关键词规则与意图分类。
IF 关键词规则命中 THEN THE SYSTEM SHALL 进入情绪路径，不进入意图分类与拒答判定。
WHEN 意图分类为闲聊/流程推进/追问澄清类 THE SYSTEM SHALL 按对应豁免路径应答且不触发拒答话术，且豁免类别不得夹带无引用的事实性内容输出（豁免防滥用，评测集陷阱题③防守）。
```

### REQ-F01-02 · 三层拒答与来源标注（知识求解类事实性解答）

- Story: US-F01-01
- Related-Stories: US-F01-02（语义关联；契约 Story 取主故事）
- Anchor: FR-F01（PRD §3.3/§5.2 交互逻辑 5）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 知识求解类消息进入三层拒答判定
THE SYSTEM SHALL 依次执行：①检索相关度低于阈值（阈值为商业参数，上线后调优）→ 拒答；②事实性解答无命中知识条目引用 → 拒答；③命中敏感/超范围硬规则 → 拒答。
WHEN 回答通过第②层 THE SYSTEM SHALL 在回答末尾显示简短来源标注（"Source: {document title}"），且标注与实际命中条目一致（引用忠实率验收的用户侧闭环，R2-裁决 4）。
IF 检索无可靠依据 THEN THE SYSTEM SHALL 拒答并给转人工入口，不输出编造步骤。
高频问题误拒率上限 = [PRD 定数 · G1 后回填]（评测集反向指标）。
```

### REQ-F01-03 · 连续拒答 ≤2 与拒答形态分层

- Story: US-F01-04
- Related-Stories: US-F01-02（语义关联；契约 Story 取主故事）
- Anchor: FR-F01（PRD §3.3/§5.2 拒答行为）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 会话内第 1 次拒答 THE SYSTEM SHALL 呈现常规拒答话术 + 内联转人工链接；IF 为第③层硬规则命中 THEN 使用「拒答 · 超范围/敏感」专属文案（R5-S3），计数规则不变。
WHEN 同一会话连续第 2 次拒答 THE SYSTEM SHALL 呈现极短说明句 + 转人工大按钮（R2-裁决 1），此后本会话不再输出任何拒答类消息（连续拒答 ≤2 为硬上限）。
连续计数规则：任意一次成功事实性解答清零；豁免类消息（闲聊/追问澄清/共情/流程推进）不清零也不累加（§3.3，AC-E-02 与埋点拒答事件统一口径）。
WHILE 会话处于情绪会话（关键词命中或分类器判情绪）IF 知识求解消息触发任一层拒答 THEN THE SYSTEM SHALL 不输出常规拒答措辞，呈现"共情式短语 + 转人工大按钮"（R4-P0），并照常计入连续拒答计数。
```

### REQ-F01-04 · 情绪路径（双机制触发同一行为）

- Story: US-F01-03
- Anchor: FR-F01（PRD §3.1/§3.2/§5.2 情绪路径；§2.3 旅程 C）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 英语消息命中退款/愤怒关键词规则（确定性，硬验收）或被意图分类器判为情绪类（概率性，只进评测集与灰度抽检，不进硬验收）
THE SYSTEM SHALL 进入情绪路径：不追问技术细节、先共情，情绪出口置顶卡出现（Talk to a human + Refund & return policy，置顶常驻不随消息滚动消失），不含任何用户可见优先处理承诺（R2-裁决 7）。
IF 用户愿意继续 THEN THE SYSTEM SHALL 提供"最后试一步"最短排障路径。
WHEN 情绪路径触发转人工 THE SYSTEM SHALL 在交接契约中携带内部情绪会话标记（用户不可见，见 REQ-F03-01/PRD §12.3）。
```

### REQ-F01-05 · 非英语兜底

- Story: US-F01-05
- Anchor: FR-F01（PRD §3.1 步骤 0/§5.2/§7.7）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 用户输入非英语消息 THE SYSTEM SHALL 返回英文+该语言模板句的双语兜底消息（模板不硬编码语言，F07 约束一），附转人工入口；会话不中断、消息不被忽略。
首发预置双语模板语言集合「建议值 西班牙语/法语/德语 · 终稿前确认」；IF 语言在集合外（如日语） THEN 回落纯英文兜底句，转人工入口照常。
IF 输入为混合语言 THEN 按主要语言判定；IF 判定不确定 THEN 按英语处理（判定规则唯一落点 PRD §7.7）。
```

### REQ-F01-06 · 开场 AI 身份披露

- Story: US-F01-06
- Anchor: FR-F01（PRD §5.2 元素表；§9.14 加州 bot 披露）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 新会话创建 THE SYSTEM SHALL 以 AI 身份披露语作为首条系统消息（文案见 PRD §5.2 文案包），每个新会话（含重激活产生的新会话）均重新出现。
```

### REQ-F01-07 · Membership 预置意图直达

- Story: US-F01-07
- Anchor: FR-F01（PRD §3.5/§5.2 交互逻辑 3）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 用户点击首屏 Membership 按钮 THE SYSTEM SHALL 以预置意图直达 F01 知识问答（不走引导流），AI 先出会员主题开场提问（该开场属追问澄清类豁免，不计事实性解答）；用户零打字进入问答，后续提问按知识问答路径应答。
```

### REQ-F01-08 · 输入边界处理

- Story: US-F01-01
- Anchor: FR-F01（PRD §5.2 异常场景/§7.7）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
IF 输入为空/纯空白 THEN 发送按钮置灰，不产生消息。
IF 输入超长（上限「建议值 1,000 字符 · 终稿前确认」） THEN THE SYSTEM SHALL 输入框计数提示并禁止发送，不截断静默发送。
IF 输入为无意义内容（乱码/纯表情） THEN THE SYSTEM SHALL 按追问澄清路径回应，不计拒答、不触发拒答话术。
WHILE AI 流式输出中 WHEN 用户连续发送多条消息 THE SYSTEM SHALL 按发送顺序排队逐条应答，会话流顺序与发送顺序一致，不丢消息。
IF 单会话消息量达上限（「建议值 200 条 · 终稿前确认」） THEN THE SYSTEM SHALL 提示开新会话，旧会话可查。
```

### REQ-F01-09 · 会话生命周期（公共规则）

- Story: US-F01-01
- Anchor: FR-F01（PRD §5.1 公共规则/§7.3，Round 3 裁决 10 + R5-S4/S5）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 非引导态自由对话静默满 30 分钟 THE SYSTEM SHALL 判定会话结束；静默流失不追弹（不推送、不下次打开弹窗）。
WHILE 引导式排障进行中 THE SYSTEM SHALL 豁免静默判定，24h 内返回接续原会话（不计复问）。
WHILE 会话处于「已转接等待」态 THE SYSTEM SHALL 豁免 30 分钟静默判定（目标态持续至人工会话关闭；底线态持续至等待窗口「建议值 24h · 终稿前确认」结束）。
WHEN 已判结束的会话被重新激活并产生用户消息 THE SYSTEM SHALL 按等价新会话处理（计复问）；「再输入=新会话」仅适用于「已结束」态。
```

### REQ-F01-10 · 故障态状态矩阵（不出死屏）

- Story: US-F01-01
- Anchor: FR-F01（PRD §7.1/§7.2/§7.5；原则：任何故障态不出死屏）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
WHEN 消息发出 THE SYSTEM SHALL 立即显示流式/responding 指示（无静默空屏）；首条流式内容出现时间为性能预期「建议值 ≤3 秒 · 终稿前确认」。
IF 响应超过超时阈值（8–10 秒「建议值 · 终稿前确认」）无内容 THEN THE SYSTEM SHALL 显示超时提示 + Retry，转人工入口保持可见。
IF 流式输出中连接中断 THEN THE SYSTEM SHALL 保留已输出内容 + 中断标记 + Retry。
IF LLM 超时/限流/不可用 THEN THE SYSTEM SHALL 展示降级卡（直达转人工 + 排障文章链接）；转人工提交、排障卡片推进、固定入口为确定性路径，不依赖 LLM 可用性。
IF LLM 返回异常内容（空回复/安全策略拦截） THEN 按拒答常规套处理，不展示原始错误。
IF 手机离线 THEN THE SYSTEM SHALL 显示本地离线提示；输入框可编辑、发送置灰；已加载内容保持可读；恢复后自动可发送。
IF 消息发送失败 THEN THE SYSTEM SHALL 显示单条失败标记 + 单条重发；重发最多产生一条消息记录，AI 不对同一消息重复应答。
IF 会话页冷启动加载失败 THEN THE SYSTEM SHALL 给出重试态而非空白页。
WHEN 客服模块任何故障发生 THE SYSTEM SHALL 不影响 App 其余功能（设备直播、通知等）正常使用。
```

### REQ-F01-11 · 无障碍基线（全功能公共约束）

- Story: US-F01-01
- Related-Stories: US-F02-01、US-F03-01（公共约束覆盖全功能；契约 Story 取主故事）
- Anchor: FR-F01（PRD §5.1 通用约定 无障碍 NFR 🟩，覆盖对话流/排障卡片/转人工摘要；验收由 AC-C-01–03 承接，NFR-001 同源）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- Behavior (EARS):

```text
THE SYSTEM SHALL 保证关键可点击元素 ≥44pt；系统字体缩放至最大档不破版、不截断按钮文案；对话流、排障卡片、转人工摘要通过基础 VoiceOver 走查。
```

### AC-F01-01 · Membership 零打字直达会员问答

- PRD 对照 ID: AC-M-04（PRD §10）
- Parent: REQ-F01-07
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户点首屏 "Membership" 按钮
THE SYSTEM SHALL 零打字进入会员问答上下文（预置意图）：AI 主动给出会员主题开场提问/高频问题引导（文案见 PRD §5.2；该开场属追问澄清类豁免，不计事实性解答），用户后续提问按知识问答路径应答。
```

### AC-F01-02 · 四类高频问题英文回答附来源标注

- PRD 对照 ID: AC-M-05（PRD §10）
- Parent: REQ-F01-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户自由输入英文提问〔安装｜联网｜配对｜会员〕类问题（四类各为一个独立验收场景）
THE SYSTEM SHALL 给出基于知识库的英文回答，知识求解类回答末尾可见简短来源标注（如 "Source: Setup Guide"；可见但轻量，不展开全文引用、不加跳转承诺），且不输出编造步骤（拒答侧由 AC-E-01 约束）。
```

### AC-F01-03 · 知识库外事实性问题明确拒答

- PRD 对照 ID: AC-E-01（PRD §10）
- Parent: REQ-F01-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户问知识库覆盖不到的事实性问题（检索无可靠依据）
THE SYSTEM SHALL 明确承认无法确定答案（常规拒答话术），同屏给出转人工入口，且不输出编造的操作步骤。
```

### AC-F01-04 · 连续第 2 次拒答直接大按钮

- PRD 对照 ID: AC-E-02（PRD §10）
- Parent: REQ-F01-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 同一会话内连续第 2 次拒答（连续计数重置规则以 PRD §3.3 为准：成功事实性解答清零，豁免类不清零不累加）
THE SYSTEM SHALL 直接呈现极短说明句 + 转人工大按钮，且不出现第 3 次"我没把握"式回复。
```

### AC-F01-05 · 退款/愤怒关键词命中进情绪路径（硬验收）

- PRD 对照 ID: AC-E-03（PRD §10）
- Parent: REQ-F01-04
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户消息命中退款/愤怒类关键词（如 refund、garbage；判定凭据=关键词清单 v1，唯一落点 PRD §12.7）
THE SYSTEM SHALL 使本条消息不进入拒答判定、不被追问技术细节，回复共情话术（情绪路径开场），且转人工与退货政策两个入口置顶常驻可见（100% 可复现）。
```

### AC-F01-06 · 非英语输入兜底

- PRD 对照 ID: AC-E-04（PRD §10）
- Parent: REQ-F01-05
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户输入非英语文本（如西班牙语）
THE SYSTEM SHALL 返回英文 + 该语言模板句的说明（当前仅支持英文）并照常提供转人工入口；会话不中断、不忽略该消息。
```

### AC-F01-07 · 敏感/超范围问题专属拒答

- PRD 对照 ID: AC-E-06（PRD §10）
- Parent: REQ-F01-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户问敏感/超范围问题（第③层硬规则命中，范围见 PRD §3）
THE SYSTEM SHALL 拒答并说明能力边界，给出转人工入口，使用第③层专属文案（R5-S3），不使用"找不到答案"语义的常规拒答套。
```

### AC-F01-08 · 无意义输入按追问澄清处理

- PRD 对照 ID: AC-E-12（PRD §10）
- Parent: REQ-F01-08
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户发送无意义输入（乱码/纯表情）
THE SYSTEM SHALL 按追问澄清路径回应（文案见 PRD §5.2），不计拒答、不触发拒答话术。
```

### AC-F01-09 · 静默 30 分钟结束

- PRD 对照 ID: AC-S-02（PRD §10）
- Parent: REQ-F01-09
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 非排障态自由对话静默超过 30 分钟
THE SYSTEM SHALL 按静默结束处理该会话（结束态评分触达遵循 PRD §5/§7 定义），且静默流失不追弹。
```

### AC-F01-10 · 重激活=新会话

- PRD 对照 ID: AC-S-03（PRD §10）
- Parent: REQ-F01-09
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 已判结束的会话被用户重新打开并发送新消息
THE SYSTEM SHALL 按新会话处理（口径上计复问），用户侧对话体验连续、无报错。
```

### AC-F01-11 · 响应超时可重试

- PRD 对照 ID: AC-S-04（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN AI 响应超时（超过 8–10 秒，「建议值 · 终稿前确认」）
THE SYSTEM SHALL 出现重试提示，用户可重试或直接转人工；期间有流式/加载指示，无静默空屏。
```

### AC-F01-12 · LLM 不可用降级

- PRD 对照 ID: AC-S-05（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN LLM 服务不可用/限流
THE SYSTEM SHALL 保持客服入口不出死屏：界面降级为直达转人工 + 相关排障文章入口。
```

### AC-F01-13 · 离线打开入口

- PRD 对照 ID: AC-S-06（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 手机离线时打开客服入口
THE SYSTEM SHALL 显示本地离线提示，恢复网络后可正常进入；无死屏无崩溃。
```

### AC-F01-14 · 流式中断保留已输出内容

- PRD 对照 ID: AC-S-08（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN AI 回复流式输出中网络中断（弱网）
THE SYSTEM SHALL 保留已输出内容并带中断标记，用户可重试；不出现整条消息消失或空屏。
```

### AC-F01-15 · 消息发送失败可单条重发

- PRD 对照 ID: AC-S-09（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户消息发送失败（弱网/瞬断）
THE SYSTEM SHALL 为该条消息展示失败标记并支持单条重发；重发成功后不在会话流中重复出现。
```

### AC-F01-16 · App 现有功能不受影响（不变行为）

- PRD 对照 ID: AC-I-04（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 客服模块发生任何故障（LLM 不可用、引擎超时）
THE SYSTEM SHALL 保证 App 其余功能（设备直播、通知等）正常使用不受影响（不变行为，故障期间持续成立）。
```

### AC-F01-17 · 最大字体缩放不破版

- PRD 对照 ID: AC-C-01（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户开启系统最大字体缩放
THE SYSTEM SHALL 保证对话与排障卡片不破版、按钮文字完整可读。
```

### AC-F01-18 · 关键按钮触达区域 ≥44pt

- PRD 对照 ID: AC-C-02（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户在任一关键操作场景（排障推进、转人工确认等）点按关键按钮（Done / It didn't work / 转人工等），含最大字号档
THE SYSTEM SHALL 保证按钮可点、响应正常，触达区域 ≥44pt。
```

### AC-F01-19 · VoiceOver 基础走查

- PRD 对照 ID: AC-C-03（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN VoiceOver 开启走完主流程（进入入口→提问→转人工）
THE SYSTEM SHALL 保证关键控件可被读出、可操作（基础走查级，及格线不下放）。
```

### AC-F01-20 · 对话决策顺序生效（契约层增补）

- Parent: REQ-F01-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 用户消息进入会话
THE SYSTEM SHALL 按写死顺序处理：步骤 0 语言检测 → 退款/愤怒关键词规则 → 意图分类 → 路由，且仅知识求解类进入三层拒答判定；非英语消息直接返回兜底模板、关键词命中直接进情绪路径（可分别由 AC-F01-06、AC-F01-05 场景复现，顺序依据 PRD §3.1/§3.2）。
```

### AC-F01-21 · 开场 AI 身份披露（契约层增补）

- Parent: REQ-F01-06
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研问答运行时废止，承接方=Zendesk AI bot（在线聊天自动回答，知识源=中台同步的帮助中心文章与内部知识；PRD §0.4）
- EARS:

```text
WHEN 新会话创建（含重激活产生的新会话）
THE SYSTEM SHALL 以 AI 身份披露语作为首条系统消息（文案见 PRD §5.2 文案包；兼加州 bot 披露合规，PRD §9.14）。
```

---

## Feature F02 · 引导式排障（FR-F02 · **retired 08-04-2026 D-10** · 承接=Zendesk bot 对话流+帮助中心排障文章（「操作流程型」条目继续生产）；本节全部 retired，EARS 保留为契约史料）

### US-F02-01 · 首屏零打字按钮直达分步引导

- Role: App 用户
- Goal: 面对空白输入框不知道打什么时（中老年为典型），首屏按钮点按直接进入一步一屏分步引导
- Value: 打字意愿低的用户零门槛进入排障
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）

### US-F02-02 · 每步只选 Done / It didn't work，永无死胡同

- Role: App 用户
- Goal: 每一步只需在两个大按钮里选一个，永远不会走进死胡同
- Value: 排障路径必达终点（解决或转人工）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）

### US-F02-03 · 切出返回自动恢复步骤

- Role: App 用户
- Goal: 切出 App 改路由器设置后返回（24h 内）自动恢复到刚才的排障步骤
- Value: 不用从头再来（弱网/切网是核心用户主路径）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）

### REQ-F02-01 · 三场景一步一屏引导流

- Story: US-F02-01
- Related-Stories: US-F02-02（语义关联；契约 Story 取主故事）
- Anchor: FR-F02（PRD §5.3 元素表/交互逻辑 1–2/§3.5）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
WHEN 用户点首屏按钮（Setup / Won't connect / Pairing failed）或被意图分类路由至对应场景或错误态开场确认后进入
THE SYSTEM SHALL 进入对应场景引导流第一步：会话流内全宽步骤卡片（一步一屏，R5-S1，不做独立全屏/浮层），卡片主操作仅 Done / It didn't work 两个大按钮（无 👍/👎），进度指示不带总步数分母。
WHEN 用户点 Done THE SYSTEM SHALL 进入下一步；WHEN 末步 Done THE SYSTEM SHALL 给出解决确认并触发 F04 会话评分。
THE SYSTEM SHALL 在每张卡片提供不与主按钮抢层级的转人工次级入口。
覆盖场景 = 安装/联网/配对三大高频场景 🟩；Top 3 场景关键分支步骤配图 🟩（含 2.4GHz/5GHz 与 Mesh、指示灯状态、扫码失败分支，差评 #1/#2/#4 素材）。
```

### REQ-F02-02 · 无死胡同分支图约束

- Story: US-F02-02
- Anchor: FR-F02（PRD §3.6/§4.1/§5.3 交互逻辑 3，R2-裁决 9）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
THE SYSTEM SHALL 以结构化流程（步骤+分支显式建模）承载排障逻辑；LLM 只负责意图识别、上下文衔接与话术生成，不发明步骤。
排障分支图 SHALL 满足：①无环，或环上必须存在转人工出口；②所有叶子节点 ∈ {确认解决, 转人工}；图遍历自动验证通过率 100%（交付验收项）。
WHEN 用户第二次到达同一步骤（循环上限「建议值 2 次 · 终稿前确认」）THE SYSTEM SHALL 在卡片附加转人工提示条，不让用户无限循环。
WHEN 排障穷尽或用户点转人工 THE SYSTEM SHALL 进入 F03，摘要自动带已试步骤与卡点。
```

### REQ-F02-03 · 进度持久化与 24h 接续

- Story: US-F02-03
- Anchor: FR-F02（PRD §5.3 交互逻辑 5/异常场景/§5.1）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
WHEN 用户排障中切出 App（切网/断网/杀进程）后返回且在 24h 接续窗口内
THE SYSTEM SHALL 自动恢复到离开时的排障步骤（恢复提示条可点击回达），原会话接续、不计复问；排障进行中豁免 30 分钟静默结束。
IF 超 24h 接续窗口后返回 THEN 原会话按已结束处理并展示过期提示（文案见 PRD §5.3）；重新进入同场景=新会话、从第一步开始。
WHILE 排障中手机离线 THE SYSTEM SHALL 保持当前卡片内容可读、按钮点击给离线提示，恢复后操作生效、不丢当前步骤。
会话状态与排障进度须强一致（PRD §4.5）。
```

### REQ-F02-04 · 排障中自由输入处理

- Story: US-F02-02
- Anchor: FR-F02（PRD §5.3 交互逻辑 4）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
WHILE 排障进行中 WHEN 用户自由输入
THE SYSTEM SHALL 由 LLM 做意图识别与上下文衔接：追问澄清就地解答后回到当前步骤；情绪触发（关键词或分类器）走 F01 情绪路径（出口置顶）；与当前场景无关的新知识求解照常走 §3 决策顺序（含三层拒答，排障态不构成拒答豁免后门），之后询问是否继续排障。
```

### REQ-F02-05 · 排障内容版本一致性与配图降级

- Story: US-F02-02
- Anchor: FR-F02（PRD §5.3 异常场景/§7.3 灰度切换）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
WHEN 排障流程内容更新或灰度开关切换时存在进行中会话
THE SYSTEM SHALL 让进行中会话按其进入时的流程版本/引擎分桶走完，不中途换图换步骤、不被打断；新会话使用新版本/新分桶。
IF 步骤配图加载失败 THEN THE SYSTEM SHALL 隐藏图片位，文字说明独立完整可操作（配图是增强不是依赖）。
```

### REQ-F02-06 · 排障能力边界（不做设备诊断）

- Story: US-F02-02
- Anchor: FR-F02（PRD §0.3 不做边界/A-003/§9.4）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- Behavior (EARS):

```text
THE SYSTEM SHALL NOT 在会话中出现读取设备状态/远程诊断类功能承诺或界面（第二阶段边界）；配对类问题上限 = 知识库引导自查 + 收集 SN/上下文转人工（A-003 已确认现状）。
```

### AC-F02-01 · 首屏按钮直达配对引导

- PRD 对照 ID: AC-M-02（PRD §10）
- Parent: REQ-F02-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 用户在对话首屏不打字，点 "Pairing failed" 按钮
THE SYSTEM SHALL 直接进入配对排障分步引导第一步：一步一屏，卡片主操作仅 "Done" / "It didn't work" 两个大按钮（无 👍/👎），转人工为不与主按钮抢层级的次级入口且每张卡片可达（AC-I-01 的落地件）。
```

### AC-F02-02 · 末步 Done 触发解决确认与评分

- PRD 对照 ID: AC-M-03（PRD §10）
- Parent: REQ-F02-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 用户在引导步骤点 "Done" 且为最后一步
THE SYSTEM SHALL 给出解决确认，随后出现会话级轻量评分入口。
```

### AC-F02-03 · It didn't work 永不进死胡同

- PRD 对照 ID: AC-E-05（PRD §10）
- Parent: REQ-F02-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 用户在排障引导中点 "It didn't work"
THE SYSTEM SHALL 进入替代分支或转人工出口，绝不出现"无下一步可点"的死胡同（排障全分支适用）。
```

### AC-F02-04 · 中途切出 2 小时后返回自动恢复

- PRD 对照 ID: AC-S-01（PRD §10）
- Parent: REQ-F02-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 用户在排障中途切出 App（如去改路由器设置），2 小时后返回
THE SYSTEM SHALL 自动恢复到离开时的排障步骤并接续原会话（24h 内有效），该会话不因 30 分钟静默被判结束。
```

### AC-F02-05 · 24h 窗口过期后新会话

- PRD 对照 ID: AC-S-10（PRD §10）
- Parent: REQ-F02-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 排障会话 24h 接续窗口过期后用户返回同场景
THE SYSTEM SHALL 将原会话按已结束处理并展示过期提示（文案见 PRD §5.3）；重新进入该场景为新会话、从第一步开始。
```

### AC-F02-06 · 内容更新/灰度切换不打断进行中会话

- PRD 对照 ID: AC-S-11（PRD §10）
- Parent: REQ-F02-05
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 排障流程内容更新（知识库改造/回流修订）或灰度开关切换时存在进行中会话
THE SYSTEM SHALL 让进行中会话按其进入时的版本走完、不中途换步骤、不被打断；新会话使用新版本/新分桶。
```

### AC-F02-07 · 不做设备诊断（不变行为）

- PRD 对照 ID: AC-I-02（PRD §10）
- Parent: REQ-F02-06
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 用户处于本期任一会话场景
THE SYSTEM SHALL NOT 出现读取设备状态/远程诊断类功能承诺或界面（不变行为，全会话场景持续成立）；配对类问题上限 = 引导自查 + 带 SN 转人工（A-003）。
```

### AC-F02-08 · 排障中自由输入不脱轨（契约层增补）

- Parent: REQ-F02-04
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：C 端排障卡片流废止，承接方=Zendesk bot 对话流+帮助中心排障文章（步骤内容以「操作流程型」条目在中台继续生产，PRD §0.4/§4.1）
- EARS:

```text
WHEN 排障进行中用户自由输入追问澄清类问题
THE SYSTEM SHALL 就地解答后回到当前排障步骤；情绪触发走 F01 情绪路径（出口置顶），无关的新知识求解照常走 §3 决策顺序（含三层拒答）后询问是否继续排障（PRD §5.3 交互逻辑 4）。
```

---

## Feature F03 · 人机衔接（FR-F03 · **retired 08-04-2026 D-10** · 承接=Zendesk Support 工单+客服 Knowledge 面板；本节全部 retired，EARS 保留为契约史料）

### US-F03-01 · 转人工零复述（摘要三件套可见可补充）

- Role: App 用户
- Goal: 一键转人工时系统自动带上会话摘要+SN+设备型号，本人可见可补充
- Value: 到了人工那里不用从头复述
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）

### US-F03-02 · 知道去哪等（如实告知渠道与时限）

- Role: App 用户
- Goal: 转人工后界面如实告知回复渠道、预计时长、超时找谁
- Value: 不对着聊天窗干等一个不会来的回复
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）

### REQ-F03-01 · 交接摘要生成与最小数据契约

- Story: US-F03-01
- Anchor: FR-F03（PRD §5.4 交互逻辑 1/§12.3/§3.7-3）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
WHEN 用户触发转人工（拒答链接/大按钮/情绪置顶卡/排障分支终点/会话菜单）
THE SYSTEM SHALL 自动生成交接摘要并对用户完整可见：固定字段顺序 = 已试步骤 / SN / 型号 / 卡点 + 会话 ID + 情绪会话标记（内部字段，用户不可见），字段顺序固定不重排（兼未来 Zendesk 映射底稿）。
THE SYSTEM SHALL 允许用户在 Add details 补充（上限「建议值 500 字符 · 终稿前确认」），补充内容追加进摘要。
WHEN 转接确认 THE SYSTEM SHALL 使客服侧可见：摘要固定字段 + 用户补充 + 会话 ID + 会话记录摘要文本（默认回溯载体，R5-T3；可点开会话链接为 G3 查证项，查证通过才启用）+ 情绪会话标记。
WHEN 用户重复点击确认按钮 THE SYSTEM SHALL 提交中置灰，只产生一次转接（客服侧不收到重复单）。
```

### REQ-F03-02 · 等待承诺分层与首响不劣化

- Story: US-F03-02
- Anchor: FR-F03（PRD §5.4 交互逻辑 2–3/§6.3/§8.2 转人工首响行）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
WHEN 转接确认成功 THE SYSTEM SHALL 按 G3 查证层级展示等待承诺：
- 目标态：确认已转接 + 预计响应时间（近期实际首响滚动值「建议值 近 7 天中位数 · 终稿前确认」或分档展示，禁止硬编码）+ 明示可关闭页面、回复会通知。
- 底线态：确认已转接 + 如实告知回复渠道（如邮件）与预计时限 + 写明超时联系方式；话术禁止出现"回复会通知你"。
IF 滚动首响值不可得（冷启动/数据不足） THEN 分档兜底展示（"usually within a few hours"），仍禁止硬编码具体小时数。
IF 账号无可见邮箱（Apple 隐私转发/未绑定） THEN 使用底线态 ②-fallback 文案。
转人工首响 SHALL 不劣于上线前人工渠道水平（基线 [PRD 定数 · G1 后回填]）；测量口径分层：目标态=「客服首条回复送达」事件自动测量，底线态=人工渠道统计（口径 [PRD 定数 · G3 后回填]）。
```

### REQ-F03-03 · 目标态回复写回、push 与超时安抚

- Story: US-F03-02
- Anchor: FR-F03（PRD §5.4 交互逻辑 2/4/5，§6.3 时序）
- Stage: MVP（目标态，随 G3）
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
WHILE 目标态 WHEN 转接确认且 push 权限未授权 THE SYSTEM SHALL 场景化触发一次权限请求；IF 用户拒绝 THEN 界面明示"回复送达后请回到本页查看"，不重复弹权限。
WHEN 人工客服首条回复产生 THE SYSTEM SHALL 将回复写回同一会话流并 push 通知（埋点「客服首条回复送达」事件）；IF push 通道失败 THEN 回复仍写回会话流，用户回到 App 可见完整回复。
IF 超过承诺时间 ×缓冲系数「建议值 1.5 倍 · 终稿前确认」未有人工回复 THEN THE SYSTEM SHALL 主动下发安抚消息（含超时联系方式；是状态说明不是新承诺）。
```

### REQ-F03-04 · 转接失败与摘要失败降级

- Story: US-F03-01
- Anchor: FR-F03（PRD §5.4 异常场景，R5-S6）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
IF 转接提交失败（网络/渠道故障） THEN THE SYSTEM SHALL 显式失败提示 + Retry；IF 连续失败达「建议值 2 次 · 终稿前确认」 THEN 展示兜底联系方式（客服邮箱）且摘要保留可复制，不出死屏、不静默丢弃请求。
IF 摘要自动生成失败 THEN THE SYSTEM SHALL 不阻塞转人工：降级为"会话记录直达客服"+ 用户手填卡点描述（转人工可用性优先于摘要完整性）。
```

### REQ-F03-05 · 「已转接等待」态行为

- Story: US-F03-02
- Anchor: FR-F03（PRD §5.4 异常/§7.1 状态矩阵/§6.2，R5-S4/S5）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
WHEN 转接确认 THE SYSTEM SHALL 使会话进入「已转接等待」态（≠已结束）：目标态持续至人工会话关闭；底线态持续至等待窗口「建议值 24h · 终稿前确认」结束；该态豁免 30 分钟静默判定。
WHILE 已转接等待 WHEN 用户继续输入：目标态 THE SYSTEM SHALL 将消息计入同一会话流待客服查看并出现"已交人工"提示；底线态 THE SYSTEM SHALL 展示"已交人工"提示 + Continue with the AI assistant 按钮（点击开启新自助会话，原转接与人工处理不受影响）；两态输入均不静默丢弃。
WHILE 目标态已转接等待 THE SYSTEM SHALL 将客服回复与用户输入在同一会话流按时间序合并，不出现消息被覆盖或丢失。
WHEN 人工会话关闭（目标态）或等待窗口结束（底线态） THE SYSTEM SHALL 使会话转入「已结束」态，其后再输入=新会话。
```

### REQ-F03-06 · SN/型号缺失与多设备不阻塞

- Story: US-F03-01
- Anchor: FR-F03（PRD §5.4 异常场景）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
IF SN/型号缺失（未绑定设备） THEN THE SYSTEM SHALL 使摘要对应字段显示为空并提示可手动补充；IF 用户绑定多台设备 THEN 让用户选择涉事设备；缺失/多选均不阻塞转接。
```

### REQ-F03-07 · 转人工全程可达（不硬拦截）

- Story: US-F03-01
- Anchor: FR-F03（PRD §10.5 AC-I-01/§0.3 不做边界"硬拦截降转人工率"）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Behavior (EARS):

```text
WHEN 用户在任何会话状态下主动要求转人工
THE SYSTEM SHALL 使转人工流程可达；不存在"必须先走完 N 步排障才许转"的强制门槛。
```

### AC-F03-01 · 转人工摘要可见可补充

- PRD 对照 ID: AC-M-06（PRD §10）
- Parent: REQ-F03-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 自助未解决，用户点转人工
THE SYSTEM SHALL 展示将发送给客服的摘要（含已试步骤/SN/型号/卡点）供用户编辑补充；确认后显示回复渠道与预计时间（按 G3 层级取对应话术）。
```

### AC-F03-02 · 客服侧零复述

- PRD 对照 ID: AC-M-07（PRD §10）
- Parent: REQ-F03-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 人工客服（间接角色）收到转人工会话
THE SYSTEM SHALL 使客服可见完整交接信息：会话摘要、已试步骤、SN、设备型号、卡点——无需向用户再要一遍（SOP 首条回复引用摘要属运营验收，PRD §9.12）。
```

### AC-F03-03 · 目标态超时安抚

- PRD 对照 ID: AC-E-07（PRD §10）
- Parent: REQ-F03-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 转人工后超过承诺时间（含缓冲系数「建议值 1.5 倍 · 终稿前确认」，唯一落点 PRD §5.4）未有人工回复（目标态）
THE SYSTEM SHALL 使用户收到主动安抚消息（含超时联系方式）；不发生"承诺了通知却永远沉默"。
```

### AC-F03-04 · 转接提交失败可重试

- PRD 对照 ID: AC-E-08（PRD §10）
- Parent: REQ-F03-04
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 用户确认转人工时提交失败（网络/渠道故障）
THE SYSTEM SHALL 显式失败提示且可重试；连续失败后展示兜底联系方式（客服邮箱），不出死屏、不静默丢弃请求。
```

### AC-F03-05 · 摘要生成失败不阻塞转人工

- PRD 对照 ID: AC-E-09（PRD §10）
- Parent: REQ-F03-04
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 转人工摘要自动生成失败
THE SYSTEM SHALL 不阻塞转人工：降级为"会话记录直达客服"+ 用户手填卡点描述（转人工可用性优先于摘要完整性）。
```

### AC-F03-06 · SN 缺失/多设备不阻塞转接

- PRD 对照 ID: AC-E-10（PRD §10）
- Parent: REQ-F03-06
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 用户未绑定设备（SN/型号缺失）或绑定多台设备时转人工
THE SYSTEM SHALL 使摘要对应字段显示为空并可手动补充；多设备时可选择涉事设备；缺失/多选均不阻塞转接。
```

### AC-F03-07 · push 权限被拒后的明示

- PRD 对照 ID: AC-S-07（PRD §10）
- Parent: REQ-F03-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 用户转人工时被请求通知权限并拒绝（目标态）
THE SYSTEM SHALL 明示改为"主动回来查看回复"的指引，不再承诺通知送达。
```

### AC-F03-08 · 不硬拦截转人工（不变行为）

- PRD 对照 ID: AC-I-01（PRD §10）
- Parent: REQ-F03-07
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 用户在任何会话状态下主动要求转人工
THE SYSTEM SHALL 使转人工流程均可达；不存在"必须先走完 N 步排障才许转"的强制门槛。
```

### AC-F03-09 · 转人工首响不劣于现状（不变行为）

- PRD 对照 ID: AC-I-03（PRD §10）
- Parent: REQ-F03-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 转人工请求产生至人工首次回复
THE SYSTEM SHALL 保证时长不劣于上线前人工渠道水平（基线 [PRD 定数 · G1 后回填]）；测量口径随 G3 分层：目标态=「客服首条回复送达」事件自动测量（PRD §4.2）；底线态=人工渠道统计（口径 [PRD 定数 · G3 后回填]）。
```

### AC-F03-10 · 不虚假承诺（不变行为）

- PRD 对照 ID: AC-I-05（PRD §10）
- Parent: REQ-F03-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 会话处于底线态转人工
THE SYSTEM SHALL NOT 在话术中出现"回复会通知你"字样；界面不出现硬编码固定承诺时长（预计响应时间为滚动实际值或分档展示）；不出现任何无实现载体的用户可见优先接入承诺（R2-裁决 7；不变行为，底线态全程持续成立）。
```

### AC-F03-11 · 已转接等待态输入不丢弃（契约层增补）

- Parent: REQ-F03-05
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：转人工与工单流转承接方=Zendesk Support 人工工单（邮件+转人工）+客服 Knowledge 面板（PRD §0.4）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- EARS:

```text
WHEN 会话处于「已转接等待」态且用户继续输入
THE SYSTEM SHALL 不静默丢弃输入：目标态将消息计入同一会话流待客服查看并出现"已交人工"提示；底线态展示"已交人工"提示 + Continue with the AI assistant 按钮；该态豁免 30 分钟静默判定（PRD §5.4/§7.1）。
```

---

## Feature F04 · 会话反馈·两层（FR-F04 · **retired 08-04-2026 D-10** · 承接=Zendesk CSAT+文章投票+客服 flag；本节全部 retired，EARS 保留为契约史料）

### US-F04-01 · 消息级 👍/👎 与点踩原因

- Role: App 用户
- Goal: 对 AI 单条回答点 👍/👎，点踩可选原因（不相关/看不懂/试了没用）
- Value: 答错的地方被修正（回流第一数据源）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）

### US-F04-02 · 会话级轻量评分

- Role: App 用户
- Goal: 结束会话时用一次轻量评分表达是否解决了问题
- Value: 严口径解决率的显式确认信号
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）

### REQ-F04-01 · 消息级反馈

- Story: US-F04-01
- Anchor: FR-F04（PRD §5.5 元素表/交互逻辑 3）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）
- Behavior (EARS):

```text
WHEN AI 事实性回答输出完成 THE SYSTEM SHALL 在气泡下方出现 👍/👎（挂全部 F01 事实性回答消息，含 Membership 预置意图路径；排障卡片、拒答消息、系统消息不挂）。
WHEN 用户点 👎 THE SYSTEM SHALL 弹出三选原因浮层（Not relevant / Hard to understand / I tried it — didn't work）且可跳过；点踩即入 F05 回流，不依赖是否选原因。
WHEN 用户 👍↔👎 反复切换 THE SYSTEM SHALL 以最后一次为准，回流清单同步修正、不产生重复条目。
```

### REQ-F04-02 · 会话级评分触达分型

- Story: US-F04-02
- Anchor: FR-F04（PRD §5.5 交互逻辑 1–2/§4.2 满意度评分分型，R2-裁决 2）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）
- Behavior (EARS):

```text
WHEN 用户确认解决（排障末步 Done / 明示解决） THE SYSTEM SHALL 立即弹会话评分卡（"Did this solve your problem?" [Yes] [Not yet] + 可选星级；语义值 Yes/No，映射见 PRD §4.2），每会话最多出现一次。
WHEN 目标态转人工完成（人工会话关闭，信号来源为 G3 查证项） THE SYSTEM SHALL 触达会话评分卡；IF 查无关闭信号 THEN 评分触达与严口径分母按底线态口径处理（降级口径 [PRD 定数 · G3 后回填]）。
WHEN 底线态转接确认 THE SYSTEM SHALL 只触达服务体验类反馈，不问"是否解决"（解决维度按行为口径+保守折算，不新增打分弹窗）。
WHEN 静默 30 分钟超时（非排障态） THE SYSTEM SHALL 不追弹（不推送、不下次打开弹窗），未答复按严口径保守折算。
IF 评分卡出现后用户又输入新消息 THEN 评分卡收起，该输入按"重新激活=新会话"处理，旧会话评分记未答复。
IF 评分提交时网络中断 THEN 本地暂存、恢复后自动补报，用户看到提交成功态。
IF 评分卡与转人工等待承诺同屏冲突 THEN 等待承诺优先展示，评分卡延后。
```

### AC-F04-01 · 点踩流程

- PRD 对照 ID: AC-M-08（PRD §10）
- Parent: REQ-F04-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）
- EARS:

```text
WHEN 用户对 AI 单条回答点 👎
THE SYSTEM SHALL 出现原因选择（不相关/看不懂/试了没用），提交后界面确认收到；用户跳过原因选择时点踩状态仍保持选中；无论是否选原因，该消息均进入回流清单（清单可观察结果见 AC-M-09）。
```

### AC-F04-02 · 底线态转接只问服务体验

- PRD 对照 ID: AC-M-12（PRD §10）
- Parent: REQ-F04-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研埋点反馈体系废止，承接方=Zendesk CSAT+帮助中心文章投票+客服 flag（信号矩阵 PRD §4.3/§8.2；回流侧承接=REQ-F09-17）
- EARS:

```text
WHEN 底线态下用户完成转人工转接确认
THE SYSTEM SHALL 仅出现服务体验类反馈入口（文案见 PRD §5.5），不出现"是否解决"提问；该会话的解决维度由行为口径统计（R2-裁决 2）。
```

---

## Feature F05 · 知识库升级与回流闭环（FR-F05 · **retired（升级并入 F09）08-04-2026 D-10** · 承接=REQ-F09-14/REQ-F09-17；本节全部 retired，EARS 保留为契约史料）

### US-F05-01 · 周度待补清单按频次排序

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1 已增补，08-04-2026；owner 依拍板 2 名单；requirements-analysis RA-005 已随之 resolved）
- Goal: 每周拿到按频次排序的待补条目清单（原始问题/命中文档/会话链接；消化工作面=F09 管理台审核队列，导出保留）
- Value: 知道该优先补什么
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10，升级并入 F09）：回流从自研埋点四触发源升级为 Zendesk 四渠道信号矩阵+五来源修订候选，承接=REQ-F09-14（AI 对话挖掘）/REQ-F09-17（反馈回流）（PRD §0.4）

### REQ-F05-01 · 回流四触发源与周度清单导出

- Story: US-F05-01
- Anchor: FR-F05（PRD §4.4/§5.6；消化工作面=F09 管理台审核队列，08-04-2026）
- Stage: MVP
- Revision: 2（语义变更：消化工作面从导出文件升级为 F09 管理台审核队列，周度导出保留为导出能力）
- Status: retired
- Retirement note: retired（08-04-2026 D-10，升级并入 F09）：回流从自研埋点四触发源升级为 Zendesk 四渠道信号矩阵+五来源修订候选，承接=REQ-F09-14（AI 对话挖掘）/REQ-F09-17（反馈回流）（PRD §0.4）
- Behavior (EARS):

```text
WHEN 以下任一触发源发生：①检索无命中/拒答；②消息级点踩或会话未解决标记（含 F02 It didn't work）；③转人工会话；④48h 复问会话
THE SYSTEM SHALL 将其记入待补清单，同一问题按频次聚合为一条（聚合键：有命中条目按命中条目标识、无命中按规范化问题文本；改选反馈以最后一次为准，去重后计频次）。
回流条目的消化在 F09 管理台完成：AI 聚类起草 → 审核队列 → 运营审核发布（队列行为见 REQ-F09-04，本条不复制）。
THE SYSTEM SHALL 每周固定时间产出待补清单导出（导出能力保留）：字段 = 原始问题 / 命中文档 / 会话链接 / 频次，按频次降序。
IF 导出失败/漏周 THEN 可补导任意历史周区间，触发数据不丢失。
IF 触发量激增（拒答洪水期） THEN 清单按频次聚合 + Top 10 排序仍可操作，且激增同时触发 F06 拒答率预警。
清单原始问题原文适用 PII 脱敏规则（PRD §4.5）。
```

### REQ-F05-02 · 知识变更生效与消化 SLA

- Story: US-F05-01
- Anchor: FR-F05（PRD §5.6/§7.4/§4.4；生效链路=管理台发布→索引更新，08-04-2026；飞书改一次性迁移见 §9.2）
- Stage: MVP（周消化 SLA 生效依拍板 2 名单落实）
- Revision: 2（语义变更：生效链路从「飞书修订→导出+定期增量重建索引」改为「F09 管理台发布→发布门禁→索引更新」；24h 承诺与告警分层不变）
- Status: retired
- Retirement note: retired（08-04-2026 D-10，升级并入 F09）：回流从自研埋点四触发源升级为 Zendesk 四渠道信号矩阵+五来源修订候选，承接=REQ-F09-14（AI 对话挖掘）/REQ-F09-17（反馈回流）（PRD §0.4）
- Behavior (EARS):

```text
WHEN 知识条目在 F09 管理台修订并通过发布门禁（REQ-F09-05）THE SYSTEM SHALL 经「管理台发布 → 索引更新」使变更生效 ≤24h（用户侧可观察：次日同问题得到新答案）；24h 窗口内旧答案属预期行为，不计缺陷。
IF 索引重建失败 THEN 上一版索引继续服务（用户无感知）；IF 中断超 24h THEN 触发运营告警；IF 超 48h（「建议值 · 终稿前确认」）未恢复 THEN 升级呈报，不静默带病运行；重建期间服务不中断（PRD §7.4 唯一落点，与飞书无关）。
运营侧每周消化 Top 10（周 SLA 生效依拍板 2 名单；工作面=F09 管理台审核队列）；评测集回归在发版/变更前执行（🟩），回归不过则条目回炉。
```

### AC-F05-01 · 回流清单可导出

- PRD 对照 ID: AC-M-09（PRD §10）
- Parent: REQ-F05-01
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10，升级并入 F09）：回流从自研埋点四触发源升级为 Zendesk 四渠道信号矩阵+五来源修订候选，承接=REQ-F09-14（AI 对话挖掘）/REQ-F09-17（反馈回流）（PRD §0.4）
- EARS:

```text
WHEN 运营（间接角色）在上线后任一周查看回流清单
THE SYSTEM SHALL 可导出一份按频次排序的待补条目清单，字段含原始问题/命中文档/会话链接/频次。
```

### AC-F05-02 · 知识修订 24h 内生效（契约层增补）

- Parent: REQ-F05-02
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10，升级并入 F09）：回流从自研埋点四触发源升级为 Zendesk 四渠道信号矩阵+五来源修订候选，承接=REQ-F09-14（AI 对话挖掘）/REQ-F09-17（反馈回流）（PRD §0.4）
- EARS:

```text
WHEN 知识条目在 F09 管理台修订并通过发布门禁（revision 2 同步：权威源=管理台，PRD §4.4/§5.10）
THE SYSTEM SHALL 使变更 ≤24h 生效（用户侧可观察：次日同一问题得到新答案）；IF 索引重建失败 THEN 上一版索引继续服务、用户无感知，重建期间服务不中断（PRD §5.6/§7.4）。
```

---

## Feature F06 · 效果度量与预警（FR-F06 · **retired 08-04-2026 D-10** · 承接=中台数据看板（REQ-F09-07）+Zendesk Explore；本节全部 retired，EARS 保留为契约史料）

### US-F06-01 · 双口径解决率看板按周可看

- Role: 业务负责人（间接角色；别名：企业家）
- Goal: 上线第一周起按周查看双口径解决率（按入口分层）、拒答率（按层分列）、转人工量与语言分布
- Value: 验证这笔投入是否值得
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）

### US-F06-02 · 容量预警推送

- Role: 业务负责人（间接角色；别名：企业家）
- Goal: 月转人工绝对量达预警线（G1 实测月处理量的 80%）时收到预警推送
- Value: 来得及启动容量应对预案
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）

### REQ-F06-01 · 双口径解决率看板与分层呈报

- Story: US-F06-01
- Anchor: FR-F06（PRD §5.7/§8.1/§8.2）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供内部看板（上线即有数据、周粒度）：双口径解决率（宽=未转人工且 48h 无新会话；严=宽∩F04 显式确认，未答复保守折算）、解决时长、满意度、语言分布、沉默放弃率（宽严差值）、退货归因（月度手工表 🟩，口径依 G4）。
解决率 SHALL 按 entry_source（固定入口/错误态入口）分层呈报，交互方式为次维；旧版本无字段流量归「未知」桶单列，不摊入任何分层。
「高频类」指标口径 = 安装/联网/配对三类，不含会员类（唯一定义 PRD §8.1）；接续排障会话不计复问、重激活会话计复问。
灰度对比结论 SHALL 区分"引擎效果"与"入口效果"。
指标目标：严口径高频类 60%/底线 45%（3 个月，A-004 假设值，G1 后校准）；宽口径高频类 60%/整体 50%；自助解决时长 ≤10 分钟。
IF 解决率×满意度×退货趋势三指标背离 THEN 看板给出口径复查提示。
切采购扳机（写死）：高频类严口径连续 2 个月 <45% 且回流机制正常运转（=连续 4 周周消化 SLA 达成：每周处理量 ≥ 当周新增回流量 80%，R5-B-O3）→ 触发采购路线复评。
```

### REQ-F06-02 · 拒答率分层监控

- Story: US-F06-01
- Anchor: FR-F06（PRD §5.7/§8.2/§7.8）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- Behavior (EARS):

```text
THE SYSTEM SHALL 按触发层（①检索相关度/②引用忠实/③硬规则）分列展示拒答率周监控，叠加预期区间带；WHEN 超出预期区间（[PRD 定数 · G1 后回填]）THE SYSTEM SHALL 视觉标红（知识库改造未到位信号，且为灰度放量前置条件之一）。
```

### REQ-F06-03 · 容量预警

- Story: US-F06-02
- Anchor: FR-F06（PRD §5.7/§8.2/§7.8/§9.13）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- Behavior (EARS):

```text
WHEN 月转人工绝对量达到容量预警线（= G1 实测的现有 3 人团队月处理量 × 80%，分母 [PRD 定数 · G1 后回填]）
THE SYSTEM SHALL 发出预警推送触达企业家（载体「建议值 飞书群机器人推送 · 终稿前确认」）。
IF 预警线分母缺失（G1 未产出） THEN 预警功能降级为绝对量趋势展示 + 明示"预警线待 G1 回填"，不编造分母。
产品侧只交付预警数据；容量应对为业务侧预案（PRD §9.13）。
```

### REQ-F06-04 · 埋点 schema 与同步交付

- Story: US-F06-01
- Anchor: FR-F06（PRD §4.2/§5.7）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- Behavior (EARS):

```text
THE SYSTEM SHALL 按 PRD §4.2 事件清单埋点：会话开始/意图分类结果/拒答事件（含触发层与连续计数）/回答消息（含引用条目与来源标注内容）/排障步骤推进/转人工/客服首条回复送达（目标态）/消息级反馈/会话结束/会话重新激活/满意度评分。
公共属性必带：会话 ID、用户标识、时间戳、entry_source（会话级，进入时写死；固定入口/错误态入口/未知）、interaction_mode（消息级；按钮组/自由输入/预置意图）、app_version、channel（默认 app）、灰度桶标识。
埋点与功能同步交付、同步验收（缺埋点的功能不算完成）；事件语义一经发布只增补不改义。
IF 客户端埋点上报失败（离线/杀进程） THEN 本地暂存补报，看板对延迟数据标注"数据回补中"，不静默缺数。
窗口计算（48h 复问、30min 静默、24h 接续）一律按 UTC 时间差执行；看板按业务时区呈报；界面时间按设备本地时区展示（PRD §4.5）。
```

### AC-F06-01 · 灰度第一周看板可用

- PRD 对照 ID: AC-M-10（PRD §10）
- Parent: REQ-F06-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- EARS:

```text
WHEN 业务负责人（间接角色）在灰度第一周查看看板
THE SYSTEM SHALL 使双口径解决率、拒答率（分层）、转人工量、语言分布均有数据、按周可看；解决率按入口来源分层，旧版本无字段流量归「未知」单列。
```

### AC-F06-02 · 拒答率超区间标红（契约层增补）

- Parent: REQ-F06-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- EARS:

```text
WHEN 任一触发层（①检索相关度/②引用忠实/③硬规则）的周拒答率超出预期区间（[PRD 定数 · G1 后回填]）
THE SYSTEM SHALL 在看板对该层视觉标红（知识库改造未到位信号，PRD §7.8/§8.2）。
```

### AC-F06-03 · 容量预警触线推送（契约层增补）

- Parent: REQ-F06-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- EARS:

```text
WHEN 月转人工绝对量达到容量预警线（= G1 实测月处理量 × 80%，分母 [PRD 定数 · G1 后回填]）
THE SYSTEM SHALL 发出预警推送触达企业家（载体「建议值 飞书群机器人推送 · 终稿前确认」）；IF 预警线分母缺失 THEN 降级为绝对量趋势展示并明示"预警线待 G1 回填"，不编造分母（PRD §5.7/§9.13）。
```

### AC-F06-04 · 埋点与功能同步交付（契约层增补）

- Parent: REQ-F06-04
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：客服工作数据（工单量/首响/CSAT/人效）=Zendesk Explore 原生不重建；知识侧看板承接=中台数据看板（REQ-F09-07）（PRD §0.4）
- EARS:

```text
WHEN 任一功能进入交付验收
THE SYSTEM SHALL 使 PRD §4.2 对应事件埋点同步可验（公共属性必带；缺埋点的功能不算完成）；IF 客户端埋点上报失败（离线/杀进程） THEN 本地暂存补报，看板对延迟数据标注"数据回补中"，不静默缺数。
```

---

## Feature F07 · 多语言能力预留（FR-F07 · **retired 08-04-2026 D-10** · 承接=F09 中→英翻译工作流（REQ-F09-13）；本节全部 retired，EARS 保留为契约史料）

（PRD §2.4 显式声明 F07 无独立用户故事；触发提前条件 = F06 语言分布实测非英语占比 >15%，A-002。下方 US-F07-01 为契约层增补的架构约束承载故事，非 PRD 新增用户场景）

### US-F07-01 · 渠道无关演进能力（契约层增补）

- Role: 产品负责人
- Goal: 作为产品负责人，需要引擎具备渠道无关演进能力，以便未来零成本扩展渠道
- Value: 文案/prompt 不硬编码语言、知识条目带语言字段，未来扩渠道/扩语言无需改动对话逻辑（来源 PRD §5.8/F07）
- Stage: MVP（约束）
- Status: retired
- Retirement note: retired（08-04-2026 D-10，被翻译工作流实质取代）：承接=F09 条目工作台中→英翻译工作流（REQ-F09-13/AC-F09-29；PRD §0.4）；语言字段约束由中台 schema 继承（§4.1）

### REQ-F07-01 · 文案与 prompt 模板不硬编码语言

- Story: US-F07-01
- Note: 架构约束（PRD §3.7-4/§5.8 约束一）
- Anchor: FR-F07
- Stage: MVP（约束）；完整多语言后置
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10，被翻译工作流实质取代）：承接=F09 条目工作台中→英翻译工作流（REQ-F09-13/AC-F09-29；PRD §0.4）；语言字段约束由中台 schema 继承（§4.1）
- Behavior (EARS):

```text
THE SYSTEM SHALL 使任一用户可见文案与提示模板均从可替换的语言资源加载；可观察结果 = 切换语言资源配置，无需改动对话逻辑本身即可替换全部文案。
```

### REQ-F07-02 · 知识条目带语言字段

- Story: US-F07-01
- Note: 架构约束（PRD §3.7-4/§5.8 约束二/§4.1）；revision 4 与 REQ-F09-08 口径收敛——条目语言由录入时语言字段选择决定（不再恒为英文），并增加检索语言过滤安全约束（PRD §4.1 08-04 修订）
- Anchor: FR-F07
- Stage: MVP（约束）；完整多语言后置
- Revision: 4
- Status: retired
- Retirement note: retired（08-04-2026 D-10，被翻译工作流实质取代）：承接=F09 条目工作台中→英翻译工作流（REQ-F09-13/AC-F09-29；PRD §0.4）；语言字段约束由中台 schema 继承（§4.1）
- Behavior (EARS):

```text
THE SYSTEM SHALL 使每条知识条目带语言字段（字段必须存在，条目语言在录入时选择；服务 App 英文用户的生产条目为英文）；缺失语言标记的条目在知识库校验环节可被发现并报出。
WHEN 对话引擎对某会话执行知识检索 THE SYSTEM SHALL 按该会话渠道语言过滤候选条目——App 英文渠道仅命中英文条目，非对应语言条目不进入检索候选。
```

### AC-F07-01 · 文案语言可配置切换

- PRD 对照 ID: AC-C-05（PRD §10）
- Parent: REQ-F07-01
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10，被翻译工作流实质取代）：承接=F09 条目工作台中→英翻译工作流（REQ-F09-13/AC-F09-29；PRD §0.4）；语言字段约束由中台 schema 继承（§4.1）
- EARS:

```text
WHEN 切换用户可见文案与 prompt 模板的语言配置
THE SYSTEM SHALL 不需改动对话逻辑即可生效（语言不硬编码，F07 约束一）。
```

### AC-F07-02 · 知识条目语言字段存在

- PRD 对照 ID: AC-C-06（PRD §10）
- Parent: REQ-F07-02
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10，被翻译工作流实质取代）：承接=F09 条目工作台中→英翻译工作流（REQ-F09-13/AC-F09-29；PRD §0.4）；语言字段约束由中台 schema 继承（§4.1）
- EARS:

```text
WHEN 校验任一知识条目
THE SYSTEM SHALL 使该条目带语言字段（schema 见 PRD §4.1）。
```

---

## Feature F08 · 入口与场景化触达（FR-F08 · **retired 08-04-2026 D-10** · 承接=后置阶段 App 接入 Zendesk SDK；本节全部 retired，EARS 保留为契约史料）

### US-F08-01 · 错误提示旁一键 Get help 带故障现场

- Role: App 用户
- Goal: 设备掉线/配对失败/扫码失败时，错误提示旁点 "Get help" 进入对话且故障现场已自动带上
- Value: 不用自己描述发生了什么（差评 #6 直接验收素材）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）

### US-F08-02 · 新用户 3 步内找到固定入口

- Role: App 用户
- Goal: App 内 3 步以内找到固定客服入口
- Value: 不在"迷宫"里找门（"labyrinthian maze" 差评素材）
- Stage: MVP
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）

### REQ-F08-01 · 固定一级入口

- Story: US-F08-02
- Anchor: FR-F08（PRD §5.9 交互逻辑 1）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- Behavior (EARS):

```text
THE SYSTEM SHALL 在设备页/我的页提供常驻可见的一级固定入口（"Support"，≥44pt），点击进入客服对话页（F01 首屏）。
新用户从 App 首页 ≤3 步可达客服对话页（"步"=点击/页面跳转次数，不含滚动查找）。
IF App 全局网络异常 THEN 错误提示旁仍展示 "Get help"，点击后进入离线提示态，不出现按钮消失或点击无响应。
```

### REQ-F08-02 · 错误态入口与携带上下文开场确认

- Story: US-F08-01
- Anchor: FR-F08（PRD §5.9 交互逻辑 2–3/§3.5/§6.1，R2-裁决 3）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- Behavior (EARS):

```text
WHEN 用户在错误提示旁点 "Get help"（错误码已结构化，G2 前提满足）
THE SYSTEM SHALL 一键进入对话并自动携带故障上下文（entry_source=错误态入口）：先出携带上下文的开场确认（确认/否认双出口）；用户确认 → 进入对应 F02 引导流第一步（零打字、零复述）；用户否认 → 回首屏按钮组，入口不消失、不锁死路由。
IF 上下文不可判定（错误码未结构化） THEN 降级为通用进入：落首屏（按钮组 + 自由输入），不落纯自由输入；降级项逐条列入覆盖清单呈报，不因缺上下文砍掉入口本身。
错误态入口最低覆盖集合 = 设备掉线 / 配对失败（含卡死） / 扫码失败三类（差评 #6/#2/#4）；覆盖清单与携带上下文能力依 G2 查证结果如实呈报。
```

### REQ-F08-03 · 旧版本降级与覆盖率呈报

- Story: US-F08-02
- Related-Stories: US-F08-01（语义关联；契约 Story 取主故事）
- Anchor: FR-F08（PRD §5.9 交互逻辑 4/§7.6/§9.5）
- Stage: MVP
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- Behavior (EARS):

```text
WHILE 旧版本客户端 + 新引擎共存 THE SYSTEM SHALL 保证自由输入问答、三层拒答、转人工（含摘要）、非英语兜底全部可用；按钮组/卡片 UI 缺失时，引擎以纯文本分步引导替代卡片（每条消息一步 + 文字确认），功能降级但路径完整，不硬崩、不出功能黑洞；开场消息附高频问题引导语替代按钮。
发版线覆盖率 SHALL 随 App 版本升级率爬坡、按 app_version 如实呈报，不并入引擎线 2 周承诺；灰度分桶按用户维度，入口文案两版一致，不因界面差异暴露分组。
```

### AC-F08-01 · 错误态入口开场确认

- PRD 对照 ID: AC-M-01（PRD §10）
- Parent: REQ-F08-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- EARS:

```text
WHEN 用户在配对失败错误页点 "Get help"（错误码已结构化，G2 前提满足）
THE SYSTEM SHALL 进入客服对话且首条为携带该故障场景的开场确认消息（含确认与否认两个出口）：确认后直接进入对应排障流第一步，否认则回到首屏按钮组——用户全程无需自己描述"我在配对时失败了"；会话开场可见 AI 身份披露语。（错误码未结构化时的降级行为见 AC-E-11）
```

### AC-F08-02 · 新用户 3 步可达入口

- PRD 对照 ID: AC-M-11（PRD §10）
- Parent: REQ-F08-01
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- EARS:

```text
WHEN 新用户从 App 首页出发找客服
THE SYSTEM SHALL 使其 3 步以内到达固定客服入口（"步"=从 App 首页起的点击/页面跳转次数，不含滚动查找）。
```

### AC-F08-03 · 错误态无结构化信息时降级通用进入

- PRD 对照 ID: AC-E-11（PRD §10）
- Parent: REQ-F08-02
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- EARS:

```text
WHEN 用户在错误提示旁点 "Get help" 但该错误态无结构化错误信息（G2 前提不满足）
THE SYSTEM SHALL 降级为通用进入：落首屏按钮组 + 自由输入；"Get help" 入口不消失、点击不无响应。
```

### AC-F08-04 · 旧版本客户端能力保全

- PRD 对照 ID: AC-C-04（PRD §10）
- Parent: REQ-F08-03
- Priority: P0
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 侧本期完全不动（存量自研客服入口维持现状），承接=后置阶段 App 接入 Zendesk SDK/Messaging 时重启入口设计（PRD §0.4/§0.1 阶段二）
- EARS:

```text
WHEN 未升级到含 F08 的 App 旧版本用户使用客服
THE SYSTEM SHALL 使其仍可从原有固定入口使用引擎线全部能力（问答/排障内容/转人工）；仅缺错误态入口与新按钮组 UI；卡片 UI 亦缺失时，排障以纯文本分步引导形式提供（每条消息一步 + 文字确认），路径完整不缺分支；覆盖率随升级率如实呈报，不算入引擎灰度承诺。
```

---

## Feature F09 · 知识运营中台（FR-F09 · 必做 🟩 · 现役唯一功能组 · 独立内部 Web（桌面 1280+）· 十视图五组，功能标准=v3 原型；三条权威原则=中台唯一权威源 / 统一过审 / 中文内容权威源；RBAC 四角色真实账号；08-04-2026 D-10 范围升级，revision 5）

> **revision 5 结构说明**：US-F09-01…04、REQ-F09-01/03/05/06/09/10、AC-F09-01…05/07/08/09/11/12/13 为五区版旧对象，随 D-10 retire（各块附承接注记）；REQ-F09-02/04/07/08 与 AC-F09-06/10 修订续用（Revision 5）；US-F09-05…16、REQ-F09-11…19、AC-F09-14…38 为十视图版新增。十视图↔REQ 对应：①我的工作台=REQ-F09-11、②知识库总览=REQ-F09-12、③条目工作台=REQ-F09-13、④AI 对话挖掘=REQ-F09-14、⑤审核中心=REQ-F09-15、⑥同步中心=REQ-F09-16、⑦数据看板=REQ-F09-07、⑧反馈回流=REQ-F09-17、⑨操作日志=REQ-F09-18、⑩用户与权限=REQ-F09-19；横切=REQ-F09-02（录入与批量导入）/REQ-F09-04（统一过审铁律）/REQ-F09-08（界面语言）。

### US-F09-01 · 录入/导入条目并确认 AI 整理建议（08-04-2026 第三轮拍板修订：录入过审后才入总页面）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补；拍板 2 名单，2 名）
- Goal: 在管理台录入或导入知识条目（手工表单/飞书一次性迁移/Markdown/CSV 批量导入），并对 AI 切条、问题标签与场景/型号/章节归类建议逐项确认；我录入的条目进入审核队列，人工审核通过后才正式转入知识库总页面（不再直接发布）
- Value: 120+ 篇存量与新增内容快速变成可检索的结构化条目
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：五区版 US 被十视图版新序列取代——录入/编辑与字段语义并入 US-F09-07，统一过审语义并入 US-F09-08，AI 建议确认并入 US-F09-14（PRD §2.4）

### US-F09-02 · 审核队列统一处置人工与 AI 录入条目，无人审不生效（08-04-2026 第三轮拍板修订：统一过审）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 在审核队列看到人工录入与 AI 每日从真实会话抓取聚类起草的条目草稿（含来源会话与频次、标签建议）统一流入，一键通过发布/驳回/改后发布
- Value: 知识安全入库——未经我审核的条目绝不生效
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：审核队列语义并入 US-F09-09（审核中心四来源统一过审）与 US-F09-14（AI 对话挖掘每日批次）（PRD §2.4）

### US-F09-03 · 确认标签成为检索信号，发布须过评测集回归

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 我确认后的问题标签成为检索信号让用户的各种问法更准命中条目；发布须过评测集回归，回归不过的条目不生效
- Value: 命中率仍以 §8 目标值验收，知识质量有门禁保障
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：标签检索语义并入 US-F09-07（标签同步 Zendesk labels，影响帮助中心搜索与 bot 匹配）；评测集回归被发布门禁四查取代（US-F09-10）（PRD §2.4）

### US-F09-04 · 数据看板定位该优先修哪条（08-04-2026 第二轮拍板增补；第三轮拍板修订：归属数据看板·知识库数据子看板）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 在管理台数据看板（知识库数据子看板）看到每条知识的使用与解决效果（命中/引用/点踩/条目准确率），知道该优先修哪条
- Value: 知识库供给侧效果可见，修订优先级有数据依据（与 F05 回流联动：标黄条目即修订候选）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：看板语义并入 US-F09-13（数据看板+反馈回流只读与建议提交）（PRD §2.4）

### US-F09-05 · 我的工作台一眼看到我的活（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 登录后在我的工作台一眼看到我的草稿、我提交待审、被驳回待改三组条目和各自的下一步动作（有审核权限的角色另见「待我审核」），不用在各视图里翻找
- Value: 工作入口收敛，驳回修改与待办不遗漏
- Stage: MVP
- Status: active

### US-F09-06 · 多知识库与结构树映射 Zendesk（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 在多知识库（政策与售后 / 产品与使用 / 客服话术库·仅内部）与「目录→章节→条目」结构树中组织知识，结构映射 Zendesk（目录→Category、章节→Section）
- Value: 中台结构与帮助中心结构一一对应，同步不乱位
- Stage: MVP
- Status: active

### US-F09-07 · 条目编辑与可见性三档标记（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 在条目工作台编辑条目正文与字段（两级场景/标签/适用型号/复核周期/负责人），并为条目标记可见性——对外公开、仅客服内部、或对外+内部段落混合
- Value: 内部段落绝不进对外文章、不翻译，口径分层可控
- Stage: MVP
- Status: active

### US-F09-08 · 我提交的一切都必须过审（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 我提交的所有条目（含批量导入与 AI 挖掘起草）都必须经审核员过审才生效——我自己没有任何直接发布路径
- Value: 口径事故不会因我一个人的失误流到线上
- Stage: MVP
- Status: active

### US-F09-09 · 审核中心统一处理四来源（revision 5 增补，PRD §2.4）

- Role: 知识审核员
- Goal: 在审核中心统一处理四来源（AI 挖掘/人工录入/版本修订/反馈修订）的待审条目，先看变更摘要、可点开 git diff 视图看逐行具体变更，并看到审核历史；驳回必须填写理由，理由回传提交人并留痕
- Value: 质量线守得住，驳回有据可查
- Stage: MVP
- Status: active

### US-F09-10 · 发布门禁三查与同步阻断可见（revision 5 增补；08-05-2026 由四查收敛，PRD §2.4）

- Role: 知识审核员
- Goal: 通过审核后系统自动跑发布门禁（格式字段完整性/内部段落标记/英文版本状态），全过才入同步队列；同步失败自动重试后告警、可手动重试，英文未校验等原因的阻断可见原因
- Value: 不带病同步，阻断原因不用猜
- Stage: MVP
- Status: active

### US-F09-11 · 版本效果对比与一键回滚（revision 5 增补，PRD §2.4）

- Role: 知识审核员
- Goal: 看到每个版本的效果对比（调用/命中/解决/采纳）与任意两版 diff；新版本效果骤降时收到回滚建议，一键回滚旧版并自动同步 Zendesk
- Value: 历史版本与指标不丢，坏改动可撤
- Stage: MVP
- Status: active

### US-F09-12 · drift 报警与二选一处置（revision 5 增补，PRD §2.4）

- Role: 知识审核员
- Goal: 当 Zendesk 端文章被绕过中台直接改写（drift）时，在同步中心看到漂移报警（谁改的/改了哪段/何时），并二选一处置：以中台内容覆盖，或把 Zendesk 端修改拉回进审核队列
- Value: 口径不分叉，中台权威源守得住
- Stage: MVP
- Status: active

### US-F09-13 · 只读数据与建议提交（revision 5 增补，PRD §2.4）

- Role: AI 运营
- Goal: 只读查看数据看板（场景覆盖/条目效果/知识缺口/搜索无结果关键词）与反馈回流信号矩阵（四渠道命中与解决信号、确定性档位），并把洞察以优化建议形式提交进审核队列——我不能直接改库
- Value: 数据洞察变成修订动作，且不越权
- Stage: MVP
- Status: active

### US-F09-14 · 挖掘批次与三重准入候选处置（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 在 AI 对话挖掘视图查看每日批次（来源会话数分邮件工单/在线聊天、候选数、批次状态），对通过三重准入（频次阈值/语义查重/缺口判定）的候选按新增/修订/合并三类处置——起草提交审核或丢弃留痕
- Value: 高频问题自动沉淀为知识候选，不重复建条
- Stage: MVP
- Status: active

### US-F09-15 · 用户与权限管理职责分离（revision 5 增补，PRD §2.4）

- Role: 系统管理员
- Goal: 创建/禁用用户、分配角色与知识库范围、维护 10 项权限矩阵；我不参与知识内容的审核与发布（职责分离），我的每次权限变更都写审计日志
- Value: 管人不管内容，权限变更全程可追责
- Stage: MVP
- Status: active

### US-F09-16 · AI 翻译人工校验后才同步（revision 5 增补，PRD §2.4）

- Role: 知识管理员
- Goal: 对中文条目触发 AI 翻译生成英文稿并逐段人工校验（可修正表述但不得改变政策口径），确认后英文才可同步 Zendesk；中文一旦变更，英文自动置为待重新校验并阻断同步
- Value: 翻译不错译政策口径，双语不失同步
- Stage: MVP
- Status: active

### REQ-F09-01 · 条目管理（知识库总页面/双编辑器/状态流转/修订历史）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 界面元素表/交互逻辑 1，08-04-2026 第三轮拍板：归属②知识库总页面，章节树导航见 REQ-F09-09）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：五区版条目管理被十视图取代——总览/结构/筛选承接=REQ-F09-12，编辑器/状态流转/并发冲突承接=REQ-F09-13；访问控制（Basic Auth 建议值）被 RBAC 真实账号体系取代（REQ-F09-19）；无死胡同图遍历校验降级为条目编辑器步骤完整性检查（PRD §3 登记）
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供独立内部 Web 管理台（桌面 1280+ 宽度，界面简体中文，与 F06 看板同体系部署；访问控制「建议值 口令 Basic Auth + 链接不公开 · 终稿前确认」；一级导航五区=数据看板/知识库总页面/人工录入/AI 录入/审核队列）：条目在知识库总页面内按章节组织（章节树见 REQ-F09-09），章节内按更新时间降序，支持全库搜索与按场景/型号/语言/状态/问题标签组合筛选（结果标注所属章节），点条目进入编辑。
WHEN 运营编辑问答型条目 THE SYSTEM SHALL 提供字段对齐 §4.1 schema 的表单（标题/所属章节/场景/型号/语言/正文/问题标签），保存生成修订记录；修订须重新过审（统一过审，REQ-F09-04）。
WHEN 运营编辑排障流程型条目 THE SYSTEM SHALL 提供结构化编辑器（步骤节点 + Done/It didn't work 分支，对齐 §4.1 排障流程 schema），保存时执行无死胡同图遍历校验（PRD §3.6）；校验不过不允许发布并在编辑器内标出问题节点。
状态流转 = 草稿 → 已上线 → 待改造/已下线，未过审核/回归的条目不可流转为「已上线」；每次修订与流转留痕（修订人/时间/变更摘要），历史版本可查。
IF 并发编辑同一条目 THEN 后提交者提交时收到冲突提示（文案定稿见 PRD §5.10），须基于最新版本重做；不静默覆盖，修订历史可回溯。
```

### REQ-F09-02 · 录入与批量导入（统一进审核中心 + 飞书一次性迁移；08-04-2026 D-10 修订续用）

- Story: US-F09-08
- Anchor: FR-F09（PRD §5.10 视图⑤来源「批量导入」/异常场景「批量导入部分失败」；§9.5 初始迁移计划；§0.5 飞书导出前置）
- Stage: MVP
- Revision: 5（D-10：入库面从「知识库总页面+F01 检索库」换锚为「知识库总览+同步 Zendesk」；审核主体=知识审核员（RBAC）；批量导入统一进审核队列/逐条失败报告/一次性迁移不双向同步语义延续）
- Status: active
- Behavior (EARS):

```text
WHEN 知识管理员通过手工表单提交条目 THE SYSTEM SHALL 将其送入审核中心（来源标注「人工录入」）或存为个人草稿；不存在"人工直接发布入库"路径——知识审核员通过并过发布门禁（REQ-F09-15）后条目才入同步队列、出现在知识库总览对应章节。
WHEN 批量导入文件（Markdown/CSV；飞书 120+ 篇一次性迁移走同一入口；单文件上限「建议值 500 条 · 终稿前确认」）THE SYSTEM SHALL 将导入内容一律送入审核中心（来源标注「批量导入」），并逐条报告导入结果；Zendesk 存量文章按 §9.5 认领对齐——已有对应文章的条目走「更新」而非重复建条，无主文章拉回进审核队列认领。
IF 批量导入部分失败（格式错误/字段缺失）THEN 成功条目照常进审核队列，失败条目逐条报告行号与原因；不整批静默失败、不静默丢行。
IF 飞书一次性迁移失败 THEN 人工从飞书导出文件经批量导入兜底；中台=知识唯一权威源，迁移完成后不做与飞书的双向同步（防口径分叉）。
```

### REQ-F09-03 · AI 自动整理（全部建议态，08-04-2026 第三轮拍板：增章节归类建议、拒绝不阻塞提交进审核队列）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 交互逻辑 3/异常场景）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：AI 整理建议（建议态）承接=REQ-F09-14（挖掘候选起草）与 PRD §9.5 批量导入 AI 整理辅助；「AI 为增强不是依赖」降级原则由 §5.1 异常原则延续
- Behavior (EARS):

```text
WHEN 内容完成录入/导入 THE SYSTEM SHALL 自动生成 AI 整理建议卡（全部建议态）：①切条建议（长文拆为多条目）②问题标签建议（用户问法变体，多值，上限「建议值 每条目 ≤20 个 · 终稿前确认」）③场景/型号归类建议④所属章节归类建议。
WHEN 运营逐项采纳或修改建议 THE SYSTEM SHALL 按采纳/修改后的内容生效；IF 运营拒绝某建议 THEN 该建议不生效，且不阻塞运营人工提交进审核队列（AI 建议为建议态、非门槛；条目后续仍须经审核队列过审后入库，AC-E-13 第三轮语义修订）。
IF AI 整理/起草服务不可用（LLM 故障）THEN 建议卡隐藏并明示 AI 建议暂不可用；手工录入、编辑、审核、发布全部照常可用（AI 能力为增强不是依赖，与 §7.5 降级原则同源）。
```

### REQ-F09-04 · 统一过审铁律（无人审不生效，横切全部入口；08-05-2026 取消四眼原则，修订续用）

- Story: US-F09-08
- Related-Stories: US-F09-09（审核执行面；契约 Story 取主故事）
- Anchor: FR-F09（PRD §5.10 三条权威原则之二 / RBAC 权限矩阵；§10 AC-P-05/23）
- Stage: MVP
- Revision: 6（08-05-2026 用户拍板：**删除四眼原则硬约束**——审核员可审核自己提交的条目，界面不禁用、接口不拒绝；「无人审不生效 / 任何角色无绕过审核的发布路径」两条铁律不变，制衡从流程前置约束改为事后可审计。历史 rev5（D-10）：从五区版「审核队列界面 REQ」修订为横切铁律——覆盖面从"人工+AI 录入"扩展为全部新条目/修订/挖掘候选/反馈建议/drift 拉回；生效面从 F01 检索库换锚为 Zendesk 同步；审核中心界面行为拆至 REQ-F09-15）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使全部新条目/修订/AI 挖掘候选/反馈回流建议/drift 拉回内容一律经审核中心人工过审并通过发布门禁后才生效同步——任何角色不存在绕过审核的发布路径（知识管理员的「发布并同步」恒禁用并提示统一过审铁律文案，PRD §5.10 文案定稿表）。
无人审不生效（铁律延续，08-03-2026 确立、08-04-2026 D-10 换锚）：未过审条目不入同步队列、不同步 Zendesk、不出现在帮助中心与客服 Knowledge segment。
审核员自审（08-05-2026）：知识审核员也可编辑与提交，且 SHALL 可以审核自己提交的条目——通过按钮不因提交人=当前审核员而禁用，approve 接口不因此拒绝；该次审核 SHALL 与其他审核一样写审计日志（含提交人与审核人为同一人的事实可查）。
IF 审核队列积压 THEN 候选按频次降序保持可操作；积压不影响已发布条目在 Zendesk 端正常服务。
```

### REQ-F09-05 · 发布门禁（评测集回归，结果留痕）

- Story: US-F09-03
- Anchor: FR-F09（PRD §5.10 交互逻辑 5/异常场景；§4.3 运行时机）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 2
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：评测集回归门禁被发布门禁取代——承接=REQ-F09-15；≤24h 生效链路随自研检索线废止，换为过审后入同步队列分钟级推送（PRD §5.10 视图⑥）。**08-05-2026 补记**：当时的承接形态「第④查=代理评测·本台向量检索召回验证」已随向量能力整体删除一并退役，门禁收敛为三查，本台不再自建任何检索代理指标
- Behavior (EARS):

```text
WHEN 任何条目转入「已上线」（含改后发布）THE SYSTEM SHALL 触发 §4.3 评测集回归，结果留痕可追溯。
IF 回归不过 THEN 条目回炉（状态回草稿、不生效、不进检索库），失败原因与失败用例在发布门禁结果面板可见，修订后可重新发布；不存在"回归失败但条目已上线"的中间态。
IF 回归通过 THEN 发布生效、索引更新，变更生效 ≤24h 承诺不变（§4.4，承接 REQ-F05-02/AC-F05-02）。
```

### REQ-F09-06 · 问题标签检索联动（不新增指标）

- Story: US-F09-03
- Anchor: FR-F09（PRD §5.10 交互逻辑 6；§4.1 问题标签字段）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 2
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：F01 检索信号联动随自研检索线废止；标签承接=§4.1 标签字段同步 Zendesk labels（REQ-F09-13 编辑面 / REQ-F09-16 同步面），影响帮助中心搜索与 bot 匹配
- Behavior (EARS):

```text
WHEN 问题标签经人工确认并随条目发布生效 THE SYSTEM SHALL 将其作为 F01 检索信号（扩充召回 + 过滤），使同一条目命中更多用户问法变体。
命中率仍以 §4.3 评测集验收，§8 目标值不变、不新增指标（闭环验收=AC-F09-01/PRD AC-M-13）。
```

### REQ-F09-07 · 数据看板（视图⑦三页签：知识库效果 / 知识缺口 / 客服工作数据·Explore 指向；08-04-2026 D-10 修订续用）

- Story: US-F09-13
- Anchor: FR-F09（PRD §5.10 视图⑦；指标口径唯一落点 §8.2；§8.3 指标防欺骗）
- Stage: MVP
- Revision: 6（08-05-2026：条目效果列表删除「向量化状态」列，随向量能力整体删除。历史 rev5（D-10）：由「知识库数据+客服工作数据双子板（F06 同源自研埋点）」改组为十视图⑦三页签；数据源换锚 Zendesk 信号矩阵+中台自有数据；客服工作数据页签=不重建 Explore、仅口径说明与指向）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 在视图⑦「数据看板」提供三页签：①知识库效果——场景覆盖条（一级场景 × 条目数 × 覆盖率，对照工单场景分布，低覆盖标红）+ 条目效果列表（逐条目：bot 引用/agent 引用/被踩/客服 flag/解决率/版本/归属章节；低解决率标红加粗浮顶；点条目行直达条目工作台效果页签）；②知识缺口——缺口→动作列表（未覆盖→立新条 / 已覆盖但答不好→修订，动作按钮一键起草或挂修订进审核队列）+ 搜索无结果关键词列表（关键词/周次数/判定：无对应条目·有条目但命名不匹配·内部有口径未对外）；③客服工作数据——不重建 Zendesk Explore，展示口径说明与 Explore 指向 + 「去知识缺口」直达。
指标口径唯一落点 = PRD §8.2（本 REQ 引用不复制）；条目解决率为近似归因（一次会话可引用多条目），看板固定标注该性质；待核实信号（bot 锚点引用/面板引用/浏览行为）核实前不进任何达标判定，只做趋势参考（§8.3）。
IF 条目引用数低于样本量下限「建议值 10 次 · 终稿前确认」 THEN 解决率位置显示「样本积累中」，不显示误导性数值。
IF 条目解决率低于标红线「建议值 60% · 终稿前确认」 THEN 标红浮顶提示优先修订（联动视图⑧反馈回流修订候选）。
```

### REQ-F09-08 · 界面语言（100% 简体中文含示例 + 中文权威源/英文同步版本 + 语言资源加载；08-04-2026 D-10 修订续用）

- Story: US-F09-05
- Anchor: FR-F09（PRD §5.1 通用约定「界面语言」；§4.1 语言版本；§5.10 文案定稿表）
- Stage: MVP
- Revision: 5（D-10：作用面从五区导航扩展至十视图全域；条目内容语言口径修订——从「录入时语言字段自由选择」改为「中文=唯一内容权威源 + 英文=同步 Zendesk 的对外版本」（§4.1 语言版本状态机）；UI 多语言切换仍为后置增强）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使中台全部界面元素（导航/按钮/标签/提示/占位文案）与界面示例内容 100% 简体中文，不残留英文装饰性文案（品牌词 COOLFLY 保留）；中文界面文案唯一落点 = PRD §5.10 文案定稿表。
THE SYSTEM SHALL 保持界面语言与内容语言分离：条目内容语言 = 中文唯一权威源 + 英文同步版本（状态机见 §4.1，翻译工作流见 REQ-F09-13）；界面全中文不改变条目内容语言。
中台 UI 文案从语言资源加载、不硬编码语言；第一版仅提供简体中文资源，后续加语言 = 加资源包、不改界面逻辑（UI 多语言切换为后置增强，仅登记不实现，PRD §0.1 阶段二）。
```

### REQ-F09-09 · 知识库总页面章节树（书目录式两级层级 + 章节运营维护；08-04-2026 第三轮拍板增补）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 交互逻辑 1/界面元素表「章节树」「章节管理」/异常场景「删除含条目/子章节的章节」；§4.1「所属章节」信息项）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：章节树承接=REQ-F09-12（知识库总览：目录→章节两级结构树+章节管理+含条目章节禁删+Zendesk Category/Section 映射）
- Behavior (EARS):

```text
THE SYSTEM SHALL 在第 2 导航区「知识库总页面」以书目录式层级组织条目：大章节 → 小章节 → 条目（两级章节，替代扁平列表）；章节树可折叠展开，条目挂在小章节下；点小章节展开条目、点条目进入详情/编辑器。
WHEN 运营维护章节（新建章节 / 重命名 / 调整层级——移动小章节或条目归属）THE SYSTEM SHALL 使章节变更即时反映在章节树，操作留痕；小章节与条目的层级归属可调整（§4.1「所属章节」）。
IF 运营尝试删除含条目或子章节的章节 THEN 不允许直接删除——须先将条目与小章节移至其他章节（调整层级）后才可删除空章节（防止产生无章节归属的孤儿条目）。
仅审核通过的条目出现在知识库总页面（统一过审，REQ-F09-02/04；AC-M-18）；全库搜索与组合筛选在层级结构下保留可用（REQ-F09-01，结果标注所属章节）。
```

### REQ-F09-10 · AI 录入界面（每日抓取批次展示 + 草稿入队；08-04-2026 第三轮拍板增补）

- Story: US-F09-02
- Anchor: FR-F09（PRD §5.10 交互逻辑 4/界面元素表「抓取批次列表」/异常场景「AI 录入批次失败或空批次」；§4.4 AI 提炼节奏；§5.6 引用）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：AI 录入批次界面承接=REQ-F09-14（AI 对话挖掘：每日批次拉取 Zendesk 会话+三重准入+三类候选处置；失败/空批次如实标注语义延续）
- Behavior (EARS):

```text
THE SYSTEM SHALL 按「建议值 每日 · 终稿前确认」节奏抓取客户会话（F05 四触发源回流会话为输入，口径归 §4.4），由 AI 聚类总结归纳并起草条目草稿，草稿进入审核队列（REQ-F09-04 统一过审；此为 AI 提炼节奏的明确化——由「回流触发累积即入队」明确为每日批次抓取）。
THE SYSTEM SHALL 在第 4 导航区「AI 录入」展示当日与近期抓取批次（每批次：抓取时间/来源会话数/生成草稿数/批次状态，按时间降序）；点批次可查看该批生成的草稿（草稿本体在审核队列）。
IF 批次抓取失败或当日无可提炼会话 THEN 批次列表如实标注「失败」或「无新草稿」，不静默缺批次；失败批次次日照常抓取，不阻塞人工录入与审核队列既有条目的操作。
IF AI 起草服务不可用（LLM 故障）THEN AI 录入当日批次标注失败（与 REQ-F09-03 降级原则同源，AI 能力为增强不是依赖）。
```

### REQ-F09-11 · 我的工作台（视图①：角色化四统计卡与下一步动作；revision 5 增补）

- Story: US-F09-05
- Anchor: FR-F09（PRD §5.10 视图①）
- Stage: MVP
- Revision: 5
- Status: active
- Behavior (EARS):

```text
WHEN 任一角色登录进入我的工作台 THE SYSTEM SHALL 展示四统计卡（我的草稿 / 我提交待审 / 被驳回待改 / 待我审核）按当前账号与角色实时计数（「待我审核」含 AI 挖掘与人工提交合计），点卡片切换对应分组列表；分组列表每行含 条目/状态/中英文状态/最近操作/下一步动作，点行进入条目工作台对应条目。
下一步动作列 SHALL 按状态与角色计算（草稿→继续编辑；待审核→有审核权去审核 / 无审核权查看进度；已驳回→按意见修改），受权限矩阵约束；无审核权限角色的「待我审核」显示无权限说明而非空报错；新建条目按钮对无新建权限角色禁用并说明。
草稿仅本人可见，提交后进审核中心；被驳回条目带审核意见回退，修改后可重新提交；空分组给出引导文案（文案定稿见 PRD §5.10）。
```

### REQ-F09-12 · 知识库总览（视图②：多库切换 / 三级结构树 / Zendesk 结构映射 / 复核到期；08-05-2026 修订）

- Story: US-F09-06
- Related-Stories: US-F09-07（可见性列展示；契约 Story 取主故事）
- Anchor: FR-F09（PRD §5.10 视图②；§4.1 结构映射唯一落点）
- Stage: MVP
- Revision: 6（08-05-2026：①结构树由「两级可折叠」修订为**三级折叠树**——目录/章节/条目逐级缩进、树内仅呈现已发布条目、结构操作收进顶部工具条与悬停行内操作，UX/UI 以 v3 原型为准；②条目列表删除「向量化状态」列）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供多知识库切换卡（含「客服话术库·仅内部」带"不对外公开，仅挂客服 segment"说明）与**三级折叠树**（目录 → 章节 → 条目，逐级缩进且逐级可折叠；目录行带文件夹图标与条目计数、章节行带 Zendesk Section 映射标识、条目行带文档图标与省略号截断的标题；树内仅呈现已发布条目并以「仅已发布」徽章标注；结构操作按钮（新建目录 / 新建章节 / 调整层级）收进树卡顶部工具条，重命名/删除随悬停或选中显示、不常驻挤压行宽；调整层级 = 改章节所属目录，结构深度恒为 2），并常驻结构映射说明（知识库→Help Center brand、目录→Category、章节→Section、条目→Article、条目内锚点→文章内 anchor；规则唯一落点 §4.1，本视图引用不复制）。
条目列表 SHALL 含 标识/标题/路径/类型/可见性/版本/状态/英文状态/同步状态/解决率/复核到期/更新时间，按更新时间降序；低解决率标红；复核超期标红（含超期天数）、临期标黄；搜索与组合筛选（场景/状态/可见性/复核到期：全部/已到期/30 天内到期）即时过滤且结果标注归属路径。
WHEN 有「管理目录与章节」权限的角色维护结构（新建目录/章节、重命名、调整层级、删除）THE SYSTEM SHALL 使变更即时反映并留痕，且**实时同步 Zendesk**（08-05-2026 拍板：结构只在本台维护——新建目录→创建 Category、新建章节→在父目录 Category 下创建 Section〔挂接字段填 id=挂接既有结构、留空=自动创建；父目录无映射时懒创建〕、重命名→同步改名、调整层级→同步改 Section 归属 Category；Zendesk 失败则本地不落并回传原因）；IF 章节含条目 THEN 不可直接删除（先移空，防孤儿条目）；IF Zendesk 端对应 Section 仍有文章或 Category 仍有 Section THEN 拒绝删除（防连带删除线上文章）。
复核到期 SHALL 按条目复核周期（「建议值 180 天，可选 90/365 天 · 终稿前确认」）自发布起算：到期提醒（临期「建议值 30 天内 · 终稿前确认」标黄）、超期标红并可被「已到期」筛选命中。
```

### REQ-F09-13 · 条目工作台（视图③：编辑与字段 / 中英双语翻译工作流 / 版本与回滚 / 效果与条目日志；revision 5 增补）

- Story: US-F09-07
- Related-Stories: US-F09-11（版本回滚）、US-F09-16（翻译工作流）（横切承载；契约 Story 取主故事）
- Anchor: FR-F09（PRD §5.10 视图③/中→英翻译工作流（唯一落点）；§4.1 schema/§4.2 版本效果）
- Stage: MVP
- Revision: 6（08-05-2026：**向量状态面板整体删除**，替换为 **AI 摘要面板**——摘要在发布时由 LLM 生成、可人工校正且校正后不被覆盖，只服务本台内部语义查重；效果指标由五卡收敛为四卡（去「向量状态」卡））
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供状态流转条（草稿→编辑中→待审核→审核中→审核通过→已发布；异常支线：已驳回/已下线；当前态高亮、已过态打勾）与四页签：知识正文（富文本编辑器 + 字段侧栏对齐 §4.1：所属知识库/目录章节/两级问题场景/标签·同步 Zendesk labels/可见性三档/适用型号/复核周期/负责人）、版本与回滚、效果指标、操作日志（条目级全量留痕，schema §4.5）；操作按钮（保存中文草稿/提交审核/发布并同步）按权限矩阵与当前状态禁用并说明（统一过审铁律提示见 REQ-F09-04）；只读角色（AI 运营）编辑器锁定并明示「只读模式」。
中英双语 SHALL 按翻译工作流铁律执行（唯一落点 PRD §5.10）：中文=唯一内容权威源；**翻译范围含标题与正文**——英文标题与逐段译文同批产生、同受人工校验约束（英文标题缺失时「标记已确认」拒绝、发布门禁第③查不过、同步阻断，防英文读者看到中文标题）；英文状态机 未生成→AI 翻译中→待人工校验→已确认→已同步（异常：翻译失败/待重新校验）；「已确认」前「同步到 Zendesk」禁用（人工校验后才同步）；中文变更即英文置「待重新校验」并阻断同步（联动提示文案见 §5.10）；英文允许人工独立修订表述但不得改变政策口径、修订留痕带标注；内部段落不翻译、不同步；翻译失败保留上一次英文、同步阻断、可重试，连续失败（「建议值 3 次 · 终稿前确认」）告警。
版本与回滚页签 SHALL 展示版本列表（版本号/变更说明/状态/生效区间/操作人/调用/命中率/解决率/采纳率）与任意两版对比 diff（左右并排，删除行红底、新增行绿底）；当前发布版解决率较历史版下降 ≥「建议值 15pp · 终稿前确认」时给出回滚建议条；回滚（仅审核员）经确认弹窗（列明后果）后：目标版重新生效、当前版标「已回滚」、历史版本与指标不删除、写审计日志并自动入同步队列同步 Zendesk。
AI 摘要面板 SHALL 展示当前摘要正文、生成时间、来源徽章（AI 生成 / 人工校正）与用途说明（只服务本台内部：AI 对话挖掘做语义查重的比对基准，与 Zendesk AI 索引无关）；摘要 SHALL 在条目**发布时**由 LLM 依标题与正文生成；知识管理员可人工改写摘要，改写后标「人工校正」且后续发布 SHALL NOT 用 AI 结果覆盖；未发布过的条目显示「本条目尚未发布，摘要将在首次发布时生成」。IF LLM 不可用 THEN 摘要保留上一次内容并如实标注生成失败，不阻塞发布与人工流程。
IF 并发编辑同一条目 THEN 后提交者收到冲突提示、须基于最新版本重做；不静默覆盖，修订历史可回溯。
```

### REQ-F09-14 · AI 对话挖掘（视图④：每日批次拉取 + 三重准入 + 三类候选处置；revision 5 增补）

- Story: US-F09-14
- Anchor: FR-F09（PRD §5.10 视图④；§4.4 挖掘数据流唯一落点；§9.3 G1 冷启动）
- Stage: MVP
- Revision: 6（08-05-2026：三重准入②由「向量相似度查重」修订为 **LLM 语义查重**——两段式（字面粗筛 Top-5 → LLM 依条目 AI 摘要判定），判定理由随候选落库并在候选卡展示；LLM 不可用时如实降级标注）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 按「建议值 每日 · 终稿前确认」批次拉取昨日 Zendesk 会话（邮件工单 + 在线聊天，来源会话脱敏后才进中台，§4.6），批次列表展示 抓取日期/来源会话数分渠道（邮件工单 n · 在线聊天 m）/候选数/批次状态（完成/无新草稿/失败），按日期降序；空批次标「无新候选：均未达频次阈值，如实标注」、失败批次标原因（如 Zendesk API 429 限流）且次日照常拉取——不静默缺批次，不阻塞人工录入与审核。
候选 SHALL 经三重准入全过才产生：①频次达阈值（「建议值 ≥10 次/周 · 终稿前确认」）②**LLM 语义查重**（两段式）——先按 问题场景 + 标签交集 + 标题字面相似度 粗筛出至多 5 条最可能重复的既有条目（上限 5 条，控 LLM 调用量），再把候选主题与来源摘要连同这些条目的 **AI 摘要**（REQ-F09-13）交 LLM 判定，输出 `{条目标识, 相似度 0–1, 判定理由}` 并取最高分；相似度 ≥0.85 不新建、挂为该条目修订建议（防重复建条分流 bot 引用）；判定结果 SHALL 一次定分落库不重算（防 LLM 打分抖动导致判定翻转）③缺口判定（未覆盖/已覆盖但答不好/重复建条）；候选卡展示 类型徽章（新增/修订/合并）/标题/来源会话与渠道分布/频次/查重值 + **查重判定理由与比中条目标识**/缺口判定/AI 摘要/准入结论；合并类注明"合并后另一条 Zendesk 归档并重定向"。
IF LLM 不可用（未配置供应商凭据或调用失败）THEN 查重 SHALL 降级为字面相似度粗判并在候选卡与说明条如实标注「语义查重未生效——当前按字面相似度粗判，结果仅供参考」，不得冒充语义判定。
WHEN 处置候选 THE SYSTEM SHALL 提供 起草并提交审核（进审核中心，来源标注「AI 挖掘」）/ 挂为修订建议 / 发起合并（进审核）/ 丢弃（留痕；同主题再达阈值会重新出现）；挖掘产出无直接入库路径（统一过审，REQ-F09-04）；无提交权限角色降级为「提交优化建议」。
IF AI 起草服务不可用（LLM 故障）THEN 批次标失败、人工流程照常（AI 能力为增强不是依赖）。
冷启动语料 = 原 G1 历史数据导出（高频问题聚类初始输入，§9.3）。
```

### REQ-F09-15 · 审核中心（视图⑤：四来源统一队列 / 变更摘要+git diff / 驳回理由必填 / 发布门禁三查；08-05-2026 修订）

- Story: US-F09-09
- Related-Stories: US-F09-10（发布门禁）（契约 Story 取主故事）
- Anchor: FR-F09（PRD §5.10 视图⑤；铁律落点=REQ-F09-04，本条承载界面与门禁行为）
- Stage: MVP
- Revision: 6（08-05-2026：①「变更前后对照表」修订为**两层**——摘要层只给大概摘要、详情层为 **git diff 视图**；②发布门禁由四查收敛为**三查**，第④查代理评测随向量能力删除退役；③审核操作去四眼原则约束）
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供四来源统一待审队列（来源徽章：AI 挖掘·新增 / 人工录入 / 版本修订 / 反馈修订；批量导入条目亦经此队列，徽章「批量导入」）：按提交时间排序、AI 挖掘候选附频次，待审计数在一级导航常驻可见；审核详情 SHALL 分**两层**展示变更：第一层「变更摘要」只给大概摘要——一行总览（如「正文 3 处改动 · 字段 2 处改动」；新建条目为「新建条目 · {n} 个段落」）+ 逐项一句话概述，不展开全文；第二层「具体变更」经「查看具体变更」进入，采用 **git diff 视图**——按段落切分对齐、删除行 `-` 红底 / 新增行 `+` 绿底 / 未变更上下文行灰字且默认折叠（前后各留 1 行，可展开全部），行首带变更前后行号槽，字段变更以同形态键值行呈现，内部段落带标记。另展示 正文全文 + 来源与频次证据 + 审核历史时间线（驳回/重提/发布记录及理由）。
审核操作 SHALL 仅知识审核员可执行（其余角色「只能查看，不能通过或驳回」）：通过 → 自动跑发布门禁；驳回 → 理由必填弹窗（空理由不可提交，提示文案见 §5.10 文案定稿表），确认后条目回提交人草稿箱、状态「已驳回」、理由回传提交人并写入审核历史；审核员 SHALL 可审核自己提交的条目（四眼原则已于 08-05-2026 取消，见 REQ-F09-04）。
发布门禁**三查**（全过才入同步队列）：①格式与字段完整性（标题/章节/可见性/锚点/标签已填）②敏感信息与内部口径（内部段落已标记，不会进对外文章）③英文版本状态（未确认则同步将被阻断）；通过项打勾、警示项标黄；任一硬项不过 → 不入同步队列并展示原因。原第④查「代理评测（本台向量检索召回验证）」于 08-05-2026 随向量能力删除退役，门禁与界面 SHALL NOT 再出现任何检索代理指标。
```

### REQ-F09-16 · 同步中心 · Zendesk（视图⑥：单向权威同步 / 失败与阻断处置 / drift 检测治理 / 结构映射；revision 5 增补）

- Story: US-F09-10
- Related-Stories: US-F09-12（drift 处置）（契约 Story 取主故事）
- Anchor: FR-F09（PRD §5.10 视图⑥同步规则（写死）；§6.3 同步与 drift 时序；§7.2 Zendesk 接口边界；§7.3 drift 治理唯一落点）
- Stage: MVP
- Revision: 5
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 执行中台→Zendesk 单向权威同步（Zendesk 端不是编辑入口）：可见性决定目标——对外公开→帮助中心文章（中文+已确认英文）；仅客服内部→内部知识 segment（不对外）；混合条目内部段落剥离后才生成对外文章；英文未「已确认」则英文同步阻断（中英同发策略「建议值 中英同发，英文未确认整条阻断 · 终稿前确认」）；下线条目在 Zendesk 端归档并配置重定向，不裸删。
同步任务列表 SHALL 展示 条目标识/标题与版本/动作（更新正文+labels / 待过审后创建 / 归档+重定向）/目标（帮助中心具体 Section 或 内部知识·仅客服 segment）/状态（未同步/待同步/同步中/已同步/失败/已阻断/已归档）/语言（中/英，英文未生成或待校验如实标注）；四统计卡计数与列表一致，失败与阻断置顶标红；失败自动重试（「建议值 3 次 · 终稿前确认」）后告警并保留手动重试（仅审核员）；阻断行展示阻断原因；失败不影响 Zendesk 端上一版继续服务；不存在"阻断但已同步"的中间态。
drift 检测 SHALL 周期性（「建议值 每小时 · 终稿前确认」）比对中台已发布版本与 Zendesk 线上内容，检出差异即报警（文章与 Article 标识/修改方/差异摘要/时间）；处置（仅审核员）二选一：以本台内容覆盖（Zendesk 端修改丢弃，留痕）或 拉回进审核队列（Zendesk 端修改作为待审来源进审核中心）；两动作均写审计日志；IF drift 与本台待发版本冲突 THEN 先处置 drift 再放行同步，防相互覆盖丢内容；处置时效目标 ≤3 个工作日（建议值，§8.2）。
结构映射表 SHALL 常驻可查（本台结构 ↔ Zendesk 结构实例视图，规则唯一落点 §4.1）；IF 结构映射失败（目标 Section 不存在/被删）THEN 同步失败并提示先在章节管理修复映射（结构由本台维护并同步，条目同步器不代建结构）；IF 鉴权失效 THEN 失败原因显式区分「凭据失效」并告警指向 owner（内部技术团队）。
```

### REQ-F09-17 · 反馈回流（视图⑧：四渠道信号矩阵 + 五来源修订候选；revision 5 增补)

- Story: US-F09-13
- Anchor: FR-F09（PRD §5.10 视图⑧；信号数据面唯一落点 §4.3；指标口径 §8.2）
- Stage: MVP
- Revision: 5
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 展示四渠道信号矩阵表（bot 自动回答 / 人工工单 / 用户自助浏览 / 客服 flag）：每行含 渠道/命中信号/解决信号/确定性档位（原生·必得 / 档位相关 / 待核实——如实标注，数据面唯一落点 §4.3）；待核实信号核实前不进达标判定、不编造数据（§7.2/§8.3）。
修订候选队列（五来源）SHALL 逐条展示 来源徽章（客服 flag / 文章被踩 / bot 未解决转人工 / 高频无覆盖 / 搜索无结果关键词）+ 条目或主题 + 信号摘要与次数，动作按钮（转为修订建议 / 起草新条目 / 改标题与 labels）全部进审核队列（来源标注「反馈修订」）并留痕；客服 flag 处置时限「建议值 3 日内进候选 · 终稿前确认」（§8.2）。
AI 运营 SHALL 可提交建议（进审核队列）、不可直接改库（权限矩阵约束，REQ-F09-19）。
```

### REQ-F09-18 · 操作日志（视图⑨：全量审计流；revision 5 增补）

- Story: US-F09-15
- Anchor: FR-F09（PRD §5.10 视图⑨；审计 schema 唯一落点 §4.5）
- Stage: MVP
- Revision: 5
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 按 §4.5 schema 记录全量审计流：时间 / 操作人（真实账号+当时角色）/ 对象（条目/版本/用户/角色/权限项/同步任务）/ 动作徽章 / 字段级前后值（如 退款时限：7 天 → 5 天；发布权限：允许 → 禁止）/ 备注（含驳回理由）；动作全量覆盖（创建/保存草稿/提交审核/审核通过/审核驳回/发布并同步/版本回滚/触发翻译/英文校验确认/同步重试/drift 覆盖/拉回进审核/丢弃候选/用户启停/角色权限修改）。
日志 SHALL 只增不改不删、长期保留；驳回理由、权限变更、drift 处置为必留痕动作；四页签过滤（全部 / 内容变更 / 审核与发布 / 权限与系统）生效。
可见范围：知识审核员与系统管理员可查全量，其余角色可查与己相关记录（细则「建议值 · 终稿前确认」）。
```

### REQ-F09-19 · 用户与权限（视图⑩：RBAC 四角色 / 权限矩阵 / 账号体系；revision 5 增补）

- Story: US-F09-15
- Anchor: FR-F09（PRD §5.10 视图⑩ + RBAC 权限矩阵（唯一落点：10 项 × 4 角色）；§0.5 账号体系前置；§2.1 角色矩阵）
- Stage: MVP
- Revision: 5
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供三页签：用户管理（用户列表：姓名/邮箱/角色/知识库范围（全部或指定库，可授单库；只读范围可标注）/最后活跃/启用状态；创建用户仅系统管理员——必须选择角色与权限范围、保存写审计日志、首次登录强制改密（账号体系「建议值 邮箱+密码邀请制 · 终稿前确认」，§0.5）；禁用用户→会话即时失效、历史留痕保留、可再启用）、角色管理（四角色卡：知识管理员/知识审核员/AI 运营/系统管理员，含人数/允许清单/禁止清单/角色定位说明）、权限矩阵（10 项 × 4 角色，定稿唯一落点 PRD §5.10）。
权限矩阵 SHALL 仅系统管理员可修改、每次修改写审计日志；其余角色只读并提示「权限矩阵仅系统管理员可修改」；角色/权限修改即时生效。
任何界面动作 SHALL 受权限矩阵约束：越权动作按钮禁用并说明原因，或明确拒绝提示（文案见 §5.10）；系统管理员不参与知识内容的审核与发布（职责分离）；AI 运营=只读+建议（编辑器只读，禁止审核/发布/回滚/同步）；知识管理员无审核通过/发布/回滚权限。
```

### AC-F09-01 · 录入→审核→发布→检索命中闭环

- PRD 对照 ID: AC-M-13（PRD §10）
- Parent: REQ-F09-01
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-13 已废止，§10.5）：闭环语义承接=AC-F09-38（AC-P-25 迁移入库闭环）与 AC-F09-26（AC-P-13 同步中心）
- EARS:

```text
WHEN 知识库内容运营（内部角色）在 F09 管理台新建（或改后发布）一条知识条目，审核通过且发布门禁评测集回归通过
THE SYSTEM SHALL 使条目状态变为「已上线」、回归结果留痕可查；≤24h 内 App 用户在对话页（F01）就该条目覆盖的问题提问可被检索命中并作为引用来源（来源标注与该条目一致）——录入→审核→发布→检索命中闭环（§5.10）。
```

### AC-F09-02 · 审核队列草稿要素完整、按频次降序

- PRD 对照 ID: AC-M-14（PRD §10）
- Parent: REQ-F09-04
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-14 已废止，§10.5）：承接=AC-F09-23（AC-P-10 审核中心四来源队列）
- EARS:

```text
WHEN F05 回流触发源会话（拒答/点踩/转人工/复问）累积后，运营查看 F09 管理台审核队列
THE SYSTEM SHALL 在队列中展示 AI 聚类起草的条目草稿，每条含来源会话链接（或脱敏摘要）、聚合频次与问题标签建议，按频次降序排列（§4.4/§5.10）。
```

### AC-F09-03 · 无人审不生效（铁律）

- PRD 对照 ID: AC-M-15（PRD §10）
- Parent: REQ-F09-04
- Priority: P0
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-15 已废止，§10.5）：无人审不生效铁律承接=AC-F09-18（AC-P-05 统一过审）
- EARS:

```text
WHEN F09 管理台内存在未经审核的草稿/待审核条目（含人工录入与批量导入，08-04-2026 第三轮拍板：统一过审扩展），App 用户提出该条目覆盖的问题
THE SYSTEM SHALL 保证未审核条目不被检索命中、不出现在任何回答引用中；只有审核通过并过发布门禁的条目进入检索库（无人审不生效铁律，08-04-2026 第三轮拍板从"仅 AI 草稿"扩展为全部新条目/修订，§5.10）。
```

### AC-F09-04 · AI 建议可修改可拒绝且不阻塞提交进审核队列（08-04-2026 第三轮拍板语义修订）

- PRD 对照 ID: AC-E-13（PRD §10；第三轮拍板随统一过审语义修订）
- Parent: REQ-F09-03
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-E-13 已废止，§10.5）：候选处置语义承接=AC-F09-22（AC-P-09 三重准入与候选处置）
- EARS:

```text
WHEN 知识库内容运营对 AI 给出的切条/问题标签/归类建议逐项修改或拒绝（F09 管理台）
THE SYSTEM SHALL 使修改后按运营修改内容生效、拒绝后该建议不生效，且不阻塞人工提交进审核队列（AI 建议为建议态、非门槛；条目后续仍须经审核队列过审后入库，§5.10）。
```

### AC-F09-05 · 发布回归失败条目回炉、失败用例可见

- PRD 对照 ID: AC-E-14（PRD §10）
- Parent: REQ-F09-05
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-E-14 已废止，§10.5）：门禁失败可见语义承接=AC-F09-25（AC-P-12 发布门禁四查）
- EARS:

```text
WHEN 运营在 F09 管理台发布条目时评测集回归失败
THE SYSTEM SHALL 使条目不生效（不进检索库、状态回炉），管理台内可见回归失败原因与失败用例；修订后可重新发布（§5.10 发布门禁）。
```

### AC-F09-06 · 批量导入部分失败逐条报告（契约层增补）

- Parent: REQ-F09-02
- Priority: P1
- Note: revision 5 随审核中心更名与 Zendesk 换锚同步文字，口径不变（行为提炼自 PRD §5.10 异常场景「批量导入部分失败」，不新增行为）
- EARS:

```text
WHEN 批量导入文件中部分条目格式错误或字段缺失
THE SYSTEM SHALL 使成功条目照常进入审核中心待审队列（来源标注「批量导入」），失败条目逐条报告行号与原因；不整批静默失败、不静默丢行。
```

### AC-F09-07 · 确认标签扩充检索命中（契约层增补）

- Parent: REQ-F09-06
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：F01 检索命中验收随自研检索线废止；标签效果经 Zendesk（labels→帮助中心搜索/bot 匹配），不再以本契约 AC 表达
- EARS:

```text
WHEN 条目的问题标签经人工确认并随发布生效
THE SYSTEM SHALL 将该标签作为检索信号使对应用户问法变体可命中该条目；验收以 §4.3 评测集为准，§8 目标值不变（行为提炼自 PRD §5.10 交互逻辑 6，不新增行为）。
```

### AC-F09-08 · 数据看板·知识库数据子看板四卡与条目效果列表可见、口径一致（08-04-2026 第三轮拍板改组）

- PRD 对照 ID: AC-M-16（PRD §10；第三轮拍板由「第 5 导航区效果看板」改组归入第 1 导航区「数据看板」，内容不变）
- Parent: REQ-F09-07
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-16 已废止，§10.5）：看板验收承接=AC-F09-30（AC-P-17 知识库效果页签）
- EARS:

```text
WHEN 知识库内容运营或业务负责人打开 F09 管理台数据看板 · 知识库数据子看板（第 1 导航区）
THE SYSTEM SHALL 使四卡可见：场景覆盖（已上线条目场景分布+覆盖场景数）/使用频率（检索命中周趋势）/引用采纳（实际引用进回答周趋势，与命中分列——命中未被采纳可见）/知识库准确率（整体+趋势）；条目效果列表可见：逐条目命中数/引用数/点踩数/「试了没用」数/条目准确率，可按准确率升序排列（最差条目浮顶）；全部指标口径与 §8.2「知识条目效果」行一致；同一导航区内另可见客服工作数据看板（F06 同源，§5.7/§5.10）。
```

### AC-F09-09 · 样本量不足不显示误导性准确率

- PRD 对照 ID: AC-E-15（PRD §10；文字随看板更名同步，口径不变）
- Parent: REQ-F09-07
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-E-15 已废止，§10.5）：「样本积累中」语义承接=AC-F09-30（AC-P-17）
- EARS:

```text
WHEN F09 知识库数据看板中某条目引用数低于样本量下限（「建议值 10 次 · 终稿前确认」）
THE SYSTEM SHALL 使该条目不显示准确率数值，准确率位置显示「样本积累中」——不显示误导性准确率；其余指标（命中数/引用数/点踩数/「试了没用」数）照常显示（§5.10）。
```

### AC-F09-10 · 中台界面 100% 简体中文且不改条目内容语言（契约层增补）

- Parent: REQ-F09-08
- Priority: P1
- Note: revision 5 随十视图与语言口径修订同步文字（作用面五区→十视图；条目语言=中文权威源+英文同步版本），行为性质不变（提炼自 PRD §5.1「界面语言」通用约定）
- EARS:

```text
WHEN 任一角色打开中台任一视图（十视图五组全域）
THE SYSTEM SHALL 使全部界面元素（导航/按钮/标签/提示/占位文案）与界面示例内容以简体中文呈现，无残留英文装饰性文案（品牌词 "COOLFLY" 除外），且条目内容语言不因界面语言改变（中文权威源 + 英文同步版本，§4.1）。
```

### AC-F09-11 · 知识库总页面章节树可导航（08-04-2026 第三轮拍板增补）

- PRD 对照 ID: AC-M-17（PRD §10）
- Parent: REQ-F09-09
- Priority: P1
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-17 已废止，§10.5）：章节树验收承接=AC-F09-15（AC-P-02 知识库总览结构树）
- EARS:

```text
WHEN 知识库内容运营打开 F09 知识库总页面（第 2 导航区）
THE SYSTEM SHALL 使条目按大章节 → 小章节两级书目录式层级组织可导航：章节树可折叠展开、条目挂在小章节下、点击条目进入详情/编辑器；章节可由运营新建/重命名/调整层级；搜索与筛选（场景/型号/语言/状态/标签）在层级结构下保留可用（§5.10/§4.1「所属章节」）。
```

### AC-F09-12 · 人工录入未经审核不入知识库总页面（08-04-2026 第三轮拍板增补）

- PRD 对照 ID: AC-M-18（PRD §10）
- Parent: REQ-F09-02
- Priority: P0
- Status: retired
- Retirement note: retired（PRD 对照 AC-M-18 已废止，§10.5）：承接=AC-F09-18（AC-P-05 统一过审）与 AC-F09-38（AC-P-25 迁移入库）
- EARS:

```text
WHEN 运营在 F09 人工录入界面提交一条新条目，尚未经人工审核
THE SYSTEM SHALL 使该条目仅出现在审核队列（来源标注「人工录入」），不出现在知识库总页面、不进检索库；人工审核通过并过发布门禁后才转入知识库总页面对应章节（§5.10 统一过审）。
```

### AC-F09-13 · AI 录入批次展示与失败/空批次如实标注（契约层增补）

- Parent: REQ-F09-10
- Priority: P1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：批次展示与失败/空批次如实标注承接=AC-F09-21（AC-P-08）
- EARS:

```text
WHEN 系统完成（或未能完成）一次每日会话抓取批次后，运营打开 F09 AI 录入界面（第 4 导航区）
THE SYSTEM SHALL 使批次列表展示每批次的抓取时间/来源会话数/生成草稿数/批次状态（按时间降序），点批次可查看该批草稿（草稿本体在审核队列）；批次失败或当日无可提炼会话时如实标注「失败」或「无新草稿」，不静默缺批次（行为提炼自 PRD §5.10 交互逻辑 4/界面元素表/异常场景，不新增行为）。
```

### AC-F09-14 · 工作台四统计卡与角色化下一步动作

- PRD 对照 ID: AC-P-01（PRD §10.1）
- Parent: REQ-F09-11
- Priority: P0
- EARS:

```text
WHEN 任一角色登录进入我的工作台
THE SYSTEM SHALL 使四统计卡（我的草稿/我提交待审/被驳回待改/待我审核）按当前账号实时计数；分组列表每行给出与角色权限一致的下一步动作；无审核权限角色的「待我审核」显示无权限说明而非空报错。
```

### AC-F09-15 · 知识库总览多库与三级结构树可导航（Revision 6 · 08-05-2026）

- PRD 对照 ID: AC-P-02（PRD §10.1）
- Parent: REQ-F09-12
- Priority: P0
- EARS:

```text
WHEN 打开知识库总览并切换三个知识库
THE SYSTEM SHALL 使多库可切换（含「客服话术库·仅内部」带不对外说明）；结构树按 目录→章节→条目 **三级**可折叠导航（逐级缩进、树内仅呈现已发布条目并带「仅已发布」徽章、结构操作在顶部工具条与悬停行内），章节行带 Zendesk Section 映射标识；条目行可见 状态/可见性/版本/英文状态/同步状态/解决率/复核到期。
```

### AC-F09-16 · 总览搜索与组合筛选即时过滤

- PRD 对照 ID: AC-P-03（PRD §10.1）
- Parent: REQ-F09-12
- Priority: P1
- EARS:

```text
WHEN 使用搜索与组合筛选（场景/状态/可见性/复核到期）
THE SYSTEM SHALL 使结果即时过滤且标注归属路径；「已到期/30 天内到期」筛选可用，超期条目标红。
```

### AC-F09-17 · 中文保存联动英文阻断（Revision 6 · 08-05-2026 去向量）

- PRD 对照 ID: AC-P-04（PRD §10.1）
- Parent: REQ-F09-13
- Priority: P0
- EARS:

```text
WHEN 知识管理员编辑「退款政策」正文并保存中文草稿
THE SYSTEM SHALL 使富文本与字段侧栏（库/章节/两级场景/标签/可见性/型号/复核周期/负责人）可编辑保存；保存后英文状态自动置「待重新校验」、该条目同步被阻断且原因可见。
```

### AC-F09-18 · 统一过审铁律（无绕过发布路径）

- PRD 对照 ID: AC-P-05（PRD §10.1；承接原 AC-M-15/AC-M-18 语义）
- Parent: REQ-F09-04
- Priority: P0
- EARS:

```text
WHEN 知识管理员尝试直接发布任一条目
THE SYSTEM SHALL 使「发布并同步」恒禁用并提示统一过审铁律；其提交的条目仅出现在审核中心；未过审条目不同步 Zendesk、不出现在帮助中心与客服 segment。
```

### AC-F09-19 · 版本 diff 与回滚生效留痕

- PRD 对照 ID: AC-P-06（PRD §10.1）
- Parent: REQ-F09-13
- Priority: P0
- EARS:

```text
WHEN 审核员查看「退款政策」版本页并执行回滚到 v1
THE SYSTEM SHALL 使版本列表含各版效果（调用/命中/解决/采纳）；任选两版可见左右 diff（删除红/新增绿）；确认回滚后 v1 重新生效、v2 标「已回滚」、历史指标保留、动作写审计日志并自动入同步队列。
```

### AC-F09-20 · 复核到期倒计时与超期筛选

- PRD 对照 ID: AC-P-07（PRD §10.1）
- Parent: REQ-F09-12
- Priority: P1
- EARS:

```text
WHEN 条目发布后达到复核周期
THE SYSTEM SHALL 使条目在总览显示到期倒计时；超期标红并可被「已到期」筛选命中。
```

### AC-F09-21 · 挖掘批次展示与空/失败批次如实标注

- PRD 对照 ID: AC-P-08（PRD §10.1）
- Parent: REQ-F09-14
- Priority: P0
- EARS:

```text
WHEN 查看近四日抓取批次（含一个空批次与一个失败批次）
THE SYSTEM SHALL 使每批次显示 来源会话数（分邮件工单/在线聊天）、候选数、状态；空批次标「无新候选（未达频次阈值）」、失败批次标原因（如 API 限流）且次日照常拉取——无静默缺批次。
```

### AC-F09-22 · 三重准入展示（含 LLM 查重理由）与候选处置无直接入库（Revision 6 · 08-05-2026）

- PRD 对照 ID: AC-P-09（PRD §10.1）
- Parent: REQ-F09-14
- Priority: P0
- EARS:

```text
WHEN 查看候选卡并处置（含一条查重 0.88 的候选）
THE SYSTEM SHALL 使每条候选展示 频次/查重值 + **查重判定理由与比中条目标识**/缺口判定 与类型（新增/修订/合并）；查重 ≥0.85 的候选不提供「立新条」而是「挂为修订建议」；处置=起草并提交审核 或 丢弃（留痕，同主题再达阈值重现）；无任何候选直接入库路径；LLM 不可用时候选卡与说明条如实标注「语义查重未生效」。
```

### AC-F09-23 · 审核中心四来源队列与变更摘要+git diff 两层对照（Revision 6 · 08-05-2026）

- PRD 对照 ID: AC-P-10（PRD §10.1）
- Parent: REQ-F09-15
- Priority: P0
- EARS:

```text
WHEN 审核员打开待审队列
THE SYSTEM SHALL 使四来源徽章（AI 挖掘/人工录入/版本修订/反馈修订）可辨；单条先见**变更摘要**（一行总览 + 逐项一句话概述），点「查看具体变更」展开 **git diff 视图**（删除行 `-` 红底 / 新增行 `+` 绿底 / 上下文灰字可展开全部）；通过后自动进入发布门禁；待审计数在导航实时可见。
```

### AC-F09-24 · 驳回理由必填与往返留痕

- PRD 对照 ID: AC-P-11（PRD §10.1）
- Parent: REQ-F09-15
- Priority: P0
- EARS:

```text
WHEN 审核员驳回一条待审条目且理由留空
THE SYSTEM SHALL 使空理由无法提交（必填校验提示可见）；填写后条目回提交人草稿箱、状态「已驳回」、理由写入审核历史并在提交人工作台可见；重新提交后审核历史含完整往返记录。
```

### AC-F09-25 · 发布门禁三查与英文未确认阻断（Revision 6 · 08-05-2026 由四查收敛）

- PRD 对照 ID: AC-P-12（PRD §10.1）
- Parent: REQ-F09-15
- Priority: P0
- EARS:

```text
WHEN 一条英文状态为「待人工校验」的条目通过审核
THE SYSTEM SHALL 使门禁**三查**展示（格式字段/内部段落标记/英文状态）；英文未确认→不入同步队列、阻断原因可见；门禁清单与界面不出现任何检索代理指标。
```

### AC-F09-26 · 同步任务五档状态与失败重试

- PRD 对照 ID: AC-P-13（PRD §10.1）
- Parent: REQ-F09-16
- Priority: P0
- EARS:

```text
WHEN 查看同步任务列表（含失败与阻断行）
THE SYSTEM SHALL 使状态五档（待同步/同步中/已同步/失败/已阻断）计数与列表一致；失败行自动重试（建议值 3 次）后告警并保留手动重试（仅审核员可点）；阻断行展示阻断原因。
```

### AC-F09-27 · 可见性三档同步与内部段落不外泄

- PRD 对照 ID: AC-P-14（PRD §10.1）
- Parent: REQ-F09-16
- Priority: P0
- EARS:

```text
WHEN 三种可见性条目各同步一次
THE SYSTEM SHALL 使对外公开→帮助中心文章；仅客服内部→仅客服 segment、对外帮助中心不可见；混合条目的内部段落不出现在对外文章与英文翻译中。
```

### AC-F09-28 · drift 报警与二选一处置留痕

- PRD 对照 ID: AC-P-15（PRD §10.1）
- Parent: REQ-F09-16
- Priority: P0
- EARS:

```text
WHEN Zendesk 端一篇文章被绕过中台直接修改
THE SYSTEM SHALL 使同步中心出现漂移报警（文章/修改方/差异摘要/时间）；审核员可二选一处置：以本台覆盖（留痕）或拉回进审核队列（成为待审来源）；两动作均写审计日志。
```

### AC-F09-29 · 翻译工作流状态机与人工校验后才同步

- PRD 对照 ID: AC-P-16（PRD §10.1）
- Parent: REQ-F09-13
- Priority: P0
- EARS:

```text
WHEN 中文条目走完英文流程
THE SYSTEM SHALL 使英文状态机 未生成→AI 翻译中→待人工校验→已确认→已同步 逐态可见；「已确认」前「同步到 Zendesk」禁用（人工校验后才同步）；翻译失败保留上次英文、同步阻断、可重试；人工修订段落带修订标注。
```

### AC-F09-30 · 知识库效果页签与样本不足标注

- PRD 对照 ID: AC-P-17（PRD §10.1；承接原 AC-E-15「样本积累中」语义）
- Parent: REQ-F09-07
- Priority: P0
- EARS:

```text
WHEN 打开知识库效果页签
THE SYSTEM SHALL 使场景覆盖条（对照工单场景分布，低覆盖标红）与条目效果列表（bot 引用/agent 引用/被踩/flag/解决率/版本）可见；低解决率条目标红浮顶；引用数低于样本下限显示「样本积累中」；点行直达条目效果页签。
```

### AC-F09-31 · 知识缺口页签动作直达审核队列

- PRD 对照 ID: AC-P-18（PRD §10.1）
- Parent: REQ-F09-07
- Priority: P1
- EARS:

```text
WHEN 打开知识缺口页签
THE SYSTEM SHALL 使缺口→动作列表（未覆盖→立新条/已覆盖但答不好→修订）与搜索无结果关键词列表（含判定）可见；动作按钮一键起草/挂修订进审核队列。
```

### AC-F09-32 · 客服工作数据页签不重建 Explore

- PRD 对照 ID: AC-P-19（PRD §10.1）
- Parent: REQ-F09-07
- Priority: P1
- EARS:

```text
WHEN 打开客服工作数据页签
THE SYSTEM SHALL 使页签不出现重建的工单量/首响/CSAT 图表；展示 Explore 口径说明与指向 + 「去知识缺口」直达——本台不重建 Explore 已有报表。
```

### AC-F09-33 · 信号矩阵四渠道与五来源候选可处置

- PRD 对照 ID: AC-P-20（PRD §10.1）
- Parent: REQ-F09-17
- Priority: P0
- EARS:

```text
WHEN 打开反馈回流视图
THE SYSTEM SHALL 使信号矩阵四渠道行（bot 自动回答/人工工单/用户自助浏览/客服 flag）各含命中信号、解决信号与确定性档位标注（必得/档位相关/待核实如实区分）；修订候选五来源（flag/被踩/bot 未解决/高频无覆盖/搜索无结果）逐条可转为建议进审核队列。
```

### AC-F09-34 · 操作日志全链路字段级留痕

- PRD 对照 ID: AC-P-21（PRD §10.1）
- Parent: REQ-F09-18
- Priority: P0
- EARS:

```text
WHEN 完成一轮 提交→驳回→重提→通过→发布→回滚→权限修改 后查看日志
THE SYSTEM SHALL 使每一步均有记录：时间/操作人（角色）/对象/动作/字段级前后值（如 退款时限：7 天→5 天；发布权限：允许→禁止）/备注（含驳回理由）；四页签过滤（内容变更/审核与发布/权限与系统）生效。
```

### AC-F09-35 · 权限矩阵逐项生效与越权拒绝

- PRD 对照 ID: AC-P-22（PRD §10.1）
- Parent: REQ-F09-19
- Priority: P0
- EARS:

```text
WHEN 分别以四角色执行越权操作（AI 运营改正文、知识管理员点审核/发布/回滚、审核员改权限矩阵）
THE SYSTEM SHALL 使全部被界面禁用或明确拒绝并说明原因，与 PRD §5.10 权限矩阵（10 项×4 角色）逐项一致；矩阵修改仅系统管理员可执行且每次写审计日志。
```

### AC-F09-36 · 审核员自审可执行且留痕（Revision 6 · 08-05-2026 由「四眼原则不可自审自发」修订）

- PRD 对照 ID: AC-P-23（PRD §10.1）
- Parent: REQ-F09-04
- Priority: P0
- EARS:

```text
WHEN 知识审核员审核自己提交的条目
THE SYSTEM SHALL 使通过操作**可执行**（界面不禁用、approve 接口不拒绝）；该次审核写入操作日志且提交人与审核人同为一人的事实可查——原「四眼原则不可自审」判据已于 08-05-2026 经用户拍板废止。
```

### AC-F09-37 · 用户创建与禁用全程留痕

- PRD 对照 ID: AC-P-24（PRD §10.1）
- Parent: REQ-F09-19
- Priority: P0
- EARS:

```text
WHEN 系统管理员创建并随后禁用一个用户
THE SYSTEM SHALL 使创建时必须选择角色与知识库范围（可授单库）、首次登录强制改密；禁用后该用户会话即时失效、历史操作留痕保留；两动作均写审计日志。
```

### AC-F09-38 · 初始迁移全程无绕审入库路径

- PRD 对照 ID: AC-P-25（PRD §10.1；承接原 AC-M-13 闭环与 AC-M-18 语义）
- Parent: REQ-F09-02
- Priority: P0
- EARS:

```text
WHEN 飞书 120+ 篇批量导入
THE SYSTEM SHALL 使导入内容全部进审核队列（来源「批量导入」，失败条目逐条报告原因）；未过审条目不同步；过审条目按可见性同步至 Zendesk 对应 Section 或客服 segment——迁移全程不存在绕过审核的入库路径。
```

---

### AC-F09-39 · AI 摘要面板与 LLM 语义查重理由可见（revision 6 增补）

- PRD 对照 ID: AC-P-26（PRD §10.1）
- Parent: REQ-F09-13
- Related-REQ: REQ-F09-14（查重理由展示面）
- Priority: P0
- EARS:

```text
WHEN 发布一条条目后在条目工作台查看 AI 摘要面板，随后跑一次挖掘批次并查看候选卡
THE SYSTEM SHALL 使摘要在发布时生成、面板展示来源徽章（AI 生成 / 人工校正）与用途说明；人工改写摘要后标「人工校正」且再次发布不被 AI 结果覆盖；候选卡展示查重值与 LLM 判定理由及比中条目标识；IF LLM 不可用 THEN 候选卡与三重准入说明条如实标注「语义查重未生效」而非静默给分。
```

## Non-functional requirements

### NFR-001 · 无障碍基线

- Applies-to: REQ-F01-11（承接验收：AC-C-01/02/03）
- Source: PRD §5.1 通用约定（无障碍 NFR 🟩，全功能适用）
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：App 对话流/排障卡片/转人工摘要随 C 端界面废止；中台为桌面 Web（1280+），无障碍要求未在 PRD rev5 登记为需求，后置 App 接入阶段重启
- Measure: 关键可点击元素触达区域 ≥44pt；系统字体缩放最大档不破版、按钮文案不截断；对话流/排障卡片/转人工摘要通过基础 VoiceOver 走查（走查范围=进入入口→提问→转人工主流程）。

### NFR-002 · 合规前置（上线条件）

- Applies-to: REQ-F09-13, REQ-F09-14, REQ-F09-19
- Source: PRD §9.7（合规 NFR 上线前置 🟩）/§4.6
- Revision: 5（D-10：来源从 §9.14 App 侧合规改为 §9.7 中台合规；加州 bot 披露/push 权限项随 C 端废止移除）
- Status: active
- Measure: ①LLM 供应商提供 DPA 且输入不用于训练（挖掘/翻译/建议选型硬条件）；②挖掘候选引用的来源会话脱敏后才进中台（邮箱/SN/家庭 Wi-Fi 名称打码，§4.6）；③中台账号最小权限 + 首次登录强制改密；④审计日志只增不改不删、长期保留；⑤对外内容（帮助中心/bot 话术）合规责任随 Zendesk 侧内容审校流程，中台过审即口径把关点。任一未就绪 = 不满足上线条件。

### NFR-003 · 性能预期

- Applies-to: REQ-F01-10
- Source: PRD §5.2 边界数值/§9.9
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：自研对话运行时性能预期废止；C 端响应性能由 Zendesk 平台承担，不在本 PRD 边界（PRD §7 章头登记）
- Measure: 响应超时阈值 8–10 秒「建议值 · 终稿前确认」；首条流式内容出现时间「建议值 ≤3 秒 · 终稿前确认」；监控首内容出现时间 P50/P95、超时触发率、降级触发率；超时提示触发率 >「建议值 5% · 终稿前确认」持续一周即优先于新功能处理；若 LLM 首 token 延迟 P95 接近超时阈值，阈值与流式指示策略终稿前联动校准。

### NFR-004 · 数据治理

- Applies-to: REQ-F09-14, REQ-F09-16, REQ-F09-18
- Source: PRD §4.6
- Revision: 5（D-10：三口径时区/埋点最终一致条款随自研埋点废止；换为中台/Zendesk 跨源治理）
- Status: active
- Measure: 时区=中台界面按业务时区展示（「建议值 · 终稿前确认」），Zendesk 侧数据按接口返回时间统一换算、跨源对齐口径在数据看板标注；一致性=中台为知识唯一权威源、中台→Zendesk 单向同步最终一致、drift 周期比对报警（§5.10 视图⑥），并发编辑冲突提示不静默覆盖；保留=审计日志长期保留，挖掘批次与候选留存「建议值 12 个月 · 终稿前确认」，版本历史与各版效果指标永久保留（回滚与追责依据）。

### NFR-005 · 演进约束（架构五条，违反即缺陷）

- Applies-to: REQ-F01-01, REQ-F03-01, REQ-F06-04, REQ-F07-01, REQ-F07-02
- Source: PRD §3.7（debate-log Round 3 裁决 7）
- Revision: 1
- Status: retired
- Retirement note: retired（08-04-2026 D-10）：引擎演进五条随自研引擎废止；知识条目渠道中立与语言字段约束由中台 schema 继承（PRD §3 登记表/§4.1）；交接契约由 Zendesk 工单字段原生承担（§12.3）
- Measure: ①引擎渠道无关化（故障上下文为可选结构化输入；新渠道只写适配层）；②埋点 schema 带 channel 字段（默认 app）；③转人工最小交接契约 6 字段顺序固定不可随实现变动（PRD §12.3）；④F07 两条约束（见 REQ-F07-01/02）；⑤排障流程 schema 与知识条目渠道中立（不含 App 界面专属字段）。验收方式 = schema 与接口审查项；旧客户端纯文本降级（AC-C-04）为渠道中立的验收锚点。

## 发布门禁与同步铁律（行为契约级约束 · 08-04-2026 D-10 重写）

> 原「评测集与放量门禁」节随 F01–F08 与自研引擎废止（golden set 构成/灰度 2 周 20%→50%→100%/放量门禁五项/供应商切换回归等机制 retired，历史见 git commit 671e97a）；其降级形态「发布门禁第④查代理评测」亦于 **08-05-2026 随向量能力删除一并退役**，本台不再自建任何检索代理指标（PRD §4 章头登记）。

- 发布门禁**三查**（REQ-F09-15 / AC-F09-25）：格式字段完整性 / 内部段落标记 / 英文版本状态——全过才入同步队列；解决率等对外口径只能来自 Zendesk 侧真实信号，本台不产出检索代理指标（PRD §8.3）。
- 同步铁律（REQ-F09-16）：中台→Zendesk 单向权威；英文未「已确认」阻断；下线归档+重定向不裸删；失败自动重试后告警不静默；不存在"阻断但已同步"中间态。
- 翻译铁律（REQ-F09-13 / AC-F09-29）：翻译人工校验率 100%（铁律，非建议值，§8.2）；中文变更即英文阻断；内部段落不翻译不同步（AC-F09-27）。
- 统一过审铁律（REQ-F09-04 / AC-F09-18）：无人审不生效，任何角色无绕过路径；审核员可自审但全程留痕可审计（AC-F09-36，四眼原则已于 08-05-2026 取消）。
- 指标防欺骗（PRD §8.3）：条目解决率近似归因如实标注；待核实信号（bot 锚点引用/面板引用/浏览行为）核实前不进达标判定；北极星（bot automated resolution rate）目标值占位 `[PRD 定数 · Zendesk 基线后回填]`，口径重校准检查点（「建议值 上线后 60–90 天 · 终稿前确认」）回填北极星目标与价值账。

## 假设注册表引用（A-001–A-007，状态随 D-10 更新，PRD §11.2）

| ID | 假设 | D-10 后状态 | 契约关联 |
| :--- | :--- | :--- | :--- |
| A-001 | 飞书知识库质量足以支撑高频回答 | 转化为迁移质量风险：120+ 篇逐条过审消化，质量在审核中兜底（§9.5） | REQ-F09-02、REQ-F09-15 |
| A-002 | 第一版英文单语可接受 | **废止（retired，08-04-2026 D-10）**——被中→英翻译工作流实质取代 | REQ-F09-13（承接）、AC-F09-29 |
| A-003 | 方案商设备日志接口不存在（已确认现状） | 保留（后置阶段前提不变） | 后置登记（无现役 REQ 依赖） |
| A-004 | 自助解决率高频类 ≥60% / 整体 ≥50% 为合理目标 | 随口径换锚需重校准——历史目标基于自研埋点（已废止），数值待 Zendesk 基线重估（§8.1/§8.3） | REQ-F09-07（呈报面）、北极星占位 |
| A-005 | 智能客服可贡献退货率降约 3pp | 保留；验证链路=G4（保留）+ Zendesk 工单交叉分析 | G4 前置行、价值账重校准检查点（§8.3） |
| A-006 | 每台退货损失约客单价 70% | 保留；财务校准挂价值账重校准检查点 | 同上 |
| A-007 | 高频三类占咨询量 60%+ | 保留；验证源改为 Zendesk 工单场景分布 + G1 历史语料 | REQ-F09-14（冷启动语料）、REQ-F09-07（场景覆盖对照） |

## 统计（revision 6 · 08-05-2026 四项变更）

- 稳定对象总计：**190**（US×36 + REQ×56 + AC×93 + NFR×5）；其中 **active 55 / retired 135**（retired 保留原 ID 与 EARS 正文为契约史料，永不复用）。revision 6 无新增 retire——「四眼原则」「代理评测」「向量能力」为行为废止，承载对象原地修订续用。
- US：36 注册 = 24 retired（F01–F08×20 含契约层增补 US-F07-01；F09 五区版旧×4）+ 12 active（US-F09-05…16，revision 5 随 PRD §2.4 增补）。
- REQ：56 注册 = 43 retired（F01–F08×37；F09 旧×6：REQ-F09-01/03/05/06/09/10）+ 13 active（修订续用×4：REQ-F09-02/04/07/08 + 新增×9：REQ-F09-11…19；其中 REQ-F09-04/07/12/13/14/15 于 revision 6 原地修订）；active REQ 全部 Anchor=FR-F09、Stage=MVP。
- AC：93 注册 = 65 retired（F01–F08×54；F09 旧×11：AC-F09-01…05/07/08/09/11/12/13）+ 28 active（契约层增补续用×2：AC-F09-06/10 + 新增×26：AC-F09-14…39 ↔ PRD AC-P-01…26）；每条 AC 唯一 Parent，13 个 active REQ 全部由 active AC 覆盖（retired REQ 由 retired AC 覆盖，史料闭合）。
- NFR：5 注册 = 3 retired（NFR-001/003/005）+ 2 active（NFR-002 合规、NFR-004 数据治理，Revision 5）。
- 占位符：「建议值 · 终稿前确认」与 `[PRD 定数 · Zendesk 基线后回填]`（2 处：北极星目标/bot 自动解决率目标）原样保留不编数（清单权威=PRD §13.2）；原 `[PRD 定数 · Gx 后回填]` 占位随 F01–F08 retire 停用（史料中保留原文）。
- 铁律覆盖核对（对齐 PRD §13.1）：权限矩阵生效=AC-F09-35、统一过审=AC-F09-18、驳回理由必填=AC-F09-24、同步阻断=AC-F09-25/26、版本回滚=AC-F09-19、drift 报警=AC-F09-28、翻译人工校验后才同步=AC-F09-29、审核自审留痕=AC-F09-36（原四眼原则已取消）、迁移无绕审=AC-F09-38。
