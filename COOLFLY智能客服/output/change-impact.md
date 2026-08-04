# change-impact（上游 requirements.md revision 1 → 2 · F09 知识库管理台增量）

- 变更来源：08-04-2026 拍板「新增 F09 知识库管理台（MVP 范围变更）」——管理台=知识库唯一权威源（飞书 120+ 篇一次性导入、不做双向同步）、会话自动提炼（AI 起草+人审发布）进第一版、F09 不卡六项及格线验收（同 F05 待遇）。
- 本文件按《追溯与增量同步规范》产出；截至本次校验，全部受影响行已修复并复核，**无遗留 stale**。矩阵 revision 1 → 2。

## 1. 新增 source ID（16 个，Revision 起始=2，全部 covered）

| 类型 | 新增 ID | 设计落点（矩阵行） |
| :--- | :--- | :--- |
| US ×3 | US-F09-01 / US-F09-02 / US-F09-03 | 经 REQ-F09-01…06 承载（矩阵 §3 US 对照表；US 层不进校验 source 域） |
| REQ ×6 | REQ-F09-01…06 | PAGE-F09-01 + CMP-F09-01…08 + API-F09-01…03 + DATA-F09-01…03 + DEC-009…013（矩阵 §1.1，全部 covered） |
| AC ×7 | AC-F09-01…07（AC-F09-01–05 对照 PRD AC-M-13/14/15、AC-E-13/14；AC-F09-06/07 契约层增补） | 矩阵 §1.2，全部 covered |

新登记设计 ID：CMP-F09-01…08（组件 8）、API-F09-01…03（发布门禁执行链 §6.9／AI 整理与提炼管道 §6.8／飞书一次性迁移导入管道 §6.7）、DATA-F09-01…03（条目扩展与状态机／审核队列草稿实体／发布门禁留痕）、DEC-009…013（页面路由／左侧导航四区／标签管理独立区／空库初始态引导／看板互跳，均 design-derived 并在页面文档内声明）。

## 2. 语义变更的既有 source（6 类，修复后恢复 covered）

| Changed Source | Old→New Revision | Affected Design IDs | Artifacts | Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-F05-01（回流消化工作面：导出文件 → F09 管理台审核队列，导出保留） | 1→2 | DATA-F05-02, API-F05-01, DATA-F06-02, PAGE-F09-01, CMP-F09-06, DATA-F09-02 | 技术方案.md §6.8; 页面清单.md 表 3; pages/阶段1_知识库管理_知识库管理台.md §6.2 流程二 + .html | regenerate + review（已完成） | covered |
| REQ-F05-02（生效链路：飞书修订→导出+定期增量重建 → 管理台发布→发布门禁→索引更新） | 1→2 | API-F05-02, DATA-F05-01, DEC-008, API-F09-01, PAGE-F09-01 | 技术方案.md §6.7/§6.9/§8.3; pages/阶段1_知识库管理_知识库管理台.md §8.3 + .html | regenerate + review（已完成） | covered |
| AC-F05-02（≤24h 生效：权威源=管理台+发布门禁） | 1→2 | API-F05-02, DATA-F05-01, API-F09-01, PAGE-F09-01 | 技术方案.md §6.7/§6.9; pages/阶段1_知识库管理_知识库管理台.md §11.1-F-01 + .html | regenerate + review（已完成） | covered |
| US-F05-01（消化工作面升级，经 REQ 行承载） | 1→2 | 同 REQ-F05-01/02 行 | 矩阵 §3 US 对照表已更新 | review（已完成） | covered |
| requirements「External capability configuration」飞书行（持续导出+定期增量重建 → 一次性迁移导入） | 1→2 | API-F05-02（描述已改）、API-F09-03（新注册迁移管道） | 技术方案.md §6.7（一次性导入管道+文件导入兜底） | regenerate + review（已完成） | covered |
| requirements「Capability prerequisites」飞书行（同上口径改动；管理台=唯一权威源、不做双向同步） | 1→2 | API-F09-03, REQ-F09-02 行 | 技术方案.md §6.7; pages/阶段1_知识库管理_知识库管理台.md §2.4/§8.3 | regenerate + review（已完成） | covered |

另：矩阵 §2 planned 段「PAGE-F05-01 AI 生成型知识库审核台」行改为「知识库多渠道采集扩展（应用商店评分/客服邮件）」——审核台范围已随 F09 提前进 MVP（指向 REQ-F09-04/05 covered 行），PAGE ID 不重编号，仍 planned。

## 3. 受影响设计产物（均已重生/同步，无遗留 stale）

| 产物 | 本次动作 |
| :--- | :--- |
| 设计决策蓝图.md | §4 增补第 5 份 MVP 施工图（知识库管理台）与 planned 项改名，已同步 |
| 页面清单.md（rev2） | 新增 MVP 行 PAGE-F09-01；PAGE-F05-01 planned 行改名收缩；表 3 F05 行工作面改为管理台审核队列；覆盖自检更新 |
| pages/阶段1_知识库管理_知识库管理台.md（505 行）+ 同名 .html（1389 行，`meta[name="page-id"]=PAGE-F09-01`） | 新建施工图（11 节全量，DEC-009…013 文档内声明） |
| 技术方案.md（v1.1，483 行） | 新增 §6.8 AI 整理与提炼管道、§6.9 发布门禁；§6.7 权威源切换重写；§5.1 核心表域 F09 增量字段 |
| 设计追溯矩阵.md（revision 2） | 增补 REQ-F09×6 / AC-F09×7 行与 US-F09×3 对照；REQ-F05-01/02、AC-F05-02、US-F05-01 行落点更新并标 revision 2；§0 注册表续编 CMP/API/DATA/DEC；planned 段改行；自检更新 |
| PRD 衍生 summary（PRD-summary.md）/ dev（PRD-dev.md）/ ppt | 已随 PRD F09 增量重生同步（上游 PRD 1520 行 commit ec461aa） |

## 4. 未受影响声明

- 四份既有 MVP 施工图**零改动**：pages/阶段1_客服对话_客服对话页.md+.html、pages/阶段1_人机衔接_转人工确认面板.md+.html、pages/阶段1_效果度量_内部效果看板页.md+.html、pages/阶段1_入口触达_宿主App集成点规格.md+.html。
- DESIGN.md 与 tokens.css **零改动**（管理台 HTML 复用既有 tokens 体系，无新增设计变量）。
- 既有设计 ID 语义均保持：仅 API-F05-02 注册表描述随 §6.7 更新（同一落点、能力口径修订），其余 CMP/API/DATA/SEQ/DEC-001…008 原状；已确认视觉决策不回退。
- 其余 96 条既有 source 行除上述 6 类语义变更外均未触碰，revision 保持 1。
