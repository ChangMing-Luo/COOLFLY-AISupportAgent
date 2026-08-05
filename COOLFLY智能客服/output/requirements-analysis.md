# COOLFLY 智能客服 Requirements Correctness Analysis

## Scope

- contract: requirements.md（revision 5，稳定对象 189：US×36 / REQ×56 / AC×92 / NFR×5，其中 active 54 / retired 135；AC 契约 ID AC-Fxx-yy，现役 PRD 对照系列=AC-P-01…25（契约 AC-F09-14…38），原 AC-M·E·S·C·I 全系随 PRD §10.5 retired）
- source_prd: PRD详细版.md（951 行，commit a91bee9 Zendesk 转向大重构：D-10 架构基准——C 端归 Zendesk 生态（Guide/AI bot/Support/Explore），自研范围=知识运营中台十视图五组，功能标准=v3 原型）
- analyzed_at: 2026-08-03T20:01（revision 1 全量）；2026-08-04（revision 2/3/4 F09 三轮增量复核，明细见 git 及下方附注）；2026-08-04（revision 5 全量复核：架构转向 D-10——retire 面结构完整性 + 新增十视图 active 集合六类检查）
- **revision 5 复核要点（active 集合内六类检查，未发现新 P0/P1）**：
  - ①统一过审铁律（REQ-F09-04）与十视图各入口交叉：人工录入/批量导入（REQ-F09-02）、挖掘候选（REQ-F09-14）、反馈回流建议（REQ-F09-17）、drift 拉回（REQ-F09-16）四类入口全部收敛进审核中心（REQ-F09-15），各入口 EARS 均显式声明"无直接入库路径"，无绕过路径冲突。
  - ②翻译阻断（REQ-F09-13）与同步规则（REQ-F09-16）口径一致：英文未「已确认」阻断两处同源 PRD §5.10（唯一落点引用不复制）；中英同发策略为「建议值 · 终稿前确认」占位如实保留，不构成冲突。
  - ③回滚（AC-F09-19）与 drift（AC-F09-28）并发场景：PRD §5.10 异常场景已写死"drift 与本台待发版本冲突→先处置 drift 再放行同步"，REQ-F09-16 已承载，无相互覆盖缺口。
  - ④数据看板（REQ-F09-07）三类如实标注路径（近似归因/样本量下限「样本积累中」/待核实信号不进达标判定）均已写死，无不可验证指标进入达标判定；北极星目标值为显式占位（`[PRD 定数 · Zendesk 基线后回填]`），不算不可验证缺陷。
  - ⑤retired 对象结构完整性：retired REQ 的 Story 指向 retired US、retired AC 的 Parent 指向 retired REQ（史料链闭合）；13 个 active REQ 全部由 active AC 覆盖；active REQ 的 Story 全部指向 active US（US-F09-05…16）。
  - ⑥前置解除无悬挂：G2/G3 标 retired-by-Zendesk 后无任何现役 REQ 依赖二者（表内行仅留档，Requirement IDs 指向 retired REQ 并注明"retired 关联留档"）；G1 用途改为 REQ-F09-14 冷启动语料、G4 保留服务价值账重校准。
- 已知设计（不计 P0/P1）：「建议值 · 终稿前确认」约 22 项与 `[PRD 定数 · Zendesk 基线后回填]` 2 处占位（清单权威 PRD §13.2）；OPEN_QUESTION 3 项（拍板 3 上线时间表重估 / 中台账号体系终确认 / Zendesk 信号可得性，PRD §13.3，兜底规则均已写死）——均如实登记，不构成缺陷。

## 分析方法

按规范六类对 **active 需求集合**检查：①逻辑不一致；②含糊量词；③约束冲突；④未声明假设；⑤缺失边界/失败/并发路径；⑥不可验证指标。revision 5 重点核对项见 Scope「复核要点」——统一过审×四入口、翻译×同步阻断、回滚×drift 并发、指标如实标注、retired 链完整性、前置解除悬挂检查，均未发现逻辑不一致，故第①类无新增 findings。retired 集合（F01–F08 与 F09 五区版旧对象）为契约史料，不再参与正确性检查；其涉及的历史 findings 按 closed-by-pivot 处置（下表）。

## Findings

| ID | Severity | Involved IDs | Category | Failure Mode | Resolution | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| RA-001 | P2 | REQ-F06-01（retired） | 含糊量词 | §5.7 双口径斜杠语义易误读 | 问题对象随 F06 废止（口径本身已 retired，Zendesk Explore 承接客服侧报表） | closed-by-pivot（08-04-2026 D-10） |
| RA-002 | P2 | REQ-F03-02（retired） | 含糊量词 | 预计响应时间分档边界未定义 | 等待承诺随 F03 废止（Zendesk Support 原生承接） | closed-by-pivot |
| RA-003 | P2 | REQ-F01-05（retired） | 含糊量词 | 混合语言判定标准缺失 | 语言检测随自研引擎废止 | closed-by-pivot |
| RA-004 | P2 | AC-F01-06、REQ-F01-05（retired） | 不可验证指标 | 评测集缺非英语样本组 | 评测集机制随 F01 废止（降级为发布门禁代理评测） | closed-by-pivot |
| RA-005 | P2 | US-F05-01（retired）、PRD §2.1 | 未声明假设 | 角色未入矩阵 | 曾于 08-04-2026 随 F09 增补解决；D-10 后「知识库内容运营」再被 RBAC 四角色细分取代（知识管理员/知识审核员），角色矩阵闭合状态延续 | resolved |
| RA-006 | P2 | REQ-F06-04、REQ-F06-01（retired） | 含糊量词 | 语言分布口径未声明 | 自研埋点体系废止 | closed-by-pivot |
| RA-007 | P2 | REQ-F06-03（retired） | 缺失路径 | 容量预警推送自身失败无兜底 | 容量预警随 F06 废止 | closed-by-pivot |
| RA-008 | P2 | REQ-F06-01（retired） | 不可验证指标 | 口径复查触发无量化定义 | 双口径体系废止（换锚 Zendesk 信号矩阵） | closed-by-pivot |
| RA-009 | P2 | AC-F01-05（retired） | 未声明假设 | 关键词清单冻结权威依赖名单 | 关键词清单与拒答线随 F01 废止（PRD §12.3 登记） | closed-by-pivot |
| RA-010 | P2 | NFR-002、PRD 原 §6.4（retired） | 约束冲突 | 灰度门禁清单漏合规项 | 灰度放量机制随 F01–F08 废止；NFR-002 rev5 换锚 §9.7 上线前置（无灰度清单归并问题） | closed-by-pivot |
| RA-011 | P2 | REQ-F04-02（retired） | 缺失路径 | 评分提交是否激活会话未写死 | 会话评分体系随 F04 废止 | closed-by-pivot |
| RA-012 | P2 | 原 R5-B-O1 回退规则（retired） | 备注 | 拍板 2 名单超窗回退待追认 | G 窗口与名单回退机制随 F01–F08 废止；角色到人前置延续拍板 2 兼任安排（RBAC 角色到人行） | closed-by-pivot |
| RA-013 | P2 | 原 R5-B-O2 时间线 owner（retired） | 备注 | G1–G4 窗口 owner 待追认 | G1–G4 硬窗口机制废止（G1/G4 保留但不再有 ≤2 周窗口约束；G2/G3 解除） | closed-by-pivot |
| RA-014 | P2 | REQ-F09-16、REQ-F09-17、Zendesk API 能力行 | 未声明假设 | bot 锚点引用/Knowledge 面板引用/浏览行为等信号可得性未核实（核实清单①③⑤）——落空则条目效果归因失真、挖掘输入变薄 | 缓解已写死：信号分档如实标注、待核实信号核实前不进达标判定（PRD §9.1 ZR-6/§8.3）；必得信号（工单/投票/flag）先行支撑闭环；核实清单回填后复核本条 | open |
| RA-015 | P2 | REQ-F09-16、REQ-F09-02 | 含糊量词 | 初始迁移 120+ 篇批量推送节奏仅有「分批避开限流 · 建议值」定性描述，批大小/间隔未定量，两个实现者节奏可能不同 | 建议终稿前随 Zendesk 档位核实（清单①）定量；失败重试与如实标注路径已写死（§7.2），不阻塞设计 | open |
| RA-016 | ~~P2~~ **已消解（08-05-2026）** | REQ-F09-04、REQ-F09-19 | 约束冲突（边界条件） | ~~四眼原则要求在任审核员 ≥2 人，而系统管理员可禁用用户——若第二审核员被禁用，发布流程死锁~~ → **四眼原则已取消（rev6）**，单审核员即可完成审核发布，该死锁场景不再成立；遗留关注点转为「单审核员场景下发布制衡完全依赖事后审计」，已登记在 requirements 外部依赖行与 PRD §5.10 权限矩阵注 | 组织侧缓解已登记：RBAC 角色到人前置行 Fallback「审核员不足 2 人→发布动作暂缓上线」；建议 PRD 终稿在视图⑩补禁用告警提示（当禁用操作将使某角色在任人数低于下限时提示后果） | open |
| RA-017 | P2 | NFR-002、REQ-F09-14 | 未声明假设 | 脱敏（邮箱/SN/家庭 Wi-Fi 名称打码）的执行位置（拉取时/入库前）与漏打码兜底未定义，PII 有进入中台与 LLM 输入的残余风险 | 建议设计阶段定义脱敏执行点与抽检机制；DPA 且不用于训练已为选型硬条件（选型层兜底） | open |
| RA-018 | P2 | A-004、REQ-F09-07、PRD §8.1 | 不可验证指标（暂时性，已知设计） | 北极星（bot automated resolution rate）目标值为占位——上线初期无达标判定基线，仅趋势呈报 | 已知设计如实登记：口径重校准检查点（「建议值 上线后 60–90 天 · 终稿前确认」）用真实基线回填目标与价值账（§8.3），不构成缺陷 | open（登记） |

## 附注 · 历史增量登记（revision 1–4，原文见 git）

- revision 1–4 的契约层增补 ID 登记与 F09 五区版三轮（rev2 六 REQ / rev3 效果看板+界面语言 / rev4 五区导航+章节树+统一过审）增量复核结论已随 D-10 转向归档：所涉对象除 REQ-F09-02/04/07/08 与 AC-F09-06/10 修订续用外均 retired（承接注记见 requirements.md 各块）。
- revision 5 新增 ID 登记：US-F09-05…16（×12）；REQ-F09-11…19（×9）；AC-F09-14…38（×25，PRD 对照 AC-P-01…25）。契约层增补现役仅 AC-F09-06/AC-F09-10（行为均提炼自 PRD §5.10/§5.1 已写死内容，不新增行为）。

## P0 待处理

无。active 需求集合可同时满足，未发现安全/数据错误类问题；retire 面结构完整（史料链闭合、无悬挂引用）。

## Summary

| Severity | 数量 | 说明 |
| :--- | :--- | :--- |
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 18 | RA-001–004/006–013（12 条）closed-by-pivot（涉及面随 F01–F08 与旧机制废止）；RA-005 resolved；RA-014–017 为转向后新登记改进项（信号可得性/迁移节奏定量/审核员下限死锁提示/脱敏执行点，均不阻塞设计）；RA-018 为已知设计登记（北极星占位待基线回填） |

```text
P0 unresolved: 0
P1 unresolved: 0
```
