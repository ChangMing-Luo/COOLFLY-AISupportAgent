# COOLFLY 知识运营中台 · v4 规格（唯一真相）

> 基线：`doc/v4/COOLFLY 知识运营中台 (offline).html`，解包规格见 `doc/v4/spec/`（`prototype.template.html` 891 行 / `prototype.logic.js` 864 行 / `tokens.css` 273 行）。
> 本文件是 PRD + 设计 + API + 验收的合一规格。**代码跟随本文件，本文件跟随原型**。任何与原型冲突之处以原型为准并回写本文件。
> 版本：v4.0 · 08-06-2026

---

## 1. 产品定位与边界

| 项 | 内容 |
|---|---|
| 系统 | 知识运营中台（知识的生产、审核、发布、同步、反馈闭环） |
| 运行时 | Zendesk 承载对客问答与工单；本中台**不做**对话运行时 |
| 写入方向 | 中台 → Zendesk：**英文版本**写入 Help Center（article，`locale=en-us`，中文正文不外发）；分类/场景写入 Category/Section（用英文名） |
| 读取方向 | Zendesk → 中台：客诉会话（反馈回流）、未命中提问、文章投票 |
| 语言模型 | 中文录入 → 大模型翻译英文 → 人工二次编辑 → 同步 |
| 角色 | 2 个：`super` 超级管理员 / `ops` 知识运营（审核权限单独授予） |

### 1.1 十大模块 · 22 条路由（`prototype.logic.js:321-332`）

| 序 | 模块 | 路由 | 视图类型 |
|---|---|---|---|
| 01 | 工作台 | `dash` | 定制（dash） |
| 02 | 知识采集 | `collect.extract` AI 抽取工作台 · `collect.trash` 垃圾箱 | 定制（extract）+ 列表 |
| 03 | 知识编辑 | `author.drafts` 我的草稿 · `author.mine` 我提交的 · `author.import` 一键导入 · `author.editor`(隐藏) | 列表 ×2 + 定制（editor / importer） |
| 04 | 审核中心 | `review.queue` 待我审核 · `review.log` 审核记录 · `review.detail`(隐藏) | 列表 ×2 + 定制（reviewPage） |
| 05 | 知识库 | `kb.list` 全部知识 · `kb.offline` 已下线 · `kb.detail`(隐藏) | 列表 ×2 + 定制（detail） |
| 06 | 发布与同步 | `publish.channels` Zendesk 同步 · `publish.logs` 同步日志 | 列表 ×2 |
| 07 | 反馈回流 | `feedback.list` 用户反馈 · `feedback.miss` 未命中问题 | 列表 ×2 |
| 08 | 元数据中心 | `meta.tree` 知识分类 · `meta.scenes` 问题场景 · `meta.tags` 知识标签 | 列表 ×3 |
| 09 | 数据分析 | `analytics.health` 知识健康度 | 定制（health） |
| 10 | 系统管理 | `admin.users` 用户与角色 · `admin.perms` 权限矩阵 · `admin.audit` 操作审计 | 列表 ×3 |

**403 规则**：`route` 以 `admin` 开头且角色 ≠ `super` → 渲染 403 页（模板 88-98），不渲染任何数据。
**骨架屏**：切路由 380ms（`go()`），期间只渲染骨架（模板 100-114）。

---

## 2. 数据模型

### 2.1 元数据三层

| 对象 | 说明 | 对应 Zendesk | 双语 | 上下架 |
|---|---|---|---|---|
| 一级分类 `category` | 6 条，如「机票 · 售后」 | Category | 中英，英文可 AI 翻译 + 人工编辑 | 是 |
| 二级场景 `scene` | 10 条，挂在分类下，如「改签退票」 | Section | 中英 | 是 |
| 知识标签 `tag` | 本地检索/推荐用，**不翻译** | 无 | 仅中文 + 类型 | 是（可合并） |

标签类型枚举：`业务 / 属性 / 动作 / 人群`。

原型基线目录（`prototype.logic.js:1-14`）：

```
机票 · 售后 (Air Ticket · After-sales)        → 改签退票 Rebooking & Refund / 退款处理 Refund Processing
机票 · 出行前 (Air Ticket · Pre-trip)         → 值机登机 Check-in & Boarding / 行李服务 Baggage Service / 特殊旅客 Special Passengers
机票 · 异常处理 (Air Ticket · Irregularity)   → 航班异常 Flight Irregularity
会员 · 权益 (Membership · Benefits)           → 会员权益 Membership Benefits
酒店 · 订单 (Hotel · Orders)                  → 酒店订单 Hotel Order
支付 · 财务 (Payment · Billing)               → 支付与发票 Payment & Invoice
```

### 2.2 知识条目 `entry`

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | text | 展示 ID，如 `KB-20418` |
| `title_zh` / `title_en` | text | 中文标题必填；英文标题由翻译产出，可编辑 |
| `body_zh` / `body_en` | text(HTML) | 富文本；英文同步用 |
| `category_id` / `scene_id` | fk | 场景必填才可提交审核 |
| `tags` | text[] | 本地标签 |
| `status` | enum6 | 见 2.3 |
| `version` | text | `vX.Y` |
| `sync_status` | enum4 | `none / pending / synced / failed` |
| `owner_id` | fk users | 负责人 = 最后动作人 |
| `translated` | bool | 是否已生成英文 |
| `en_edited` | bool | 英文是否经人工二次编辑 |
| `pending_kind` | enum | `null` 普通提交 / `rollback` 回滚待审 |
| `pending_version` | text | 回滚目标版本 |
| `reject_reason` | text | 最近一次驳回意见 |
| `source` | text | `人工撰写 / AI 抽取 · CT-xxxx / EX-xx / 未命中 MS-xxx` |
| `note` | text | 变更说明（写入版本历史） |
| `confidence` | numeric | AI 置信度 0-1 |
| `quality` | int | 健康度 0-100 |

### 2.3 条目状态机（六态，`prototype.logic.js:21-25`）

| 态 | 标签 | tag 类 | 人话 |
|---|---|---|---|
| `draft` | 草稿 | tag-neutral | 草稿 · 编辑中，尚未提交审核 |
| `pending` | 待审核 | tag-outline | 待审核 · 已提交，排队等待审核 |
| `rejected` | 已驳回 | tag-neutral | 已驳回 · 审核未通过，退回修改 |
| `published` | 已发布 | tag-accent | 已发布 · 线上生效，已同步 Zendesk |
| `fixing` | 修复中 | tag-accent-2 | 修复中 · 正在根据反馈修订 |
| `offline` | 已下线 | tag-neutral | 已下线 · 已撤回，不再对客展示 |

合法流转：

```
draft ──提交审核──▶ pending ──通过──▶ published ──创建修订──▶ draft(小版本+1)
  ▲                    │                  │
  └────驳回(带意见)─────┘                  ├──下线──▶ offline ──恢复──▶ draft
                                          │
                    rejected ──编辑/提交──┘（rejected 与 draft 同权，均可编辑并再提交）

published ──回滚提交──▶ pending(pending_kind=rollback) ──通过──▶ published(版本=目标版本)
反馈「去修复」：published/任意 ──▶ **fixing**（小版本 +1，线上仍为上一版本）；反馈同时置 fixing
```

> `fixing` 与 `draft` 的区别是来源：`fixing` = 被客诉驱动的修订，`draft` = 自发新建或修订。
> 若「去修复」写成 `draft`，`fixing` 在真实系统里将永远不可达（六态少一态）。

版本号规则（`bump`）：审核通过发布 = **大版本 +1**（`v3.2 → v4.0`）；创建修订 / 反馈转修复 = **小版本 +1**（`v3.2 → v3.3`）。

### 2.4 同步状态（四态）

| 态 | 列表文案 | tag 类 |
|---|---|---|
| `none` | 未同步 | tag-neutral |
| `pending` | 同步中 | tag-accent-2 |
| `synced` | 已同步 | tag-accent |
| `failed` | 同步失败 | tag-neutral |

### 2.5 其余对象

| 对象 | 关键字段 | 状态 |
|---|---|---|
| 版本 `entry_version` | `version / at / by / act(发布,回滚,创建) / note / adopt / hits` | — |
| 采集任务 `collect_task` | `code(CT-xxxx) / title / source / owner / at / candidate_count` | `ready/running/done/failed` |
| 抽取候选 `extract_candidate` | `code(EX-xx) / title / answer / scene / tags / confidence / dup*` | `pending/accepted/dropped` |
| 用户反馈 `feedback` | `code(FB-xxxx) / entry_code / type / text / conversation(ZD-xxxxx) / at` | `open/fixing/closed` |
| 未命中问题 `miss` | `code(MS-xxx) / question / scene / count_7d / hit_rate / ai_summary` | `open/planned` |
| 审计 `audit_log` | `at / actor / action / object` | append-only |
| 同步记录 `sync_log` | `entry / target(Help Center) / result / at / duration_ms / payload_no` | `success/failed` |

反馈类型枚举：`差评 / 信息有误 / 无法解决`。

---

## 3. 页面规格（逐视图，对应模板行区间）

### 3.0 全局壳

| 区 | 规格 |
|---|---|
| 根容器 | `width:1440px; min-height:960px`，密度变量 `--rp/--mp/--fs` |
| 左侧栏 | 236px，`--color-neutral-100` 底；品牌「COOLFLY / 知识运营中台」；10 组编号导航（`01`…`10`，激活组展开二级）；`review`/`feedback` 组带徽标计数；底部「知识总量 / 今日发布」 |
| 顶栏 | 全局搜索（占位「搜索知识、场景、分类或知识 ID…」，命中下拉 ≤6 条，无命中提示引导登记未命中）；右侧「待办 N」按钮；当前用户名 + 角色 + 「切换」 |
| 主区 | `padding: var(--mp) 28px 60px` |
| Toast | 右下固定，392px，左侧 2px accent 竖条，9 秒自动消失，可带「下一步」跳转按钮 |
| 抽屉 | 右侧 640px，五形态：审核 / 元数据编辑 / 未命中处理流程 / 记录详情 / 用户新增与编辑 |
| 弹窗 | 440px：回滚确认、下线确认、切换账号、合并标签 |
| 进度模态 | 520px。长操作（从 Zendesk 拉取、立即抽取、保存并提交、一键导入）逐步点亮步骤，失败即停并显示原因——避免点了按钮没反应、页面像卡死 |

### 3.1 工作台 `dash`（模板 116-207）

- 头部：kicker「工作台 · 2026 年 8 月 5 日 星期三」+ h1 问候（`早上好，{姓名}`）+ 「查看抽取候选」「撰写新知识」
- 5 KPI 一行（等宽，右边框）：待我审核 / 我的草稿 / 待处理反馈 / Zendesk 同步失败 / 未命中问题
- 左栏：我的待办（审核 ≤2 + 反馈 ≤2 + 被驳回 ≤1，每行 step 标签 + 标题 + meta + tag + CTA）；空态「待办已清空」
- 左栏下：知识生命周期 6 段（采集/草稿/待审/已发布/同步/反馈），点击跳对应路由，计数为 0 时数字置灰
- 右栏：Zendesk 连接卡（实例 / 上次拉取 / 待同步知识 / 同步失败 + 「从 Zendesk 拉取客诉」按钮）；最近动态（审计前 6 条）

### 3.2 通用列表页（模板 209-273）

12 个路由共用。结构：kicker + h2 标题 + 描述（≤640px）+ 右侧操作按钮组 → `hr` → 筛选 seg + 右侧计数「N 条记录」→ 6 列表格 → 空态。

列宽固定：`34% / 13% / 11% / 15% / 11%(右对齐) / 16%(操作，右对齐)`。第 1 列为可点标题 + 灰色副行；第 3 列为 tag（未命中页的「待处理」为**可点 tag**）；操作列为 `btn-ghost` 小按钮。

各路由配置（列头 / 筛选 / 行内操作 / 空态）见 `prototype.logic.js:398-511`，实现须逐条对齐。

### 3.3 AI 抽取工作台 `collect.extract`（模板 275-344）

左（1fr）：候选卡列表——`EX-xx` + 置信度状态 tag（>80% 高置信 / >60% 需复核 / 否则低置信）+ 标题 + 答案 + 场景 tag + 标签 tag；右上角置信度大字 + 2px 进度条；查重命中时插入 accent 提示条（可点跳转重复条目）；底部「丢弃」「生成草稿」。空态「候选已全部处理」。
右（400px）：来源原文卡（Zendesk 会话原文，最高 300px 可滚）+ 抽取配置卡（来源 / 抽取模型 / 置信度阈值 / 查重相似度）。

顶部固定文案：任务标题「定时抽取 · 近 7 日 Zendesk 客诉聚类」，meta「后台定时任务 · 每日 07:00 自动运行 · 来源 Zendesk 客服会话 · 最近运行 …」，计数行「N 条待确认，人工确认后才会生成草稿（抽取由后台定时任务完成，无需手动创建）」。

### 3.3.0 AI 抽取工作台的聚合模型（08-06-2026 用户要求重构）

| 能力 | 口径 |
|---|---|
| 聚合 | 同一问题场景的多条会话由模型**合并为一条候选**（50 条配网失败 = 1 条），不按措辞拆开 |
| 数据支撑 | 每条候选显示「关联会话 N」，点「查看会话 →」在抽屉里逐条看 Zendesk 原文（`candidate_sources` 表）；模型没给命中编号时按字面相似度兜底挂载，会话数以实际挂上的条数为准 |
| 排序 | 会话数 / 最近 / 情绪 / 置信度 × 正倒序。情绪由模型判定 `negative·neutral·positive`，负面优先 |
| 建议 | 起草时同时给**一级分类与二级场景建议**；能映射到库内对象就直接挂上，映射不上保留建议原文并标「库内暂无」，由人工在编辑器里选 |
| 抽象摘要 | 模型产出 `summary`：这条问题「在描述什么、解决哪方面」，与措辞无关。**它是去重与自动丢弃的唯一依据** |
| 去重 | 新候选的摘要与已有候选摘要相似度 ≥ 0.55 即跳过，不再重复产出 |
| 垃圾箱 | 丢弃的候选进 `collect.trash`，可查看会话、可恢复。其摘要成为**自动丢弃指纹**：下次抽到同类问题直接进垃圾箱并标「自动丢弃」；恢复后指纹立即失效 |
| 清空 | 「清空工作台」把待确认移入垃圾箱（保留指纹）；「彻底清空」物理删除候选与空任务（不再作为指纹） |
| 容错 | 单条草稿正文生成失败不拖垮整批，退回主题概括并在任务提示里说明 |

### 3.3.1 一键导入 `author.import`（原型未覆盖，用户 08-06 追加需求）

上传文档或表格 → 大模型理解整理 → 逐条预览可改 → 批量建**草稿**（不绕过审核）。

| 环节 | 口径 |
|---|---|
| 支持格式 | `.md` `.txt`（按 `#/##/###` 切条）、`.csv` `.tsv` `.xlsx`（按行切条，自动识别「标题·正文」或「问题·答案」列）、`.docx`（按标题层级切条）；单文件 ≤ 20 MB |
| 文件去向 | **只在服务端内存里解析，不落盘、不进数据库**，解析完即释放；入库的只有确认后的知识条目正文 |
| 性能 | AI 整理并发 6、单次上限 `IMPORT_AI_MAX_ITEMS`（默认 60）条，超出部分按字面匹配并在页头如实说明——串行逐条调模型会把几十行的表格拖成几分钟 |
| 取消 | 上传/解析过程中可点「取消上传」（AbortController 断请求），进度模态即刻标失败，文件不入库 |
| AI 整理 | 逐条调 `suggestOrganize`，产出标题、匹配一级分类与二级场景、建议标签，并给出匹配理由 |
| 降级 | LLM 不可用时退回字面相似度匹配，且在每行标「字面匹配」、在页头如实写「AI 整理未生效」 |
| 落库 | 一律 `draft`，`source = 一键导入 · <文件名>`；仍须翻译 → 提交 → 审核 → 发布 |

### 3.4 编辑器 `author.editor`（模板 346-485）

- 面包屑「← 返回 / 知识编辑 / {标题}」
- 头部：状态 tag + `{id} · {ver}` + 翻译状态 chip + 保存状态提示；h2「编辑知识」；右侧**两个按钮**「保存草稿」「保存草稿并提交审核」
- 校验失败横幅：列出未通过项（未选场景 / 标题为空或默认 / 未翻译）
- **新建态不落库**：从「撰写新知识」进来时 `sel = null`，首次保存才创建条目并生成知识编号
- **本地备份**：改动后 800ms 存 localStorage（键 `coolfly.kb.draft.<code|__new__>`），刷新或误退后回到该条目会提示「恢复备份 / 丢弃」；离开前浏览器二次确认
- 左栏：中文标题 → 中文富文本 → **翻译分隔条**（左说明 + 右「翻译为英文 / 重新翻译」按钮）→ 英文标题 + 英文富文本（未翻译时显示虚线占位块）→ 变更说明输入
- **富文本 = TipTap**（`@tiptap/react` + StarterKit + Image / Link / Youtube / Table）。工具条：加粗 / 斜体 / 删除线 / H2 / H3 / 正文 / 项目符号 / 编号列表 / 引用 / 代码块 / 分隔线 / 链接 / 图片 / 视频 / 表格。原 `contenteditable + execCommand` 只能加粗与小标题，承载不了图片视频表格
- 标签：已选可点删除；建议来自**真实标签库**（`/meta/tags`），输入回车即新增；库为空时如实说明
- 右栏（372px）：目录归属卡（一级分类 select + `EN · xxx`、二级场景 select + `EN · xxx` + 未选错误提示、标签区：已选 tag 可点删除 + 建议 tag 可点添加）；翻译控制台卡（翻译引擎 / 中文→英文状态 / 英文人工修订 有·无 / Zendesk 同步语言 English）；AI 编辑助手卡（建议列表，采纳 / 忽略）

### 3.5 知识详情 `kb.detail`（模板 487-631）

- 面包屑「← 返回 / 知识库 / {分类} / {场景}」
- 头部：状态 tag + `{id} · 当前 {ver} · 负责人 {owner}` + 「中 / EN 双语」tag；h2 中文标题；斜体英文标题；「状态：{人话说明}」
- 头部操作按状态：`published` → 下线 + 创建修订；`draft/rejected/fixing` → 编辑 + 提交审核；`pending` → 前往审核；`offline` → 恢复为草稿
- 4 页签：内容（中/EN 切换 + 段落）｜版本与质量（质量告警条 + 版本列表：版本号/说明/作者时间动作/采纳率条/采纳数/命中数/当前 or 回滚按钮）｜Zendesk 同步（同步卡 + 失败原因条 + 消息记录）｜反馈（列表 + 空态）
- 右栏：元数据卡（知识 ID / 一级分类中英 / 二级场景中英 / 标签 / 来源 / 累计命中 / 最近更新）；知识健康度卡（大字分数 + 评语 + 命中率/采纳率两条）

**质量告警判定**：`status=published` 且 存在历史版本采纳率比当前版本高 ≥15pp → 显示告警并给「回滚至 {最佳版本}」。

### 3.6 全页审核 `review.detail`（模板 633-688）

左：内容对比（行号槽 + 三色 diff：same 透明 / del 中性底灰字 / add accent 底），审核意见 textarea + 4 条快捷驳回语。
右：AI 审核预检卡（5 项，✓/! 标记）+ 提交信息卡（知识 ID / 提交人 / 目标版本 / 二级场景 / 同步目标 / 来源）。
头部：「审核 · {id}」+ 标题 + meta（提交人·时间·场景·英文版本状态或回滚类型·AI 置信度）+ 「驳回」「通过并发布」。

抽屉形态（`reviewMode=drawer`，默认）内容同上，紧凑排版（模板 757-782）。

### 3.7 知识健康度 `analytics.health`（模板 690-739）

3 KPI（平均健康度 / 平均采纳率 / 场景覆盖率）→ 知识状态分布 5 段 → 左「场景覆盖率」条形列表（全部二级场景）+ 右「待修复知识」（分数 + 标题 + 原因 + 「建修订」）。

**待修复判定**：非 offline 且（`published` 且采纳率 <45%）或 置信度 <0.72，按置信度升序。

### 3.8 抽屉四形态（模板 744-851）

| 形态 | 触发 | 内容 | 底部动作 |
|---|---|---|---|
| 审核 | 待审列表「审核」/ 工作台待办 | AI 预检 + diff + 意见 + 快捷语 | 驳回 / 通过并发布 |
| 元数据 | 分类/场景/标签「编辑」「新增」 | 中文名 + 上级（场景）/ 类型（标签）+ 英文翻译区（标签无） | 取消 / 保存 |
| 未命中 | 未命中行「待处理」tag / 「流程」 | 问题条 + 三项指标 + AI 摘要 + 5 步流程（当前步高亮） | 关闭 / 新建条目 |
| 记录详情 | 审核记录/同步日志/审计/用户/权限「查看」 | 键值行 + 说明段 | 关闭 |

### 3.9 弹窗两形态（模板 853-870）

- **回滚**：标题「回滚至 {v}」，正文说明历史采纳率 + 需过审，警示条，确认「提交回滚审核」
- **下线**：标题「下线知识」，正文说明从 Zendesk 撤回、版本与反馈保留，警示条，确认「确认下线」

---

## 4. 核心业务流（数据闭环）

```
① 采集   后台定时任务拉 Zendesk 会话 → LLM 抽取候选（含查重）→ 人工「生成草稿」
② 编辑   补全中文正文 → 选一级分类 + 二级场景（必填）→ 加标签 → LLM 翻译英文 → 人工二次编辑
③ 审核   提交（三项校验）→ 待审队列 → AI 预检 → 通过（大版本+1）或驳回（必填意见，回提交人）
④ 发布   通过即发布 → 立即写 Zendesk（英文 article）→ sync: pending → synced/failed
⑤ 反馈   从 Zendesk 拉客诉 → 反馈回流 → 「去修复」生成小版本草稿（线上不变）→ 回到 ②
⑥ 未命中 召回为空/低置信提问聚类 → AI 摘要 → 「新建条目」→ 回到 ②，未命中置「已排期」
⑦ 回滚   版本页/质量告警发起 → 提交回滚审核 → pending(rollback) → 审核通过才生效 → 重新同步
⑧ 下线   published → 二次确认 → offline + Zendesk 归档；已下线页可「恢复」为草稿
```

**闭环硬约束**

1. 未选二级场景 **或** 未翻译英文 → 不得进入 `pending`（提交时报错并打开编辑器）。
2. 驳回必须填意见，意见回写条目并进审核记录。
3. 回滚不得直接生效，必须过审。
4. 发布是同步队列的唯一写入源；每次写入留同步日志（报文号、耗时、结果）。
5. 所有写操作进审计（append-only，数据库规则禁 UPDATE/DELETE）。

---

## 5. API 契约

统一前缀 `/api`，会话 Cookie `kb_session`，错误体 `{error, message}`。

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/auth/login` | — | 邮箱 + 密码 → 会话 |
| POST | `/auth/logout` | 登录 | 注销 |
| POST | `/auth/switch` | 登录 | 切换账号（验目标账号密码后换会话） |
| GET | `/auth/accounts` | 登录 | 切换对话框的可选账号（不含任何凭据） |
| GET | `/auth/me` | 登录 | 当前用户 + 权限 |
| GET | `/bootstrap` | 登录 | 一次性返回：me / 分类树 / 标签 / 徽标计数 / 侧栏统计 |
| GET | `/dashboard` | 登录 | KPI / 待办 / 生命周期 / Zendesk 卡 / 最近动态 |
| GET | `/search?q=` | 登录 | 全局搜索（标题/ID/场景/分类），≤6 条 |
| GET | `/entries?view=` | 登录 | 列表：`drafts/mine/queue/all/offline/sync` |
| GET | `/entries/:code` | 登录 | 详情（含版本、同步、反馈、元数据、健康度） |
| GET | `/entries/:code/editor` | 登录 | 编辑器装载（正文原文、分类树、AI 建议、翻译引擎名） |
| GET | `/entries/:code/review` | 登录 | 审核装载（diff、AI 预检、提交信息、队列序号） |
| POST | `/entries` | 编辑 | 新建草稿（可带来源：候选/未命中） |
| PUT | `/entries/:code` | 编辑 | 保存草稿（标题/正文/分类/场景/标签/变更说明） |
| POST | `/entries/:code/translate` | 编辑 | LLM 翻译标题 + 正文 → 英文 |
| POST | `/entries/:code/submit` | 编辑 | 提交审核（三项校验） |
| POST | `/entries/:code/approve` | 审核 | 通过并发布（含回滚生效分支） |
| POST | `/entries/:code/reject` | 审核 | 驳回（意见必填） |
| POST | `/entries/:code/revise` | 编辑 | 创建修订（小版本 +1） |
| POST | `/entries/:code/offline` | 下线 | 下线 + Zendesk 归档 |
| POST | `/entries/:code/restore` | 编辑 | 已下线 → 草稿 |
| POST | `/entries/:code/rollback` | 编辑 | 提交回滚审核（目标版本） |
| POST | `/entries/:code/sync` | 同步 | 重新下发 / 重试 |
| GET | `/entries/:code/diff` | 审核 | 审核 diff（当前版本 ↔ 待发布内容） |
| GET | `/collect/task` | 登录 | 当前抽取任务 + 候选 + 来源原文 + 配置 |
| POST | `/collect/candidates/:code/accept` | 编辑 | 采纳候选 → 生成草稿 |
| POST | `/collect/candidates/:code/drop` | 编辑 | 丢弃候选 |
| POST | `/collect/run` | 编辑 | 手动触发一次抽取（定时任务同一入口） |
| GET | `/feedback` | 登录 | 用户反馈列表 |
| POST | `/feedback/pull` | 编辑 | 从 Zendesk 拉取客诉 |
| POST | `/feedback/:code/ignore` | 编辑 | 忽略 |
| POST | `/feedback/:code/fix` | 编辑 | 去修复 → 生成小版本草稿 |
| GET | `/misses` | 登录 | 未命中问题列表 |
| POST | `/misses/:code/draft` | 编辑 | 新建条目覆盖该场景 |
| GET | `/meta/categories` `/meta/scenes` `/meta/tags` | 登录 | 元数据列表 |
| POST/PUT | `/meta/categories[/:id]` 等 | 元数据 | 新增 / 编辑（含英文） |
| POST | `/meta/:kind/:id/toggle` | 元数据 | 上架 / 下架 |
| POST | `/meta/translate` | 元数据 | 中文名 → 英文名（LLM） |
| POST | `/meta/tags/:id/merge` | 元数据 | 合并标签（引用改写） |
| GET | `/sync/logs` | 登录 | 同步日志（报文号 / 耗时 / 结果） |
| GET | `/analytics/health` | 登录 | 健康度 KPI / 分布 / 场景覆盖 / 待修复 |
| GET | `/admin/users` `/admin/permissions` `/admin/audit` | super | 系统管理三页 |
| POST | `/admin/users` | super | 新增用户（返回一次性初始密码，不落明文） |
| POST | `/admin/users/:id/toggle` | super | 启用 / 停用（停用即刻销毁其会话） |
| POST | `/admin/users/:id/review-grant` | super | 单独授予 / 收回审核权限 |
| PUT | `/admin/permissions` | super | 调整权限矩阵（即时生效 + 审计） |
| GET | `/review/log` | 登录 | 审核记录（从审计筛通过 / 驳回） |
| POST | `/collect/run` | 采集 | 立即拉取并抽取（与每日 07:00 cron 同一入口，抽取页右上角「立即拉取」） |
| POST | `/import/parse` | 编辑 | 上传文档/表格 → 解析 + AI 整理 → 预览列表（multipart，≤20MB） |
| POST | `/import/commit` | 编辑 | 把预览列表批量建为草稿 |
| PUT | `/admin/users/:id` | super | 编辑用户姓名 / 部门 / 角色 |
| POST | `/misses/refresh` | 反馈 | 从帮助中心「搜索无结果」刷新未命中（cron 每小时同入口） |
| GET | `/healthz` | — | 依赖模式自曝（zendesk / llm） |

---

## 6. 设计系统落地

`doc/v4/spec/tokens.css` **原样**作为 `app/web/src/tokens.css`（仅补字体加载）。禁止改 token 值。

| 类别 | 规则 |
|---|---|
| 字体 | 标题 `Cormorant Garamond` + `Noto Serif SC`；正文 `Lora` + `Noto Serif SC`；本地/自托管，不依赖外网 CDN 可用性 |
| 颜色 | 只用 token，禁止硬编码色值 |
| 组件类 | `.btn/.btn-primary/.btn-secondary/.btn-ghost/.btn-icon/.btn-block`、`.tag/.tag-accent/.tag-accent-2/.tag-neutral/.tag-outline`、`.card/.card-kicker/.card-title/.card-body/.card-meta`、`.table`、`.input/.field`、`.seg/.seg-opt`、`.dialog*`、`.hr` |
| 内联样式 | 原型用大量内联样式表达布局，工程实现**照搬**为 React `style` 对象，保证像素一致 |
| 动画 | `shimmer`（骨架 1.4s）、`toastIn`（0.2s）、`spin` |

---

## 7. 生产化裁决（原型未覆盖但落地必须）

| 项 | 原型 | 落地 | 理由 |
|---|---|---|---|
| 登录 | 无，直接进工作台 | 保留登录页（argon2 + 会话 Cookie） | 删认证是安全回归 |
| 顶栏「切换」 | 即时切 陈默↔林静 | 打开「切换账号」对话框（选账号 + 验密码 → 重新登录） | 免密切身份 = 越权漏洞；按钮与位置保持不变 |
| Zendesk 写入 | `setTimeout` 模拟 | 发布后真实调用，`sync_status` 由真实结果驱动；失败落 `sync_fail_reason` 并可重试 | — |
| 重复同步 | 不涉及 | `PushInput.articleRef` 走更新路径（翻译端点 PUT，404 才 POST） | 原实现只有创建路径，重试会在帮助中心堆重复文章 |
| 采纳率/命中数 | 种子常量 | `entry_metrics` 表，由 Zendesk 文章投票回填（`adopt = up/(up+down)`）；未回填即为 0 | 不编造指标 |
| 场景覆盖率 | 常量数组 | **总体 = 已覆盖场景数 ÷ 客诉会话中出现的场景总数**（分母 = 库内启用场景 ∪ 抽取候选里模型判定但库内尚无的场景 ∪ 未归类的未命中问题）；单场景那列给该场景已发布条数的相对饱和度 | 08-06-2026 用户拍板：50 个场景对上 100 个真实场景就该是 50% |
| 抽取任务 | 前端假定时 | 后台 cron（`COLLECT_CRON`，默认每日 07:00）；**界面不加手动按钮**，因原型明写「抽取由后台定时任务完成，无需手动创建」 | 保持原型口径一致 |
| 未命中来源 | 静态种子 | cron 每小时从帮助中心「搜索无结果」刷新；接口不可得时不写数据、不造数 | — |
| 新增用户 | 只弹 toast | 真建账号：一次性初始密码仅在响应中出现一次，`must_change_password=true` | 生产必须能建号 |
| 权限矩阵「调整」 | 只开详情抽屉 | 详情抽屉 + 底部「对运营开放 / 收回」按钮，即时生效并写审计 | 保留原型按钮文案，功能落地 |
| Zendesk 卡 | 4 行（实例 / 上次拉取 / 待同步 / 同步失败） | 保持 4 行；沙箱模式在「实例」值后缀「（沙箱）」并置 accent | 不新增行，同时不掩盖沙箱事实 |
| 日期 | 硬编码 `08-05` | 真实时间（`DISPLAY_TZ`，默认 Asia/Shanghai），格式保持 `MM-DD HH:mm` | — |

### 7.1 运行模式与两道闸

| 模式 | 配置 | 用途 |
|---|---|---|
| **生产（当前）** | `.env` 无 `ZENDESK_FORCE_SANDBOX`，且 `ALLOW_LIVE_SYNC=1` | 08-06-2026 用户拍板启用：Zendesk 与千问全部真实调用 |
| 沙箱 | 启动时加 `ZENDESK_FORCE_SANDBOX=1` | 跑 `e2e/flows.mjs` / `e2e/ui.mjs` 必须用此模式；两套脚本自带闸，检测到 `live` 直接拒绝执行 |

`ALLOW_LIVE_SYNC` 未置 1 时，`LiveZendesk` 的写方法直接抛错并把失败原因写进同步日志——防止误配置下静默写生产。

### 7.1.1 三层映射（用户高频误解点，界面已加说明）

```
中台「知识分类」  ─→  Zendesk Category   （目录，不是文章）
中台「问题场景」  ─→  Zendesk Section    （目录，挂在上级分类的 Category 下）
中台「知识条目」  ─→  Zendesk Article    （文章，挂在所选场景的 Section 下）
```

同步用**英文名**（`name_en` 为空时退回中文名）。Guide 界面里 Section 与 Article 同树展示，
若把场景起成问句式的知识标题（如「配网提示 Wi-Fi 连接失败」），看起来就像凭空多了一篇文章——
这是命名问题，不是映射错误。编辑器的场景选择框下方已常驻说明。

### 7.1.2 用户实操后修掉的四个真 bug（08-06-2026）

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 分类/场景保存提示成功，Zendesk 无变化 | 只在「已有 ref 且英文名变了」时改名，新建时不建目录（等发布懒创建） | 保存即调 `syncCategory` / `syncScene`，真实结果回传界面并写同步日志 |
| 2 | AI 采集拿不到任何数据 | 取 `ticket.description`，而 Messaging 工单的 description 是占位串「Conversation with Web User …」，真实对话在 `/tickets/{id}/comments.json`；且 channel 判定写死 `=== 'chat'`，真实值是 `native_messaging` | 逐工单取 comments 拼公开往来；channel 白名单含 messaging/web_widget |
| 3 | 抽取跑了却一条候选都没有 | 置信度起评 0.55 + 频次加成，单条主题 0.59 低于阈值 0.60，低频场景全被静默丢弃 | 起评提到 0.62；被阈值丢弃时把原因写进任务 `fail_reason` 并在界面显示 |
| 4 | 草稿箱出现空白条目 | 「撰写新知识」点击即建库行，放弃编辑就留下「未命名知识」空壳 | 新建态不落库，首次保存才建；启动时清理历史空壳 |

### 7.1.3 第三轮实操后修掉的三个真 bug（08-06-2026）

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 5 | 文章点赞拉不回系统 | `fetchArticleVotes` 读 `article_votes`，Zendesk 实际返回 **`votes`**；且拉取只查 `status='published'` 的条目，条目一旦被改成草稿/修复中就再也拉不到线上文章的票 | 两个键都兜；改为按「有 Zendesk 文章映射」拉票，与中台状态无关。实测拉回 1 赞、采纳率 100% |
| 6 | 抽取报「Expected ',' or '}' … position N」 | 模型把多行正文的**真换行**直接写进 JSON 字符串（非法 JSON），贪婪正则又会把结尾解释吞进来 | 括号配平扫描 + 裸控制字符转义 + 截断修复三道，仍失败则抛带片段的可读错误；单条起草失败不拖垮整批 |
| 7 | 清空后再抽取报唯一键冲突 | 候选编号用 `COUNT(*)+1`，清空后计数回落与残留的已采纳候选撞号 | 改用 `MAX(编号)+1` |

### 7.2 Zendesk 侧的两处「返回 200 但不生效」（均已实证并修复）

| 对象 | 错误做法 | 正确做法 |
|---|---|---|
| 分类 / 场景改名 | `PUT /help_center/{categories\|sections}/{id}.json {name}` | `PUT .../{id}/translations/{locale}.json {translation:{title}}` |
| 文章下线 / 上线 | `PUT /help_center/articles/{id}.json {article:{draft}}` | `PUT .../articles/{id}/translations/{locale}.json {translation:{draft}}`，**逐 locale** |

原因相同：这些字段的真身在 translation 上，对象端点上的同名字段只是只读投影。
另：重新发布必须在 translation 里显式带 `draft:false`，否则被下线过的文章内容更新了却仍对客隐藏。

---

## 8. 验收契约与结果

执行（**必须在沙箱模式的服务上跑**，脚本自带闸）：

```bash
psql postgres -c 'DROP DATABASE IF EXISTS kb_console_e2e'
DATABASE_URL=postgres://localhost:5432/kb_console_e2e pnpm -C app --filter @kb/server exec tsx src/db/migrate.ts
DATABASE_URL=postgres://localhost:5432/kb_console_e2e pnpm -C app --filter @kb/server exec tsx src/db/seed.ts   # 记下打印的密码
DATABASE_URL=postgres://localhost:5432/kb_console_e2e ZENDESK_FORCE_SANDBOX=1 pnpm -C app --filter @kb/server dev
E2E_PASSWORD=<超管密码> E2E_OPS_PASSWORD=<运营密码> node app/e2e/flows.mjs   # 闭环 15 项
E2E_PASSWORD=<超管密码> E2E_OPS_PASSWORD=<运营密码> node app/e2e/ui.mjs      # 视觉 7 项 + 17 张截图
```

两套脚本**自带 fixture**：分类/场景由接口建，抽取候选、未命中、反馈全部由真实管道从 Zendesk 沙箱语料生成，
不依赖任何演示种子（`db:seed` 已不含 mock 数据）。下表为 08-06-2026 在空库上的实跑结论。

| 编号 | 类型 | 验收项 | 结果 |
|---|---|---|---|
| DESIGN-01a | 视觉 | 根容器 1440 / 侧栏 236 / 导航 10 组 / KPI 5 列 | ✅ 全等 |
| DESIGN-01b | 视觉 | 列表 6 列宽 34/13/11/15/11/16 | ✅ 全等 |
| DESIGN-01c | 视觉 | 审核抽屉 640px、三色 diff 逐行渲染 | ✅ 640px / 5 行 |
| DESIGN-01d | 视觉 | 回滚弹窗 440px | ✅ 440px |
| DESIGN-02a | 视觉 | 六态 tag 文案与配色 | ✅ 草稿/待审核/已驳回/已发布/修复中 |
| DESIGN-02b | 视觉 | 四同步态文案与配色 | ✅ 已同步 / 同步失败 |
| FLOW-01 | 闭环 | 候选「生成草稿」→ 草稿带来源 `AI 抽取 · CT-xxxx / EX-xx` | ✅ EX-01 → KB-20545 |
| FLOW-02 | 闭环 | 缺英文 → 提交 422 并列出校验项 | ✅ 422「尚未翻译为英文」 |
| FLOW-03 | 闭环 | 真实大模型翻译标题与正文 | ✅ qwen 产出英文标题 |
| FLOW-04 | 闭环 | 提交进队列 → 通过 → 大版本 +1 且写版本历史 | ✅ v0.1 → v1.0 |
| FLOW-05 | 闭环 | 发布即同步 + 报文号 + 耗时留痕 | ✅ synced / #88212 / 3ms |
| FLOW-06 | 闭环 | 驳回空意见被拒；带意见回写条目 | ✅ 400 → 200，意见落库 |
| FLOW-07 | 闭环 | Zendesk 拉客诉（真实投票增量）→ 去修复生成小版本 | ✅ v1.0 → v1.1，条目与反馈均置「修复中」 |
| FLOW-08 | 闭环 | 未命中新建条目 → 未命中置已排期 | ✅ MS-441 → KB-20546 |
| FLOW-09 | 闭环 | 回滚必须过审；过审后内容与指标一并回退并重新同步 | ✅ v3.2 → v3.1，正文实测已回退 |
| FLOW-10 | 闭环 | 下线 → offline + Zendesk 归档留痕；恢复 → draft | ✅ 双向通过 |
| LIVE-01 | 生产 | 真实帮助中心全链路：建目录 → 翻译 → 审核 → 发布 → 回读 | ✅ article 54141192272659 `locale=en-us` `draft=false`，标题/正文为真实千问译文 |
| LIVE-02 | 生产 | 真实下线 → 文章从对客侧撤下（回读 `draft=true`） | ✅ 修复后实证生效（修复前 PUT 对象端点返 200 但不生效） |
| LIVE-03 | 生产 | 真实重新发布 → 文章复出（回读 `draft=false`） | ✅ translation 带 `draft:false` 后生效 |
| RULE-01 | 安全 | ops 访问 admin：API 403 + 页面 403 | ✅ 两层均拦 |
| RULE-02 | 安全 | 审计 append-only | ✅ 接口无修改路径；psql `UPDATE 0 / DELETE 0` |
| RULE-03 | 安全 | 未登录访问 `/api` → 401 | ✅ |
| RULE-04 | 数据 | 新增分类/场景 → 懒创建 Zendesk Category/Section | ✅ 场景挂上 Section id |
| RULE-05 | 数据 | 标签不翻译、不进 Zendesk | ✅ 无英文字段；翻译端点拒标签 |

单元测试：`vitest run` **37/37**（状态机与版本号、权限单独授予、段落 diff LCS、脱敏、时间格式、Zendesk 契约含更新路径 / 下线逐 locale / 重发复位 draft 三条防回归）。

---

## 9. 运行手册

```bash
# 依赖：本机 PostgreSQL（无需 Docker）
corepack pnpm -C app install
corepack pnpm -C app --filter @kb/contracts build
corepack pnpm -C app --filter @kb/server db:migrate   # 库不存在时自动建 kb_console
corepack pnpm -C app --filter @kb/server db:seed      # 引导数据：每角色一个账号 + 权限矩阵
corepack pnpm -C app --filter @kb/server dev          # 3311
corepack pnpm -C app --filter @kb/web dev             # 5311（代理 /api → 3311）
```

**`db:seed` 不含任何演示数据**，且幂等非破坏：重跑不删业务数据、不重置已有账号密码
（要重置显式 `SEED_RESET_PASSWORD=1`）。新建账号时生成 16 位随机密码并打印一次，库里只存 argon2 哈希。
分类 / 场景 / 标签由用户在「元数据中心」自建（保存即同步 Zendesk 目录）；
知识条目、抽取候选、反馈、未命中一律来自真实业务与 Zendesk 回流。

| 环境变量 | 作用 |
|---|---|
| `DATABASE_URL` | 默认 `postgres://localhost:5432/kb_console` |
| `QWEN_API_KEY` / `QWEN_MODEL` | 翻译与抽取；缺失则降级为本地确定性模式并在界面如实标注 |
| `ZENDESK_*` | 实例与凭据；`ZENDESK_LOCALE=en-us`（文章写入语言） |
| `ALLOW_LIVE_SYNC=1` | 允许写真实帮助中心（生产必需） |
| `ZENDESK_FORCE_SANDBOX=1` | 强制沙箱；跑 E2E 必须加 |
| `DISABLE_CRON=1` | 关闭抽取（每日 07:00）与未命中刷新（每小时） |
| `DISPLAY_TZ` | 界面时区，默认 `Asia/Shanghai` |
