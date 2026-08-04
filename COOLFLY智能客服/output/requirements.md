# COOLFLY 智能客服 Requirements Contract

## Metadata

- work_type: feature
- workflow_mode: standard
- revision: 4
- source_prd: PRD详细版.md（1569 行，commit c8f2434 F09 第三轮重构：一级导航五区 + 章节树 + 人工/AI 统一过审 + AI 每日抓取 + 全中文含示例；§13 一致性自检为 ID 权威）
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

## ID 体系与映射说明

- F01–F09 / FR-F01–FR-F09 / US-F0x-nn / A-001–A-007：**原样引用 PRD 既有稳定 ID**，不重排、不改义（F09/FR-F09 为 08-04-2026 PRD 增补，revision 2 同步）。
- **REQ 层为本契约按规范增补**（PRD 只有 FR/AC 两层，无 REQ 编号）：以组级 FR-F0x 为锚新增 `REQ-F0x-nn`，每条 REQ 标注 `Anchor: FR-F0x` 与 PRD 章节出处；只增补不重排。
- **AC 双 ID 制**：PRD §10 的 AC-M·E·S·C·I 系列（共 55 条；revision 2 随 PRD 增 AC-M-13/14/15、AC-E-13/14，revision 3 随 PRD 增 AC-M-16、AC-E-15，revision 4 随 PRD 增 AC-M-17/18）保持权威展示 ID 不变（PRD 不改）；本契约为每条 AC 增补机器可解析的契约 ID `AC-Fxx-yy`（xx=所属功能，yy=组内顺序），每个 AC 块内以 `- PRD 对照 ID:` 行保留双向映射，正文与 PRD 交叉引用继续使用 AC-M 系列展示 ID。完整对照表：

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

- **契约层增补对象**（PRD 无对应 ID，标注"契约层增补"）：US-F07-01（F07 架构约束承载故事）；AC-F01-20/21、AC-F02-08、AC-F03-11、AC-F05-02、AC-F06-02/03/04（8 条，行为均提炼自 PRD §5/§7 已写死内容）；AC-F09-06/07（2 条，revision 2 增补，行为提炼自 PRD §5.10 已写死内容）；AC-F09-10（1 条，revision 3 增补，行为提炼自 PRD §5.10「权威源与界面语言」节）；AC-F09-13（1 条，revision 4 增补，行为提炼自 PRD §5.10 交互逻辑 4/异常场景「AI 录入批次失败或空批次」）——共 12 条最小 AC，均不新增行为。
- **NFR-001–NFR-005 为本契约按模板编号**：PRD 无独立 NFR 编号（§13.1 声明），来源分别为 §5.1（无障碍）、§9.14（合规）、§9.9（性能）、§4.5（数据治理）、§3.7（演进约束）。
- `[PRD 定数 · Gx 后回填]` 与「建议值 · 终稿前确认」占位**原样保留**（清单见 PRD §13.2），本契约不编数。
- 未决拍板：拍板 1（重建 vs 升级）、拍板 3（时间表/灰度/旺季）为 `OPEN_QUESTION`（PRD §0.5/§9.11）；F01–F08 用户可见完成标准为形态无关硬验收，不随之变化。

## External capability configuration

| Capability | Credential owner | Configuration actor | Surface | Scope | Lifecycle | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LLM API（供应商待选型，硬条件=提供 DPA 且输入不用于训练，PRD §9.2/§9.14） | 内部技术团队 | 内部技术团队 | deployment-secret | system | 部署密钥方式配置，无用户可见配置界面；更换供应商须整套评测集回归通过方可切换 | MVP | REQ-F01-01、REQ-F01-02、NFR-002 |
| 飞书知识库 API（120+ 篇**一次性迁移导入** F09 管理台审核队列，来源标注「批量导入」，08-04-2026 拍板改口径、第三轮拍板并队，PRD §9.2） | 用户团队 | 用户团队申请 / 内部技术团队接入 | deployment-secret | system | API 权限前置登记；一次性：迁移完成即生命周期结束、不留同步链路，此后管理台=唯一权威源；迁移失败→人工从飞书导出文件（Markdown/CSV）经 F09 批量导入兜底；索引失败分层告警归 §7.4（与飞书无关） | MVP | REQ-F09-02、REQ-F01-02 |
| push 通知基建（G3 反向通路组成部分，PRD §9.2） | 现有 App 基建（内部） | 内部技术团队 | deployment-secret | system | G3 查证不可行或用户拒绝权限 → 落底线态三件套，话术不承诺通知 | MVP（目标态） | REQ-F03-03 |
| 容量预警推送载体（「建议值 飞书群机器人推送 · 终稿前确认」，PRD §5.7） | 用户团队 / 内部技术团队 | 内部技术团队 | deployment-secret | system | 触线推送企业家；载体终稿前确认 | MVP | REQ-F06-03 |

> 方案商设备日志接口：**不存在（A-003，依据等级 A）**，依赖它的设备诊断已整体移出当前阶段（后置，PRD §0.1/§9.2），不列为本契约外部能力；本期排障上限=引导自查+带 SN 转人工（AC-I-02）。
>
> 阶段二储备登记（企业家 08-03-2026 拍板、08-04-2026 随 F09 更新，仅方向登记，不新增本契约 REQ/AC；详见 PRD §0.1 后置清单）：①**语音/无屏交互渠道**——接口预留由既有约束承担（REQ-F07 系引擎渠道无关/渠道中立相关条款 + 埋点 channel 字段），实现本契约任何 REQ 时不得违反；②**知识库多渠道采集扩展**——原「AI 生成型知识库」中的会话提炼与知识库管理台已随 F09 提前进入 MVP（REQ-F09-01…06），阶段二仅保留从应用商店评分/客服邮件采集进 F09 审核队列的多渠道扩展（依 channel 字段接入）；「无人审不生效」铁律（REQ-F09-04）与评测集回归门禁（REQ-F09-05）不变。

## Capability prerequisites

| Prerequisite | Status | Owner | Evidence or deadline | Fallback | Stage | Requirement IDs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 飞书知识库（120+ 篇）访问/一次性迁移导入 F09 管理台 | ready | 用户团队 | 已存在（用户确认，PRD §0.4；08-04-2026 拍板：一次性迁移为初始数据，此后管理台=唯一权威源） | 迁移失败→人工从飞书导出文件经 F09 批量导入（PRD §9.2） | MVP | REQ-F01-02、REQ-F09-02 |
| 现有 AI 客服历史数据可导出 | ready | 用户团队 | 用户确认可导出（PRD §0.4） | 无导出 → 基线上线后重新采集 | MVP 前 | G1 全部回填项（落点 REQ-F06-01 基线校准、REQ-F06-03 预警线分母） |
| LLM API 选型与部署（DPA 硬条件） | committed | 内部技术团队 | 上线前完成（PRD §9.14 上线前置，任一未就绪=不满足上线条件） | 无 LLM 退化为检索式 FAQ（价值大减，不作为验收态，PRD §0.4） | MVP | REQ-F01-01、NFR-002 |
| G1 · 历史数据导出+基线分析（咨询分布/解决率/转人工 Top10/退货-咨询交叉/语言分布/月处理量） | committed | 用户团队导出，AI 分析 | ≤5 个工作日；G1–G4 总硬窗口 ≤2 周（PRD §9.10） | 超 2 周 → 拍板 3 自动落保守版 C（写死）；回炉线：A-007 高频三类 <40% 或 A-005 交叉 <30% 回评审团复审；最小字段缺 ≥2 项 → 如实告知双档目标为纯假设后再拍 | MVP 前 | `[PRD 定数 · G1 后回填]` 全部 13 项（PRD §13.2 #1–13/15）；落点 REQ-F06-01、REQ-F06-03、REQ-F03-02 |
| G2 · 现有系统能力盘点（三集成点可插拔/选项 B 对照表/错误态清单） | committed | 内部技术团队 | ≤5 个工作日（PRD §9.10） | 无结构化错误码 → F08 携带上下文降级通用进入，错误码治理工作量另计 | MVP 前 | REQ-F08-02、拍板 1 决策输入 |
| G3 · 人工渠道通路查证（正向摘要写入/反向回复写回+push+会话关联/会话链接承载/人工会话关闭信号） | committed | 用户团队 | ≤3 个工作日（PRD §9.10） | 反向查不到接口 → F03 目标态本期直接降级底线态，不留模糊区；查无关闭信号 → 目标态评分触达与严口径分母按底线态口径处理（降级口径 `[PRD 定数 · G3 后回填]`，建议值=客服末条回复后 24h 无往来自动判关闭） | MVP 前 | REQ-F03-02、REQ-F03-03、REQ-F04-02 |
| G4 · 退货归因数据链路查证（原因码枚举/SN↔订单↔用户映射链） | committed | 用户团队 | ≤5 个工作日（PRD §9.10） | 映射链不存在 → 退货归因降级为"原因码粗分类+月度趋势"，验收承诺同步降级 | MVP 前 | REQ-F06-01（退货归因行） |
| 运营三岗名单（拍板 2：现有人员兼任） | committed | 企业家 | G1–G4 窗口（≤2 周）内后补（PRD §0.5/§9.12） | 名单超窗（写死，R5-B-O1，待企业家追认）：①砍 F05 周消化 SLA 并下调目标；②评测集初版 AI 生成+企业家一次性抽检确认（结论保守解读）；③前置改造收敛为高频 Top1 场景 | MVP | REQ-F05-02、§12.7 关键词清单 owner |
| 容量预警响应预案（业务侧） | committed | 企业家/业务侧 | 灰度开始前到位（PRD §9.13；灰度启动门禁三项之一，R5-B-O4） | 未到位 → 暂缓灰度启动（PRD §6.4） | MVP | REQ-F06-03 |
| 客服 SOP 培训（首条回复引用摘要） | committed | 客服 SOP 岗（拍板 2 名单） | 灰度开始前完成（PRD §6.4/§9.12） | 未完成 → 暂缓灰度启动 | MVP | REQ-F03-01（AC-F03-02 / PRD AC-M-07 运营侧验收） |

> G1–G4 窗口进度看守：时间线 owner 默认=企业家本人，每周核对一次，超期即宣布触发对应写死回退（PRD §9.10，R5-B-O2，待企业家追认）；拍板 3 落定时可移交。

---

## Feature F01 · 智能问答会话（FR-F01 · 必做 🟩 · 引擎线；首屏按钮组属发版线）

### US-F01-01 · 英文提问高频问题，知识库多轮对话解答

- Role: App 用户
- Goal: 用英文直接提问安装/联网/配对/会员问题，几分钟内解决
- Value: 高频问题自助解决时长从人工 1–2 小时降至 ≤10 分钟（假设值）
- Stage: MVP
- Status: active

### US-F01-02 · 没把握时明说不确定并给转人工

- Role: App 用户
- Goal: AI 对事实性问题没把握时明说"不确定"并主动给转人工入口
- Value: 不被编造答案害着白折腾
- Stage: MVP
- Status: active

### US-F01-03 · 愤怒/退款时先安抚、出口置顶

- Role: App 用户
- Goal: 打出退款/愤怒字眼时先被安抚，直接看到置顶转人工与退货政策入口
- Value: 情绪崩溃路径不被技术追问二次激怒（退货率直接来源）
- Stage: MVP
- Status: active

### US-F01-04 · 连续两次答不上直接给大按钮

- Role: App 用户
- Goal: 同一会话连续两次拒答后直接看到转人工大按钮
- Value: 不被消耗第三次耐心
- Stage: MVP
- Status: active

### US-F01-05 · 非英语输入得到兜底说明与转人工

- Role: App 用户
- Goal: 非英语输入收到英文+所用语言模板句说明，照常拿到转人工入口
- Value: 不被无声忽略
- Stage: MVP
- Status: active

### US-F01-06 · 开场即知对面是 AI

- Role: App 用户
- Goal: 会话开场知道对面是 AI 助手
- Value: 对回复能力有正确预期（兼加州 bot 披露合规）
- Stage: MVP
- Status: active

### US-F01-07 · Membership 按钮零打字直达会员问答

- Role: App 用户
- Goal: 点首屏 Membership 按钮直接进入会员问答，跳过打字
- Value: 中老年用户（打字意愿低）零门槛咨询会员问题
- Stage: MVP
- Status: active

### REQ-F01-01 · 对话决策总顺序（步骤 0 语言检测 → 关键词规则 → 意图分类 → 路由）

- Story: US-F01-01
- Related-Stories: US-F01-03、US-F01-05（语义关联；契约 Story 取主故事）
- Anchor: FR-F01（PRD §3.1/§3.2/§5.2 交互逻辑 1）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
- Behavior (EARS):

```text
WHEN 新会话创建 THE SYSTEM SHALL 以 AI 身份披露语作为首条系统消息（文案见 PRD §5.2 文案包），每个新会话（含重激活产生的新会话）均重新出现。
```

### REQ-F01-07 · Membership 预置意图直达

- Story: US-F01-07
- Anchor: FR-F01（PRD §3.5/§5.2 交互逻辑 3）
- Stage: MVP
- Revision: 1
- Status: active
- Behavior (EARS):

```text
WHEN 用户点击首屏 Membership 按钮 THE SYSTEM SHALL 以预置意图直达 F01 知识问答（不走引导流），AI 先出会员主题开场提问（该开场属追问澄清类豁免，不计事实性解答）；用户零打字进入问答，后续提问按知识问答路径应答。
```

### REQ-F01-08 · 输入边界处理

- Story: US-F01-01
- Anchor: FR-F01（PRD §5.2 异常场景/§7.7）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 保证关键可点击元素 ≥44pt；系统字体缩放至最大档不破版、不截断按钮文案；对话流、排障卡片、转人工摘要通过基础 VoiceOver 走查。
```

### AC-F01-01 · Membership 零打字直达会员问答

- PRD 对照 ID: AC-M-04（PRD §10）
- Parent: REQ-F01-07
- Priority: P0
- EARS:

```text
WHEN 用户点首屏 "Membership" 按钮
THE SYSTEM SHALL 零打字进入会员问答上下文（预置意图）：AI 主动给出会员主题开场提问/高频问题引导（文案见 PRD §5.2；该开场属追问澄清类豁免，不计事实性解答），用户后续提问按知识问答路径应答。
```

### AC-F01-02 · 四类高频问题英文回答附来源标注

- PRD 对照 ID: AC-M-05（PRD §10）
- Parent: REQ-F01-02
- Priority: P0
- EARS:

```text
WHEN 用户自由输入英文提问〔安装｜联网｜配对｜会员〕类问题（四类各为一个独立验收场景）
THE SYSTEM SHALL 给出基于知识库的英文回答，知识求解类回答末尾可见简短来源标注（如 "Source: Setup Guide"；可见但轻量，不展开全文引用、不加跳转承诺），且不输出编造步骤（拒答侧由 AC-E-01 约束）。
```

### AC-F01-03 · 知识库外事实性问题明确拒答

- PRD 对照 ID: AC-E-01（PRD §10）
- Parent: REQ-F01-02
- Priority: P0
- EARS:

```text
WHEN 用户问知识库覆盖不到的事实性问题（检索无可靠依据）
THE SYSTEM SHALL 明确承认无法确定答案（常规拒答话术），同屏给出转人工入口，且不输出编造的操作步骤。
```

### AC-F01-04 · 连续第 2 次拒答直接大按钮

- PRD 对照 ID: AC-E-02（PRD §10）
- Parent: REQ-F01-03
- Priority: P0
- EARS:

```text
WHEN 同一会话内连续第 2 次拒答（连续计数重置规则以 PRD §3.3 为准：成功事实性解答清零，豁免类不清零不累加）
THE SYSTEM SHALL 直接呈现极短说明句 + 转人工大按钮，且不出现第 3 次"我没把握"式回复。
```

### AC-F01-05 · 退款/愤怒关键词命中进情绪路径（硬验收）

- PRD 对照 ID: AC-E-03（PRD §10）
- Parent: REQ-F01-04
- Priority: P0
- EARS:

```text
WHEN 用户消息命中退款/愤怒类关键词（如 refund、garbage；判定凭据=关键词清单 v1，唯一落点 PRD §12.7）
THE SYSTEM SHALL 使本条消息不进入拒答判定、不被追问技术细节，回复共情话术（情绪路径开场），且转人工与退货政策两个入口置顶常驻可见（100% 可复现）。
```

### AC-F01-06 · 非英语输入兜底

- PRD 对照 ID: AC-E-04（PRD §10）
- Parent: REQ-F01-05
- Priority: P0
- EARS:

```text
WHEN 用户输入非英语文本（如西班牙语）
THE SYSTEM SHALL 返回英文 + 该语言模板句的说明（当前仅支持英文）并照常提供转人工入口；会话不中断、不忽略该消息。
```

### AC-F01-07 · 敏感/超范围问题专属拒答

- PRD 对照 ID: AC-E-06（PRD §10）
- Parent: REQ-F01-03
- Priority: P0
- EARS:

```text
WHEN 用户问敏感/超范围问题（第③层硬规则命中，范围见 PRD §3）
THE SYSTEM SHALL 拒答并说明能力边界，给出转人工入口，使用第③层专属文案（R5-S3），不使用"找不到答案"语义的常规拒答套。
```

### AC-F01-08 · 无意义输入按追问澄清处理

- PRD 对照 ID: AC-E-12（PRD §10）
- Parent: REQ-F01-08
- Priority: P1
- EARS:

```text
WHEN 用户发送无意义输入（乱码/纯表情）
THE SYSTEM SHALL 按追问澄清路径回应（文案见 PRD §5.2），不计拒答、不触发拒答话术。
```

### AC-F01-09 · 静默 30 分钟结束

- PRD 对照 ID: AC-S-02（PRD §10）
- Parent: REQ-F01-09
- Priority: P0
- EARS:

```text
WHEN 非排障态自由对话静默超过 30 分钟
THE SYSTEM SHALL 按静默结束处理该会话（结束态评分触达遵循 PRD §5/§7 定义），且静默流失不追弹。
```

### AC-F01-10 · 重激活=新会话

- PRD 对照 ID: AC-S-03（PRD §10）
- Parent: REQ-F01-09
- Priority: P0
- EARS:

```text
WHEN 已判结束的会话被用户重新打开并发送新消息
THE SYSTEM SHALL 按新会话处理（口径上计复问），用户侧对话体验连续、无报错。
```

### AC-F01-11 · 响应超时可重试

- PRD 对照 ID: AC-S-04（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN AI 响应超时（超过 8–10 秒，「建议值 · 终稿前确认」）
THE SYSTEM SHALL 出现重试提示，用户可重试或直接转人工；期间有流式/加载指示，无静默空屏。
```

### AC-F01-12 · LLM 不可用降级

- PRD 对照 ID: AC-S-05（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN LLM 服务不可用/限流
THE SYSTEM SHALL 保持客服入口不出死屏：界面降级为直达转人工 + 相关排障文章入口。
```

### AC-F01-13 · 离线打开入口

- PRD 对照 ID: AC-S-06（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN 手机离线时打开客服入口
THE SYSTEM SHALL 显示本地离线提示，恢复网络后可正常进入；无死屏无崩溃。
```

### AC-F01-14 · 流式中断保留已输出内容

- PRD 对照 ID: AC-S-08（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN AI 回复流式输出中网络中断（弱网）
THE SYSTEM SHALL 保留已输出内容并带中断标记，用户可重试；不出现整条消息消失或空屏。
```

### AC-F01-15 · 消息发送失败可单条重发

- PRD 对照 ID: AC-S-09（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN 用户消息发送失败（弱网/瞬断）
THE SYSTEM SHALL 为该条消息展示失败标记并支持单条重发；重发成功后不在会话流中重复出现。
```

### AC-F01-16 · App 现有功能不受影响（不变行为）

- PRD 对照 ID: AC-I-04（PRD §10）
- Parent: REQ-F01-10
- Priority: P0
- EARS:

```text
WHEN 客服模块发生任何故障（LLM 不可用、引擎超时）
THE SYSTEM SHALL 保证 App 其余功能（设备直播、通知等）正常使用不受影响（不变行为，故障期间持续成立）。
```

### AC-F01-17 · 最大字体缩放不破版

- PRD 对照 ID: AC-C-01（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- EARS:

```text
WHEN 用户开启系统最大字体缩放
THE SYSTEM SHALL 保证对话与排障卡片不破版、按钮文字完整可读。
```

### AC-F01-18 · 关键按钮触达区域 ≥44pt

- PRD 对照 ID: AC-C-02（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- EARS:

```text
WHEN 用户在任一关键操作场景（排障推进、转人工确认等）点按关键按钮（Done / It didn't work / 转人工等），含最大字号档
THE SYSTEM SHALL 保证按钮可点、响应正常，触达区域 ≥44pt。
```

### AC-F01-19 · VoiceOver 基础走查

- PRD 对照 ID: AC-C-03（PRD §10）
- Parent: REQ-F01-11
- Priority: P0
- EARS:

```text
WHEN VoiceOver 开启走完主流程（进入入口→提问→转人工）
THE SYSTEM SHALL 保证关键控件可被读出、可操作（基础走查级，及格线不下放）。
```

### AC-F01-20 · 对话决策顺序生效（契约层增补）

- Parent: REQ-F01-01
- Priority: P0
- EARS:

```text
WHEN 用户消息进入会话
THE SYSTEM SHALL 按写死顺序处理：步骤 0 语言检测 → 退款/愤怒关键词规则 → 意图分类 → 路由，且仅知识求解类进入三层拒答判定；非英语消息直接返回兜底模板、关键词命中直接进情绪路径（可分别由 AC-F01-06、AC-F01-05 场景复现，顺序依据 PRD §3.1/§3.2）。
```

### AC-F01-21 · 开场 AI 身份披露（契约层增补）

- Parent: REQ-F01-06
- Priority: P0
- EARS:

```text
WHEN 新会话创建（含重激活产生的新会话）
THE SYSTEM SHALL 以 AI 身份披露语作为首条系统消息（文案见 PRD §5.2 文案包；兼加州 bot 披露合规，PRD §9.14）。
```

---

## Feature F02 · 引导式排障（FR-F02 · 必做 🟩 · 内容引擎线 + 卡片 UI 发版线）

### US-F02-01 · 首屏零打字按钮直达分步引导

- Role: App 用户
- Goal: 面对空白输入框不知道打什么时（中老年为典型），首屏按钮点按直接进入一步一屏分步引导
- Value: 打字意愿低的用户零门槛进入排障
- Stage: MVP
- Status: active

### US-F02-02 · 每步只选 Done / It didn't work，永无死胡同

- Role: App 用户
- Goal: 每一步只需在两个大按钮里选一个，永远不会走进死胡同
- Value: 排障路径必达终点（解决或转人工）
- Stage: MVP
- Status: active

### US-F02-03 · 切出返回自动恢复步骤

- Role: App 用户
- Goal: 切出 App 改路由器设置后返回（24h 内）自动恢复到刚才的排障步骤
- Value: 不用从头再来（弱网/切网是核心用户主路径）
- Stage: MVP
- Status: active

### REQ-F02-01 · 三场景一步一屏引导流

- Story: US-F02-01
- Related-Stories: US-F02-02（语义关联；契约 Story 取主故事）
- Anchor: FR-F02（PRD §5.3 元素表/交互逻辑 1–2/§3.5）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL NOT 在会话中出现读取设备状态/远程诊断类功能承诺或界面（第二阶段边界）；配对类问题上限 = 知识库引导自查 + 收集 SN/上下文转人工（A-003 已确认现状）。
```

### AC-F02-01 · 首屏按钮直达配对引导

- PRD 对照 ID: AC-M-02（PRD §10）
- Parent: REQ-F02-01
- Priority: P0
- EARS:

```text
WHEN 用户在对话首屏不打字，点 "Pairing failed" 按钮
THE SYSTEM SHALL 直接进入配对排障分步引导第一步：一步一屏，卡片主操作仅 "Done" / "It didn't work" 两个大按钮（无 👍/👎），转人工为不与主按钮抢层级的次级入口且每张卡片可达（AC-I-01 的落地件）。
```

### AC-F02-02 · 末步 Done 触发解决确认与评分

- PRD 对照 ID: AC-M-03（PRD §10）
- Parent: REQ-F02-01
- Priority: P0
- EARS:

```text
WHEN 用户在引导步骤点 "Done" 且为最后一步
THE SYSTEM SHALL 给出解决确认，随后出现会话级轻量评分入口。
```

### AC-F02-03 · It didn't work 永不进死胡同

- PRD 对照 ID: AC-E-05（PRD §10）
- Parent: REQ-F02-02
- Priority: P0
- EARS:

```text
WHEN 用户在排障引导中点 "It didn't work"
THE SYSTEM SHALL 进入替代分支或转人工出口，绝不出现"无下一步可点"的死胡同（排障全分支适用）。
```

### AC-F02-04 · 中途切出 2 小时后返回自动恢复

- PRD 对照 ID: AC-S-01（PRD §10）
- Parent: REQ-F02-03
- Priority: P0
- EARS:

```text
WHEN 用户在排障中途切出 App（如去改路由器设置），2 小时后返回
THE SYSTEM SHALL 自动恢复到离开时的排障步骤并接续原会话（24h 内有效），该会话不因 30 分钟静默被判结束。
```

### AC-F02-05 · 24h 窗口过期后新会话

- PRD 对照 ID: AC-S-10（PRD §10）
- Parent: REQ-F02-03
- Priority: P0
- EARS:

```text
WHEN 排障会话 24h 接续窗口过期后用户返回同场景
THE SYSTEM SHALL 将原会话按已结束处理并展示过期提示（文案见 PRD §5.3）；重新进入该场景为新会话、从第一步开始。
```

### AC-F02-06 · 内容更新/灰度切换不打断进行中会话

- PRD 对照 ID: AC-S-11（PRD §10）
- Parent: REQ-F02-05
- Priority: P0
- EARS:

```text
WHEN 排障流程内容更新（知识库改造/回流修订）或灰度开关切换时存在进行中会话
THE SYSTEM SHALL 让进行中会话按其进入时的版本走完、不中途换步骤、不被打断；新会话使用新版本/新分桶。
```

### AC-F02-07 · 不做设备诊断（不变行为）

- PRD 对照 ID: AC-I-02（PRD §10）
- Parent: REQ-F02-06
- Priority: P0
- EARS:

```text
WHEN 用户处于本期任一会话场景
THE SYSTEM SHALL NOT 出现读取设备状态/远程诊断类功能承诺或界面（不变行为，全会话场景持续成立）；配对类问题上限 = 引导自查 + 带 SN 转人工（A-003）。
```

### AC-F02-08 · 排障中自由输入不脱轨（契约层增补）

- Parent: REQ-F02-04
- Priority: P0
- EARS:

```text
WHEN 排障进行中用户自由输入追问澄清类问题
THE SYSTEM SHALL 就地解答后回到当前排障步骤；情绪触发走 F01 情绪路径（出口置顶），无关的新知识求解照常走 §3 决策顺序（含三层拒答）后询问是否继续排障（PRD §5.3 交互逻辑 4）。
```

---

## Feature F03 · 人机衔接（FR-F03 · 必做 🟩 · 引擎线；三件套随 G3 分层）

### US-F03-01 · 转人工零复述（摘要三件套可见可补充）

- Role: App 用户
- Goal: 一键转人工时系统自动带上会话摘要+SN+设备型号，本人可见可补充
- Value: 到了人工那里不用从头复述
- Stage: MVP
- Status: active

### US-F03-02 · 知道去哪等（如实告知渠道与时限）

- Role: App 用户
- Goal: 转人工后界面如实告知回复渠道、预计时长、超时找谁
- Value: 不对着聊天窗干等一个不会来的回复
- Stage: MVP
- Status: active

### REQ-F03-01 · 交接摘要生成与最小数据契约

- Story: US-F03-01
- Anchor: FR-F03（PRD §5.4 交互逻辑 1/§12.3/§3.7-3）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
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
- Status: active
- Behavior (EARS):

```text
IF SN/型号缺失（未绑定设备） THEN THE SYSTEM SHALL 使摘要对应字段显示为空并提示可手动补充；IF 用户绑定多台设备 THEN 让用户选择涉事设备；缺失/多选均不阻塞转接。
```

### REQ-F03-07 · 转人工全程可达（不硬拦截）

- Story: US-F03-01
- Anchor: FR-F03（PRD §10.5 AC-I-01/§0.3 不做边界"硬拦截降转人工率"）
- Stage: MVP
- Revision: 1
- Status: active
- Behavior (EARS):

```text
WHEN 用户在任何会话状态下主动要求转人工
THE SYSTEM SHALL 使转人工流程可达；不存在"必须先走完 N 步排障才许转"的强制门槛。
```

### AC-F03-01 · 转人工摘要可见可补充

- PRD 对照 ID: AC-M-06（PRD §10）
- Parent: REQ-F03-01
- Priority: P0
- EARS:

```text
WHEN 自助未解决，用户点转人工
THE SYSTEM SHALL 展示将发送给客服的摘要（含已试步骤/SN/型号/卡点）供用户编辑补充；确认后显示回复渠道与预计时间（按 G3 层级取对应话术）。
```

### AC-F03-02 · 客服侧零复述

- PRD 对照 ID: AC-M-07（PRD §10）
- Parent: REQ-F03-01
- Priority: P0
- EARS:

```text
WHEN 人工客服（间接角色）收到转人工会话
THE SYSTEM SHALL 使客服可见完整交接信息：会话摘要、已试步骤、SN、设备型号、卡点——无需向用户再要一遍（SOP 首条回复引用摘要属运营验收，PRD §9.12）。
```

### AC-F03-03 · 目标态超时安抚

- PRD 对照 ID: AC-E-07（PRD §10）
- Parent: REQ-F03-03
- Priority: P0
- EARS:

```text
WHEN 转人工后超过承诺时间（含缓冲系数「建议值 1.5 倍 · 终稿前确认」，唯一落点 PRD §5.4）未有人工回复（目标态）
THE SYSTEM SHALL 使用户收到主动安抚消息（含超时联系方式）；不发生"承诺了通知却永远沉默"。
```

### AC-F03-04 · 转接提交失败可重试

- PRD 对照 ID: AC-E-08（PRD §10）
- Parent: REQ-F03-04
- Priority: P0
- EARS:

```text
WHEN 用户确认转人工时提交失败（网络/渠道故障）
THE SYSTEM SHALL 显式失败提示且可重试；连续失败后展示兜底联系方式（客服邮箱），不出死屏、不静默丢弃请求。
```

### AC-F03-05 · 摘要生成失败不阻塞转人工

- PRD 对照 ID: AC-E-09（PRD §10）
- Parent: REQ-F03-04
- Priority: P0
- EARS:

```text
WHEN 转人工摘要自动生成失败
THE SYSTEM SHALL 不阻塞转人工：降级为"会话记录直达客服"+ 用户手填卡点描述（转人工可用性优先于摘要完整性）。
```

### AC-F03-06 · SN 缺失/多设备不阻塞转接

- PRD 对照 ID: AC-E-10（PRD §10）
- Parent: REQ-F03-06
- Priority: P0
- EARS:

```text
WHEN 用户未绑定设备（SN/型号缺失）或绑定多台设备时转人工
THE SYSTEM SHALL 使摘要对应字段显示为空并可手动补充；多设备时可选择涉事设备；缺失/多选均不阻塞转接。
```

### AC-F03-07 · push 权限被拒后的明示

- PRD 对照 ID: AC-S-07（PRD §10）
- Parent: REQ-F03-03
- Priority: P0
- EARS:

```text
WHEN 用户转人工时被请求通知权限并拒绝（目标态）
THE SYSTEM SHALL 明示改为"主动回来查看回复"的指引，不再承诺通知送达。
```

### AC-F03-08 · 不硬拦截转人工（不变行为）

- PRD 对照 ID: AC-I-01（PRD §10）
- Parent: REQ-F03-07
- Priority: P0
- EARS:

```text
WHEN 用户在任何会话状态下主动要求转人工
THE SYSTEM SHALL 使转人工流程均可达；不存在"必须先走完 N 步排障才许转"的强制门槛。
```

### AC-F03-09 · 转人工首响不劣于现状（不变行为）

- PRD 对照 ID: AC-I-03（PRD §10）
- Parent: REQ-F03-02
- Priority: P0
- EARS:

```text
WHEN 转人工请求产生至人工首次回复
THE SYSTEM SHALL 保证时长不劣于上线前人工渠道水平（基线 [PRD 定数 · G1 后回填]）；测量口径随 G3 分层：目标态=「客服首条回复送达」事件自动测量（PRD §4.2）；底线态=人工渠道统计（口径 [PRD 定数 · G3 后回填]）。
```

### AC-F03-10 · 不虚假承诺（不变行为）

- PRD 对照 ID: AC-I-05（PRD §10）
- Parent: REQ-F03-02
- Priority: P0
- EARS:

```text
WHEN 会话处于底线态转人工
THE SYSTEM SHALL NOT 在话术中出现"回复会通知你"字样；界面不出现硬编码固定承诺时长（预计响应时间为滚动实际值或分档展示）；不出现任何无实现载体的用户可见优先接入承诺（R2-裁决 7；不变行为，底线态全程持续成立）。
```

### AC-F03-11 · 已转接等待态输入不丢弃（契约层增补）

- Parent: REQ-F03-05
- Priority: P0
- EARS:

```text
WHEN 会话处于「已转接等待」态且用户继续输入
THE SYSTEM SHALL 不静默丢弃输入：目标态将消息计入同一会话流待客服查看并出现"已交人工"提示；底线态展示"已交人工"提示 + Continue with the AI assistant 按钮；该态豁免 30 分钟静默判定（PRD §5.4/§7.1）。
```

---

## Feature F04 · 会话反馈·两层（FR-F04 · 必做 🟩 · 引擎线）

### US-F04-01 · 消息级 👍/👎 与点踩原因

- Role: App 用户
- Goal: 对 AI 单条回答点 👍/👎，点踩可选原因（不相关/看不懂/试了没用）
- Value: 答错的地方被修正（回流第一数据源）
- Stage: MVP
- Status: active

### US-F04-02 · 会话级轻量评分

- Role: App 用户
- Goal: 结束会话时用一次轻量评分表达是否解决了问题
- Value: 严口径解决率的显式确认信号
- Stage: MVP
- Status: active

### REQ-F04-01 · 消息级反馈

- Story: US-F04-01
- Anchor: FR-F04（PRD §5.5 元素表/交互逻辑 3）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- EARS:

```text
WHEN 用户对 AI 单条回答点 👎
THE SYSTEM SHALL 出现原因选择（不相关/看不懂/试了没用），提交后界面确认收到；用户跳过原因选择时点踩状态仍保持选中；无论是否选原因，该消息均进入回流清单（清单可观察结果见 AC-M-09）。
```

### AC-F04-02 · 底线态转接只问服务体验

- PRD 对照 ID: AC-M-12（PRD §10）
- Parent: REQ-F04-02
- Priority: P0
- EARS:

```text
WHEN 底线态下用户完成转人工转接确认
THE SYSTEM SHALL 仅出现服务体验类反馈入口（文案见 PRD §5.5），不出现"是否解决"提问；该会话的解决维度由行为口径统计（R2-裁决 2）。
```

---

## Feature F05 · 知识库升级与回流闭环（FR-F05 · 应做 🟩 · 无用户界面；回流机制与清单导出进 MVP，不卡 MVP 验收）

### US-F05-01 · 周度待补清单按频次排序

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1 已增补，08-04-2026；owner 依拍板 2 名单；requirements-analysis RA-005 已随之 resolved）
- Goal: 每周拿到按频次排序的待补条目清单（原始问题/命中文档/会话链接；消化工作面=F09 管理台审核队列，导出保留）
- Value: 知道该优先补什么
- Stage: MVP
- Status: active

### REQ-F05-01 · 回流四触发源与周度清单导出

- Story: US-F05-01
- Anchor: FR-F05（PRD §4.4/§5.6；消化工作面=F09 管理台审核队列，08-04-2026）
- Stage: MVP
- Revision: 2（语义变更：消化工作面从导出文件升级为 F09 管理台审核队列，周度导出保留为导出能力）
- Status: active
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
- Status: active
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
- EARS:

```text
WHEN 运营（间接角色）在上线后任一周查看回流清单
THE SYSTEM SHALL 可导出一份按频次排序的待补条目清单，字段含原始问题/命中文档/会话链接/频次。
```

### AC-F05-02 · 知识修订 24h 内生效（契约层增补）

- Parent: REQ-F05-02
- Priority: P1
- EARS:

```text
WHEN 知识条目在 F09 管理台修订并通过发布门禁（revision 2 同步：权威源=管理台，PRD §4.4/§5.10）
THE SYSTEM SHALL 使变更 ≤24h 生效（用户侧可观察：次日同一问题得到新答案）；IF 索引重建失败 THEN 上一版索引继续服务、用户无感知，重建期间服务不中断（PRD §5.6/§7.4）。
```

---

## Feature F06 · 效果度量与预警（FR-F06 · 必做 🟩 · 引擎线，与功能同步验收）

### US-F06-01 · 双口径解决率看板按周可看

- Role: 业务负责人（间接角色；别名：企业家）
- Goal: 上线第一周起按周查看双口径解决率（按入口分层）、拒答率（按层分列）、转人工量与语言分布
- Value: 验证这笔投入是否值得
- Stage: MVP
- Status: active

### US-F06-02 · 容量预警推送

- Role: 业务负责人（间接角色；别名：企业家）
- Goal: 月转人工绝对量达预警线（G1 实测月处理量的 80%）时收到预警推送
- Value: 来得及启动容量应对预案
- Stage: MVP
- Status: active

### REQ-F06-01 · 双口径解决率看板与分层呈报

- Story: US-F06-01
- Anchor: FR-F06（PRD §5.7/§8.1/§8.2）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 按触发层（①检索相关度/②引用忠实/③硬规则）分列展示拒答率周监控，叠加预期区间带；WHEN 超出预期区间（[PRD 定数 · G1 后回填]）THE SYSTEM SHALL 视觉标红（知识库改造未到位信号，且为灰度放量前置条件之一）。
```

### REQ-F06-03 · 容量预警

- Story: US-F06-02
- Anchor: FR-F06（PRD §5.7/§8.2/§7.8/§9.13）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- EARS:

```text
WHEN 业务负责人（间接角色）在灰度第一周查看看板
THE SYSTEM SHALL 使双口径解决率、拒答率（分层）、转人工量、语言分布均有数据、按周可看；解决率按入口来源分层，旧版本无字段流量归「未知」单列。
```

### AC-F06-02 · 拒答率超区间标红（契约层增补）

- Parent: REQ-F06-02
- Priority: P0
- EARS:

```text
WHEN 任一触发层（①检索相关度/②引用忠实/③硬规则）的周拒答率超出预期区间（[PRD 定数 · G1 后回填]）
THE SYSTEM SHALL 在看板对该层视觉标红（知识库改造未到位信号，PRD §7.8/§8.2）。
```

### AC-F06-03 · 容量预警触线推送（契约层增补）

- Parent: REQ-F06-03
- Priority: P0
- EARS:

```text
WHEN 月转人工绝对量达到容量预警线（= G1 实测月处理量 × 80%，分母 [PRD 定数 · G1 后回填]）
THE SYSTEM SHALL 发出预警推送触达企业家（载体「建议值 飞书群机器人推送 · 终稿前确认」）；IF 预警线分母缺失 THEN 降级为绝对量趋势展示并明示"预警线待 G1 回填"，不编造分母（PRD §5.7/§9.13）。
```

### AC-F06-04 · 埋点与功能同步交付（契约层增补）

- Parent: REQ-F06-04
- Priority: P0
- EARS:

```text
WHEN 任一功能进入交付验收
THE SYSTEM SHALL 使 PRD §4.2 对应事件埋点同步可验（公共属性必带；缺埋点的功能不算完成）；IF 客户端埋点上报失败（离线/杀进程） THEN 本地暂存补报，看板对延迟数据标注"数据回补中"，不静默缺数。
```

---

## Feature F07 · 多语言能力预留（FR-F07 · 可做 🟨 · 仅两条零成本约束进 MVP；完整多语言后置）

（PRD §2.4 显式声明 F07 无独立用户故事；触发提前条件 = F06 语言分布实测非英语占比 >15%，A-002。下方 US-F07-01 为契约层增补的架构约束承载故事，非 PRD 新增用户场景）

### US-F07-01 · 渠道无关演进能力（契约层增补）

- Role: 产品负责人
- Goal: 作为产品负责人，需要引擎具备渠道无关演进能力，以便未来零成本扩展渠道
- Value: 文案/prompt 不硬编码语言、知识条目带语言字段，未来扩渠道/扩语言无需改动对话逻辑（来源 PRD §5.8/F07）
- Stage: MVP（约束）
- Status: active

### REQ-F07-01 · 文案与 prompt 模板不硬编码语言

- Story: US-F07-01
- Note: 架构约束（PRD §3.7-4/§5.8 约束一）
- Anchor: FR-F07
- Stage: MVP（约束）；完整多语言后置
- Revision: 1
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使任一用户可见文案与提示模板均从可替换的语言资源加载；可观察结果 = 切换语言资源配置，无需改动对话逻辑本身即可替换全部文案。
```

### REQ-F07-02 · 知识条目带语言字段

- Story: US-F07-01
- Note: 架构约束（PRD §3.7-4/§5.8 约束二/§4.1）
- Anchor: FR-F07
- Stage: MVP（约束）；完整多语言后置
- Revision: 1
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使每条知识条目带语言字段（第一版恒为英文，字段必须存在）；缺失语言标记的条目在知识库校验环节可被发现并报出。
```

### AC-F07-01 · 文案语言可配置切换

- PRD 对照 ID: AC-C-05（PRD §10）
- Parent: REQ-F07-01
- Priority: P1
- EARS:

```text
WHEN 切换用户可见文案与 prompt 模板的语言配置
THE SYSTEM SHALL 不需改动对话逻辑即可生效（语言不硬编码，F07 约束一）。
```

### AC-F07-02 · 知识条目语言字段存在

- PRD 对照 ID: AC-C-06（PRD §10）
- Parent: REQ-F07-02
- Priority: P1
- EARS:

```text
WHEN 校验任一知识条目
THE SYSTEM SHALL 使该条目带语言字段（schema 见 PRD §4.1）。
```

---

## Feature F08 · 入口与场景化触达（FR-F08 · 必做 🟩 · 发版线，移出 2 周灰度承诺）

### US-F08-01 · 错误提示旁一键 Get help 带故障现场

- Role: App 用户
- Goal: 设备掉线/配对失败/扫码失败时，错误提示旁点 "Get help" 进入对话且故障现场已自动带上
- Value: 不用自己描述发生了什么（差评 #6 直接验收素材）
- Stage: MVP
- Status: active

### US-F08-02 · 新用户 3 步内找到固定入口

- Role: App 用户
- Goal: App 内 3 步以内找到固定客服入口
- Value: 不在"迷宫"里找门（"labyrinthian maze" 差评素材）
- Stage: MVP
- Status: active

### REQ-F08-01 · 固定一级入口

- Story: US-F08-02
- Anchor: FR-F08（PRD §5.9 交互逻辑 1）
- Stage: MVP
- Revision: 1
- Status: active
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
- Status: active
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
- Status: active
- Behavior (EARS):

```text
WHILE 旧版本客户端 + 新引擎共存 THE SYSTEM SHALL 保证自由输入问答、三层拒答、转人工（含摘要）、非英语兜底全部可用；按钮组/卡片 UI 缺失时，引擎以纯文本分步引导替代卡片（每条消息一步 + 文字确认），功能降级但路径完整，不硬崩、不出功能黑洞；开场消息附高频问题引导语替代按钮。
发版线覆盖率 SHALL 随 App 版本升级率爬坡、按 app_version 如实呈报，不并入引擎线 2 周承诺；灰度分桶按用户维度，入口文案两版一致，不因界面差异暴露分组。
```

### AC-F08-01 · 错误态入口开场确认

- PRD 对照 ID: AC-M-01（PRD §10）
- Parent: REQ-F08-02
- Priority: P0
- EARS:

```text
WHEN 用户在配对失败错误页点 "Get help"（错误码已结构化，G2 前提满足）
THE SYSTEM SHALL 进入客服对话且首条为携带该故障场景的开场确认消息（含确认与否认两个出口）：确认后直接进入对应排障流第一步，否认则回到首屏按钮组——用户全程无需自己描述"我在配对时失败了"；会话开场可见 AI 身份披露语。（错误码未结构化时的降级行为见 AC-E-11）
```

### AC-F08-02 · 新用户 3 步可达入口

- PRD 对照 ID: AC-M-11（PRD §10）
- Parent: REQ-F08-01
- Priority: P0
- EARS:

```text
WHEN 新用户从 App 首页出发找客服
THE SYSTEM SHALL 使其 3 步以内到达固定客服入口（"步"=从 App 首页起的点击/页面跳转次数，不含滚动查找）。
```

### AC-F08-03 · 错误态无结构化信息时降级通用进入

- PRD 对照 ID: AC-E-11（PRD §10）
- Parent: REQ-F08-02
- Priority: P0
- EARS:

```text
WHEN 用户在错误提示旁点 "Get help" 但该错误态无结构化错误信息（G2 前提不满足）
THE SYSTEM SHALL 降级为通用进入：落首屏按钮组 + 自由输入；"Get help" 入口不消失、点击不无响应。
```

### AC-F08-04 · 旧版本客户端能力保全

- PRD 对照 ID: AC-C-04（PRD §10）
- Parent: REQ-F08-03
- Priority: P0
- EARS:

```text
WHEN 未升级到含 F08 的 App 旧版本用户使用客服
THE SYSTEM SHALL 使其仍可从原有固定入口使用引擎线全部能力（问答/排障内容/转人工）；仅缺错误态入口与新按钮组 UI；卡片 UI 亦缺失时，排障以纯文本分步引导形式提供（每条消息一步 + 文字确认），路径完整不缺分支；覆盖率随升级率如实呈报，不算入引擎灰度承诺。
```

---

## Feature F09 · 知识库管理台（FR-F09 · 应做 🟩 · 引擎线内部 Web 工具；一级导航五区：数据看板/知识库总页面（章节树）/人工录入/AI 录入/审核队列，人工+AI 统一过审；不卡六项及格线验收，同 F05 待遇；08-04-2026 拍板增补，revision 2；第三轮拍板五区重构，revision 4）

### US-F09-01 · 录入/导入条目并确认 AI 整理建议（08-04-2026 第三轮拍板修订：录入过审后才入总页面）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补；拍板 2 名单，2 名）
- Goal: 在管理台录入或导入知识条目（手工表单/飞书一次性迁移/Markdown/CSV 批量导入），并对 AI 切条、问题标签与场景/型号/章节归类建议逐项确认；我录入的条目进入审核队列，人工审核通过后才正式转入知识库总页面（不再直接发布）
- Value: 120+ 篇存量与新增内容快速变成可检索的结构化条目
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: active

### US-F09-02 · 审核队列统一处置人工与 AI 录入条目，无人审不生效（08-04-2026 第三轮拍板修订：统一过审）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 在审核队列看到人工录入与 AI 每日从真实会话抓取聚类起草的条目草稿（含来源会话与频次、标签建议）统一流入，一键通过发布/驳回/改后发布
- Value: 知识安全入库——未经我审核的条目绝不生效
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: active

### US-F09-03 · 确认标签成为检索信号，发布须过评测集回归

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 我确认后的问题标签成为检索信号让用户的各种问法更准命中条目；发布须过评测集回归，回归不过的条目不生效
- Value: 命中率仍以 §8 目标值验收，知识质量有门禁保障
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: active

### US-F09-04 · 数据看板定位该优先修哪条（08-04-2026 第二轮拍板增补；第三轮拍板修订：归属数据看板·知识库数据子看板）

- Role: 知识库内容运营（内部工具侧直接角色，PRD §2.1，08-04-2026 增补）
- Goal: 在管理台数据看板（知识库数据子看板）看到每条知识的使用与解决效果（命中/引用/点踩/条目准确率），知道该优先修哪条
- Value: 知识库供给侧效果可见，修订优先级有数据依据（与 F05 回流联动：标黄条目即修订候选）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Status: active

### REQ-F09-01 · 条目管理（知识库总页面/双编辑器/状态流转/修订历史）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 界面元素表/交互逻辑 1，08-04-2026 第三轮拍板：归属②知识库总页面，章节树导航见 REQ-F09-09）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 提供独立内部 Web 管理台（桌面 1280+ 宽度，界面简体中文，与 F06 看板同体系部署；访问控制「建议值 口令 Basic Auth + 链接不公开 · 终稿前确认」；一级导航五区=数据看板/知识库总页面/人工录入/AI 录入/审核队列）：条目在知识库总页面内按章节组织（章节树见 REQ-F09-09），章节内按更新时间降序，支持全库搜索与按场景/型号/语言/状态/问题标签组合筛选（结果标注所属章节），点条目进入编辑。
WHEN 运营编辑问答型条目 THE SYSTEM SHALL 提供字段对齐 §4.1 schema 的表单（标题/所属章节/场景/型号/语言/正文/问题标签），保存生成修订记录；修订须重新过审（统一过审，REQ-F09-04）。
WHEN 运营编辑排障流程型条目 THE SYSTEM SHALL 提供结构化编辑器（步骤节点 + Done/It didn't work 分支，对齐 §4.1 排障流程 schema），保存时执行无死胡同图遍历校验（PRD §3.6）；校验不过不允许发布并在编辑器内标出问题节点。
状态流转 = 草稿 → 已上线 → 待改造/已下线，未过审核/回归的条目不可流转为「已上线」；每次修订与流转留痕（修订人/时间/变更摘要），历史版本可查。
IF 并发编辑同一条目 THEN 后提交者提交时收到冲突提示（文案定稿见 PRD §5.10），须基于最新版本重做；不静默覆盖，修订历史可回溯。
```

### REQ-F09-02 · 录入与批量导入（统一进审核队列，08-04-2026 第三轮拍板：原「待整理」队列并入审核队列）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 交互逻辑 2/异常场景；§9.2 飞书一次性迁移）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
WHEN 运营通过手工表单提交条目 THE SYSTEM SHALL 将其送入审核队列（来源标注「人工录入」）或存为个人草稿，不直接上线、不直接进入知识库总页面；人工审核通过并过发布门禁后才正式转入知识库总页面对应章节——不存在"人工直接编辑发布入库"路径。
WHEN 运营批量导入文件（Markdown/CSV；飞书 120+ 篇一次性迁移走同一入口；单文件条目上限「建议值 500 条 · 终稿前确认」）THE SYSTEM SHALL 将导入内容一律送入审核队列（来源标注「批量导入」；原「待整理」队列已并入审核队列），并逐条报告导入结果。
IF 批量导入部分失败（格式错误/字段缺失）THEN 成功条目照常进审核队列，失败条目逐条报告行号与原因；不整批静默失败、不静默丢行。
IF 飞书一次性迁移失败 THEN 人工从飞书导出文件经批量导入入库（PRD §9.2 兜底），迁移失败不阻塞管理台其余能力。
管理台为知识库唯一权威源：迁移完成后不做与飞书的双向同步（防口径分叉）。
```

### REQ-F09-03 · AI 自动整理（全部建议态，08-04-2026 第三轮拍板：增章节归类建议、拒绝不阻塞提交进审核队列）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 交互逻辑 3/异常场景）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
WHEN 内容完成录入/导入 THE SYSTEM SHALL 自动生成 AI 整理建议卡（全部建议态）：①切条建议（长文拆为多条目）②问题标签建议（用户问法变体，多值，上限「建议值 每条目 ≤20 个 · 终稿前确认」）③场景/型号归类建议④所属章节归类建议。
WHEN 运营逐项采纳或修改建议 THE SYSTEM SHALL 按采纳/修改后的内容生效；IF 运营拒绝某建议 THEN 该建议不生效，且不阻塞运营人工提交进审核队列（AI 建议为建议态、非门槛；条目后续仍须经审核队列过审后入库，AC-E-13 第三轮语义修订）。
IF AI 整理/起草服务不可用（LLM 故障）THEN 建议卡隐藏并明示 AI 建议暂不可用；手工录入、编辑、审核、发布全部照常可用（AI 能力为增强不是依赖，与 §7.5 降级原则同源）。
```

### REQ-F09-04 · 审核队列统一过审与无人审不生效（人工+AI 统一入口，F05 消化工作面）

- Story: US-F09-02
- Anchor: FR-F09（PRD §5.10 交互逻辑 4/异常场景；§4.4/§5.6 回流管道；08-04-2026 第三轮拍板：统一过审）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使人工录入、批量导入与 AI 录入的条目统一流入同一审核队列（第 ⑤ 导航区），每条带来源标注（人工录入/批量导入/AI 录入）、可按来源筛选；AI 起草草稿（含正文、问题标签建议、来源会话链接或脱敏摘要（§4.5 PII 规则）、聚合频次）按频次降序排列，人工与导入条目按提交时间降序；待审数量可见。
WHEN 运营打开单条待审条目 THE SYSTEM SHALL 提供三操作：通过发布 / 驳回（须填原因，供起草复盘）/ 改后发布；通过并过发布门禁（REQ-F09-05）→ 条目转入知识库总页面对应章节。
无人审不生效（铁律，08-03-2026 拍板确立、08-04-2026 第三轮拍板从"仅 AI 草稿"扩展为全部新条目/修订）：未经审核的条目不进知识库总页面、不进检索库、不被 F01 命中、不出现在任何回答引用中。
IF 审核队列积压 THEN AI 提炼草稿按频次降序保持可操作，周消化 SLA（Top 10）照常按队列数据判定（§5.6）；积压不影响已上线条目正常服务。
```

### REQ-F09-05 · 发布门禁（评测集回归，结果留痕）

- Story: US-F09-03
- Anchor: FR-F09（PRD §5.10 交互逻辑 5/异常场景；§4.3 运行时机）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 2
- Status: active
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
- Status: active
- Behavior (EARS):

```text
WHEN 问题标签经人工确认并随条目发布生效 THE SYSTEM SHALL 将其作为 F01 检索信号（扩充召回 + 过滤），使同一条目命中更多用户问法变体。
命中率仍以 §4.3 评测集验收，§8 目标值不变、不新增指标（闭环验收=AC-F09-01/PRD AC-M-13）。
```

### REQ-F09-07 · 数据看板（知识库数据子看板 + 客服工作数据子看板，零新增埋点；08-04-2026 第三轮拍板改组更名）

- Story: US-F09-04
- Anchor: FR-F09（PRD §5.10 界面元素表/交互逻辑 7/异常场景，08-04-2026 第二轮拍板增补、第三轮拍板由「第 5 导航区效果看板」改组为「第 1 导航区数据看板」双子板；指标口径唯一落点 §8.2「知识条目效果」行）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 在管理台第 1 导航区「数据看板」提供双子板：**知识库数据子看板**（原「效果看板」，内容与口径不变）只读呈现四统计卡——场景覆盖（已上线条目按场景分布 + 覆盖场景数，对照 G1 咨询分布场景集）、使用频率（条目被检索命中次数，周趋势）、引用采纳（条目被实际引用进回答的次数，周趋势；与命中分列——命中未被采纳的差值可见）、知识库准确率（整体条目准确率 + 周趋势）——与条目效果列表（逐条目：命中数/引用数/点踩数/「试了没用」数/条目准确率；默认按条目准确率升序、最差条目浮顶，可切换排序列）；**客服工作数据子看板**=F06 业务看板同源聚合数据在管理台内呈现（图卡构成/口径/异常处理引用 §5.7 与 §8，不复制），同一聚合数据两处呈现、不重复建设，F06 独立看板页保留供业务负责人直达。
指标口径唯一落点 = PRD §8.2「知识条目效果」行（本 REQ 引用不复制）；两子板全部指标由 §4.2 既有埋点事件聚合产出（零新增埋点），与 F06 同源（F06 看会话与业务结果，知识库数据子看板看条目供给侧效果）；数据粒度 = 周。
WHEN 运营点击条目效果列表某行 THE SYSTEM SHALL 跳转该条目详情（既有编辑器与修订历史，不新增编辑入口）。
IF 条目准确率低于标黄线「建议值 60% · 终稿前确认」 THEN 该条目标黄提示优先修订（与 F05 回流联动：标黄条目即修订候选）。
IF 条目引用数低于样本量下限「建议值 10 次 · 终稿前确认」 THEN 不计算条目准确率、准确率位置显示「样本积累中」，命中数/引用数/点踩数照常展示（不显示误导性准确率）。
IF G1 场景集未回填 THEN 场景覆盖卡降级为按 §4.1 现有场景分类展示分布并标注「场景集待 G1 回填」，不编造场景集。
IF 埋点上报延迟 THEN 延迟数据标注「数据回补中」，不静默缺数（与 F06 看板同口径，§5.7；客服工作数据子看板异常处理同 §5.7）。
```

### REQ-F09-08 · 界面语言（100% 简体中文含示例 + 条目语言录入时选择 + 语言资源加载；08-04-2026 第三轮拍板修订）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10「权威源与界面语言」节，08-04-2026 第二轮拍板强化、第三轮拍板扩展至示例内容并修订条目语言口径；管理台全域横切约束，覆盖全部导航区含数据看板）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 使第一版管理台全部界面元素（导航/按钮/标签/提示/占位文案）与界面示例内容 100% 简体中文，不残留英文装饰性文案（品牌词 "COOLFLY" 允许保留）；中文界面文案唯一落点 = PRD §5.10 文案定稿表。
THE SYSTEM SHALL 保持界面语言与内容语言分离：知识条目内容语言由录入时的语言字段选择决定（§4.1 既有字段，第三轮拍板修订：不再限定必须英文；服务 App 英文用户的生产条目为英文）；界面全中文不改变条目内容语言，不违反 F07 约束。
管理台 UI 文案从语言资源加载、不硬编码语言（复用 F07 约束一）；第一版仅提供简体中文资源，后续加语言 = 加资源包、不改界面逻辑（UI 多语言切换为后续增强，仅登记不实现）。
```

### REQ-F09-09 · 知识库总页面章节树（书目录式两级层级 + 章节运营维护；08-04-2026 第三轮拍板增补）

- Story: US-F09-01
- Anchor: FR-F09（PRD §5.10 交互逻辑 1/界面元素表「章节树」「章节管理」/异常场景「删除含条目/子章节的章节」；§4.1「所属章节」信息项）
- Stage: MVP（F09 不卡六项及格线验收，同 F05 待遇）
- Revision: 4
- Status: active
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
- Status: active
- Behavior (EARS):

```text
THE SYSTEM SHALL 按「建议值 每日 · 终稿前确认」节奏抓取客户会话（F05 四触发源回流会话为输入，口径归 §4.4），由 AI 聚类总结归纳并起草条目草稿，草稿进入审核队列（REQ-F09-04 统一过审；此为 AI 提炼节奏的明确化——由「回流触发累积即入队」明确为每日批次抓取）。
THE SYSTEM SHALL 在第 4 导航区「AI 录入」展示当日与近期抓取批次（每批次：抓取时间/来源会话数/生成草稿数/批次状态，按时间降序）；点批次可查看该批生成的草稿（草稿本体在审核队列）。
IF 批次抓取失败或当日无可提炼会话 THEN 批次列表如实标注「失败」或「无新草稿」，不静默缺批次；失败批次次日照常抓取，不阻塞人工录入与审核队列既有条目的操作。
IF AI 起草服务不可用（LLM 故障）THEN AI 录入当日批次标注失败（与 REQ-F09-03 降级原则同源，AI 能力为增强不是依赖）。
```

### AC-F09-01 · 录入→审核→发布→检索命中闭环

- PRD 对照 ID: AC-M-13（PRD §10）
- Parent: REQ-F09-01
- Priority: P1
- EARS:

```text
WHEN 知识库内容运营（内部角色）在 F09 管理台新建（或改后发布）一条知识条目，审核通过且发布门禁评测集回归通过
THE SYSTEM SHALL 使条目状态变为「已上线」、回归结果留痕可查；≤24h 内 App 用户在对话页（F01）就该条目覆盖的问题提问可被检索命中并作为引用来源（来源标注与该条目一致）——录入→审核→发布→检索命中闭环（§5.10）。
```

### AC-F09-02 · 审核队列草稿要素完整、按频次降序

- PRD 对照 ID: AC-M-14（PRD §10）
- Parent: REQ-F09-04
- Priority: P1
- EARS:

```text
WHEN F05 回流触发源会话（拒答/点踩/转人工/复问）累积后，运营查看 F09 管理台审核队列
THE SYSTEM SHALL 在队列中展示 AI 聚类起草的条目草稿，每条含来源会话链接（或脱敏摘要）、聚合频次与问题标签建议，按频次降序排列（§4.4/§5.10）。
```

### AC-F09-03 · 无人审不生效（铁律）

- PRD 对照 ID: AC-M-15（PRD §10）
- Parent: REQ-F09-04
- Priority: P0
- EARS:

```text
WHEN F09 管理台内存在未经审核的草稿/待审核条目（含人工录入与批量导入，08-04-2026 第三轮拍板：统一过审扩展），App 用户提出该条目覆盖的问题
THE SYSTEM SHALL 保证未审核条目不被检索命中、不出现在任何回答引用中；只有审核通过并过发布门禁的条目进入检索库（无人审不生效铁律，08-04-2026 第三轮拍板从"仅 AI 草稿"扩展为全部新条目/修订，§5.10）。
```

### AC-F09-04 · AI 建议可修改可拒绝且不阻塞提交进审核队列（08-04-2026 第三轮拍板语义修订）

- PRD 对照 ID: AC-E-13（PRD §10；第三轮拍板随统一过审语义修订）
- Parent: REQ-F09-03
- Priority: P1
- EARS:

```text
WHEN 知识库内容运营对 AI 给出的切条/问题标签/归类建议逐项修改或拒绝（F09 管理台）
THE SYSTEM SHALL 使修改后按运营修改内容生效、拒绝后该建议不生效，且不阻塞人工提交进审核队列（AI 建议为建议态、非门槛；条目后续仍须经审核队列过审后入库，§5.10）。
```

### AC-F09-05 · 发布回归失败条目回炉、失败用例可见

- PRD 对照 ID: AC-E-14（PRD §10）
- Parent: REQ-F09-05
- Priority: P1
- EARS:

```text
WHEN 运营在 F09 管理台发布条目时评测集回归失败
THE SYSTEM SHALL 使条目不生效（不进检索库、状态回炉），管理台内可见回归失败原因与失败用例；修订后可重新发布（§5.10 发布门禁）。
```

### AC-F09-06 · 批量导入部分失败逐条报告（契约层增补）

- Parent: REQ-F09-02
- Priority: P1
- EARS:

```text
WHEN 批量导入文件中部分条目格式错误或字段缺失
THE SYSTEM SHALL 使成功条目照常进入审核队列（来源标注「批量导入」；原「待整理」队列已并入审核队列，随 REQ-F09-02 revision 4 同步），失败条目逐条报告行号与原因；不整批静默失败、不静默丢行（行为提炼自 PRD §5.10 异常场景，不新增行为）。
```

### AC-F09-07 · 确认标签扩充检索命中（契约层增补）

- Parent: REQ-F09-06
- Priority: P1
- EARS:

```text
WHEN 条目的问题标签经人工确认并随发布生效
THE SYSTEM SHALL 将该标签作为检索信号使对应用户问法变体可命中该条目；验收以 §4.3 评测集为准，§8 目标值不变（行为提炼自 PRD §5.10 交互逻辑 6，不新增行为）。
```

### AC-F09-08 · 数据看板·知识库数据子看板四卡与条目效果列表可见、口径一致（08-04-2026 第三轮拍板改组）

- PRD 对照 ID: AC-M-16（PRD §10；第三轮拍板由「第 5 导航区效果看板」改组归入第 1 导航区「数据看板」，内容不变）
- Parent: REQ-F09-07
- Priority: P1
- EARS:

```text
WHEN 知识库内容运营或业务负责人打开 F09 管理台数据看板 · 知识库数据子看板（第 1 导航区）
THE SYSTEM SHALL 使四卡可见：场景覆盖（已上线条目场景分布+覆盖场景数）/使用频率（检索命中周趋势）/引用采纳（实际引用进回答周趋势，与命中分列——命中未被采纳可见）/知识库准确率（整体+趋势）；条目效果列表可见：逐条目命中数/引用数/点踩数/「试了没用」数/条目准确率，可按准确率升序排列（最差条目浮顶）；全部指标口径与 §8.2「知识条目效果」行一致；同一导航区内另可见客服工作数据看板（F06 同源，§5.7/§5.10）。
```

### AC-F09-09 · 样本量不足不显示误导性准确率

- PRD 对照 ID: AC-E-15（PRD §10；文字随看板更名同步，口径不变）
- Parent: REQ-F09-07
- Priority: P1
- EARS:

```text
WHEN F09 知识库数据看板中某条目引用数低于样本量下限（「建议值 10 次 · 终稿前确认」）
THE SYSTEM SHALL 使该条目不显示准确率数值，准确率位置显示「样本积累中」——不显示误导性准确率；其余指标（命中数/引用数/点踩数/「试了没用」数）照常显示（§5.10）。
```

### AC-F09-10 · 管理台界面 100% 简体中文且不改条目内容语言（契约层增补）

- Parent: REQ-F09-08
- Priority: P1
- EARS:

```text
WHEN 知识库内容运营打开第一版管理台任一视图（含数据看板，五区导航全域）
THE SYSTEM SHALL 使全部界面元素（导航/按钮/标签/提示/占位文案）与界面示例内容以简体中文呈现，无残留英文装饰性文案（品牌词 "COOLFLY" 除外），且知识条目内容语言不因界面语言改变（条目语言=录入时语言字段选择，§4.1；行为提炼自 PRD §5.10「权威源与界面语言」节，随第三轮拍板同步扩展至示例内容，不新增行为）。
```

### AC-F09-11 · 知识库总页面章节树可导航（08-04-2026 第三轮拍板增补）

- PRD 对照 ID: AC-M-17（PRD §10）
- Parent: REQ-F09-09
- Priority: P1
- EARS:

```text
WHEN 知识库内容运营打开 F09 知识库总页面（第 2 导航区）
THE SYSTEM SHALL 使条目按大章节 → 小章节两级书目录式层级组织可导航：章节树可折叠展开、条目挂在小章节下、点击条目进入详情/编辑器；章节可由运营新建/重命名/调整层级；搜索与筛选（场景/型号/语言/状态/标签）在层级结构下保留可用（§5.10/§4.1「所属章节」）。
```

### AC-F09-12 · 人工录入未经审核不入知识库总页面（08-04-2026 第三轮拍板增补）

- PRD 对照 ID: AC-M-18（PRD §10）
- Parent: REQ-F09-02
- Priority: P0
- EARS:

```text
WHEN 运营在 F09 人工录入界面提交一条新条目，尚未经人工审核
THE SYSTEM SHALL 使该条目仅出现在审核队列（来源标注「人工录入」），不出现在知识库总页面、不进检索库；人工审核通过并过发布门禁后才转入知识库总页面对应章节（§5.10 统一过审）。
```

### AC-F09-13 · AI 录入批次展示与失败/空批次如实标注（契约层增补）

- Parent: REQ-F09-10
- Priority: P1
- EARS:

```text
WHEN 系统完成（或未能完成）一次每日会话抓取批次后，运营打开 F09 AI 录入界面（第 4 导航区）
THE SYSTEM SHALL 使批次列表展示每批次的抓取时间/来源会话数/生成草稿数/批次状态（按时间降序），点批次可查看该批草稿（草稿本体在审核队列）；批次失败或当日无可提炼会话时如实标注「失败」或「无新草稿」，不静默缺批次（行为提炼自 PRD §5.10 交互逻辑 4/界面元素表/异常场景，不新增行为）。
```

---

## Non-functional requirements

### NFR-001 · 无障碍基线

- Applies-to: REQ-F01-11（承接验收：AC-C-01/02/03）
- Source: PRD §5.1 通用约定（无障碍 NFR 🟩，全功能适用）
- Revision: 1
- Status: active
- Measure: 关键可点击元素触达区域 ≥44pt；系统字体缩放最大档不破版、按钮文案不截断；对话流/排障卡片/转人工摘要通过基础 VoiceOver 走查（走查范围=进入入口→提问→转人工主流程）。

### NFR-002 · 合规前置（上线条件）

- Applies-to: REQ-F01-01, REQ-F01-06, REQ-F03-03, REQ-F05-01
- Source: PRD §9.14/§4.5
- Revision: 1
- Status: active
- Measure: ①LLM 供应商提供 DPA 且输入不用于训练（选型硬条件）；②会话日志脱敏（打码）后才入分析库，F05 导出清单与评测集题目适用同一脱敏规则，会话回溯载体受权限控制；③留存期限「建议值 脱敏后 12 个月 · 终稿前随合规 NFR 确认」；④隐私政策更新（负责人=用户团队）；⑤开场 AI 身份披露（加州 bot 披露）；⑥push 权限场景化请求。任一未就绪 = 不满足上线条件。

### NFR-003 · 性能预期

- Applies-to: REQ-F01-10
- Source: PRD §5.2 边界数值/§9.9
- Revision: 1
- Status: active
- Measure: 响应超时阈值 8–10 秒「建议值 · 终稿前确认」；首条流式内容出现时间「建议值 ≤3 秒 · 终稿前确认」；监控首内容出现时间 P50/P95、超时触发率、降级触发率；超时提示触发率 >「建议值 5% · 终稿前确认」持续一周即优先于新功能处理；若 LLM 首 token 延迟 P95 接近超时阈值，阈值与流式指示策略终稿前联动校准。

### NFR-004 · 数据治理

- Applies-to: REQ-F06-04, REQ-F02-03
- Source: PRD §4.5
- Revision: 1
- Status: active
- Measure: 时区三口径（界面=设备本地时区；报表=业务时区；窗口计算=UTC 时间差）；会话状态与排障进度强一致（切回 App 必恢复正确步骤）；埋点与看板最终一致（按周呈报）；评测集与回流清单长期保留。

### NFR-005 · 演进约束（架构五条，违反即缺陷）

- Applies-to: REQ-F01-01, REQ-F03-01, REQ-F06-04, REQ-F07-01, REQ-F07-02
- Source: PRD §3.7（debate-log Round 3 裁决 7）
- Revision: 1
- Status: active
- Measure: ①引擎渠道无关化（故障上下文为可选结构化输入；新渠道只写适配层）；②埋点 schema 带 channel 字段（默认 app）；③转人工最小交接契约 6 字段顺序固定不可随实现变动（PRD §12.3）；④F07 两条约束（见 REQ-F07-01/02）；⑤排障流程 schema 与知识条目渠道中立（不含 App 界面专属字段）。验收方式 = schema 与接口审查项；旧客户端纯文本降级（AC-C-04）为渠道中立的验收锚点。

## 评测集与放量门禁（行为契约级约束）

- 离线评测集（golden set）构成：高频问答题 / 陷阱题①应拒答 / 陷阱题②有引用不忠实（含来源标注一致性）/ 陷阱题③豁免滥用 / 陷阱题④怒气样本 / 高频误拒题（PRD §4.3）；规模与配比 `[PRD 定数 · G1 分布后回填]`；题源 = G1 真实咨询 + 差评原话。
- 放量门禁（PRD §6.4，缺一不可）：技术侧两条（评测集命中率 ≥80%（随 G1 校准）、拒答率落在预期区间 `[PRD 定数 · G1 后回填]`）+ 运营就绪三项（容量预案 / SOP 培训 / 名单落实或 R5-B-O1 回退生效）。
- 引擎线灰度 2 周 20%→50%→100% 承诺仅对引擎线有效；发版线覆盖率如实呈报。
- 更换 LLM 供应商须整套评测集回归通过方可切换（评测集即供应商无关的行为契约）。
- 运行时机（revision 2 增补，PRD §4.3）：知识库改造验收、发版前回归（🟩）、**F09 条目发布门禁（🟩，发布动作触发、结果留痕、回归不过条目回炉，REQ-F09-05）**；每次 prompt/模型/知识库变更全量回归为 🟨。

## 假设注册表引用（A-001–A-007，原样引用 assumptions.md）

| ID | 假设 | 风险 | 契约关联 |
| :--- | :--- | :--- | :--- |
| A-001 | 飞书知识库质量足以支撑高频回答（第一命门） | 🟠 | REQ-F01-02、REQ-F05-02、放量门禁 |
| A-002 | 第一版英文单语可接受，多语言能力预留后置 | 🟡 | REQ-F01-05、REQ-F07-01/02、REQ-F06-01（>15% 触发器） |
| A-003 | 配对/绑定类依赖 SN 人工定位，无自助诊断接口（已确认现状） | 🟡 | REQ-F02-06、AC-I-02 |
| A-004 | 解决率目标值（高频 60%/整体 50%，3 个月）为合理假设 | 🟡 | REQ-F06-01、G1 校准 |
| A-005 | 智能客服可贡献退货率降约 3pp | 🟠 | G1 回炉线（交叉 <30%）、REQ-F06-01 退货归因 |
| A-006 | 每台退货损失约客单价 70% | 🟡 | 90 天价值兑现检查点显式校准（owner=退货归因月报岗） |
| A-007 | 高频三类占咨询量 60%+ | 🟡 | G1 回炉线（<40%）；「高频类」口径（PRD §8.1） |

## 统计

- US：24（F01×7、F02×3、F03×2、F04×2、F05×1、F06×2、F07×1、F08×2、F09×4；US-F07-01 为契约层增补的架构约束承载故事，PRD §2.4 仍声明 F07 无用户场景故事；US-F09-01/02/03 为 revision 2 随 PRD §2.4 增补，US-F09-04 为 revision 3 随 PRD 第二轮增补；US-F09-01/02/04 于 revision 4 随第三轮拍板语义修订）
- REQ：47（F01×11、F02×6、F03×7、F04×2、F05×2、F06×4、F07×2、F08×3、F09×10；全部为本契约以 FR-F0x 为锚增补，Stage 均为 MVP，Status 均为 active；REQ-F09-01…06 为 revision 2 增补、REQ-F09-07/08 为 revision 3 增补、REQ-F09-09/10 为 revision 4 增补，REQ-F05-01/02 语义变更 Revision 1→2，REQ-F09-01/02/03/04/07/08 语义变更 Revision→4）
- AC：67（55 条沿用 PRD §10 原语义、启用契约 ID AC-Fxx-yy 并以 PRD 对照 ID 行保留映射：AC-M×18、AC-E×15、AC-S×11、AC-C×6、AC-I×5，其中 AC-F09-01…05 为 revision 2、AC-F09-08/09 为 revision 3、AC-F09-11/12 为 revision 4 随 PRD 增补，AC-F09-03/04/08 于 revision 4 随 PRD 语义修订；另 12 条契约层增补 AC-F01-20/21、AC-F02-08、AC-F03-11、AC-F05-02、AC-F06-02/03/04、AC-F09-06/07、AC-F09-10、AC-F09-13；每条唯一 Parent REQ，47 个 REQ 全覆盖）
- NFR：5（NFR-001–005，本契约按模板编号，来源 PRD §5.1/§9.14/§9.9/§4.5/§3.7）
- 占位同步（revision 4）：新增「建议值 每日 · 终稿前确认」（AI 录入抓取节奏，REQ-F09-10，PRD §5.10/§4.4/§13.2）；既有「建议值」占位（批量导入 500 条上限/标签 ≤20/标黄线 60%/样本量下限 10 次等）原样保留不编数。
- 占位符：`[PRD 定数 · Gx 后回填]` 与「建议值 · 终稿前确认」全部原样保留（清单权威见 PRD §13.2；revision 2 新增 F09 三项建议值：访问控制/单文件 500 条/标签 ≤20 个；revision 3 新增效果看板两项建议值：条目准确率标黄线 60% / 样本量下限 引用 10 次）
