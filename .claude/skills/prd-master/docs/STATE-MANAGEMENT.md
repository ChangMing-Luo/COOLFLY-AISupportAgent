# 项目状态管理与恢复协议

每个项目目录维护一个 `state.json`，跟踪当前阶段、工作类型、流程模式、契约 revision、未解决问题和上次行动，用于可靠恢复中断流程。

---

## state.json 结构

```json
{
  "state_schema_version": 1,
  "project_name": "fba-smart-restock",
  "project_started_at_utc": "2026-05-23T10:00:00Z",
  "last_updated_at_utc": "2026-05-23T14:32:00Z",

  "work_type": "feature",
  "workflow_mode": "standard",
  "value_confirmation": {
    "status": "confirmed",
    "decision": "认可",
    "confirmed_at_utc": "2026-05-23T11:30:00Z",
    "basis": "用户基于当前价值假设确认"
  },
  "stage_confirmations": {
    "stage1_shared_understanding": {"status": "confirmed", "confirmed_at_utc": "2026-05-23T11:00:00Z"},
    "stage3_research_sufficiency": {"status": "confirmed", "confirmed_at_utc": "2026-05-23T12:30:00Z"},
    "stage4_5_v1": {"status": "pending", "confirmed_at_utc": null},
    "stage4_6_mvp": {"status": "pending", "confirmed_at_utc": null}
  },
  "contract_revision": 3,
  "source_ids_changed": ["AC-F03-01"],
  
  "current_stage": "4.5",
  "current_substep": "v1-user-decision",
  "completed_stages": ["0", "1", "2", "3", "4.1", "4.2", "4.3", "4.4"],
  "skipped_stages": [],
  
  "next_action": {
    "type": "user_decision",
    "description": "等企业家拍板：V1 方案对吗？",
    "askuserquestion_options": ["接受 V1 走终稿", "继续吵一轮", "大方向调整"]
  },
  
  "open_questions": [
    {"id": "OQ-7", "title": "批量导出是否进入 MVP", "kind": "decision", "category": "scope", "priority": "P1", "depends_on": [], "owner": "user", "status": "pending_user"}
  ],
  
  "key_decisions_made": [
    {"id": "D-1", "decision": "v1 用虚拟数据集 + 影子真实 SKU", "stage": "1", "rationale": "..."},
    {"id": "D-2", "decision": "每日决策（不是每周）", "stage": "1"}
  ],
  
  "category": "saas",
  
  "deliverables": {
    "scene_anchor": "scene-anchor.md",
    "proposal_v0": "proposal-v0.md",
    "proposal_v1": "proposal-v1.md",
    "debate_log": "debate-log.md",
    "assumptions": "assumptions.md",
    "conversation": "conversation.md",
    "evidence": ["evidence/competitors.md", "evidence/benchmark.md"],
    "drafts": [],
    "final_prd": null,
    "requirements_contract": null,
    "requirements_analysis": null,
    "bugfix_contract": null,
    "prd_summary": null,
    "prd_dev": null,
    "ppt_outline": null,
    "ppt_pages": []
  }
}
```

### 阶段 1 前沿如何保存

`open_questions` 是未决节点和依赖关系的唯一事实源，不另建第二棵树。每个未决节点必须包含：

- `depends_on`：它依赖的未决节点 ID；依赖节点仍在 `open_questions` 时，本节点不能进入前沿；
- `owner`：`agent` 表示 AI 应自行查证；`user` 或具体的用户侧角色表示需要用户本人或其组织提供证据；
- `status`：用户节点用 `pending_user`；AI 事实节点用 `pending_research` 或 `researching`。已解决节点直接移出 `open_questions`。

阻塞方向的事实节点还要保存 `evidence_needed`、`acceptance_threshold` 和 `due_by`；`owner` 必须指向真正能取得证据的人或 Agent。这样“需要验证”才是可执行任务，而不是一句悬空备注。

事实查证节点严格使用下面的字段名和值，不得自行改成 `type`、`evidence_required`、`deadline`、`awaiting_evidence` 等近义字段：

```json
{
  "id": "OQ-8",
  "title": "夜间 CSV 是否满足审批前检查的数据新鲜度",
  "kind": "fact",
  "category": "system_dependency",
  "priority": "P1",
  "depends_on": [],
  "owner": "企业 IT 数据负责人",
  "status": "pending_user",
  "evidence_needed": "一周导出时间戳与审批入队时间样本",
  "acceptance_threshold": "95% 的数据延迟不超过 2 小时",
  "due_by": "3 个工作日内"
}
```

阶段 1 的 `next_action` 保存**本轮实际前沿快照**，用于中断后原样恢复，不替代 `open_questions`：

```json
"next_action": {
  "type": "stage1_frontier",
  "description": "等待用户回答当前前沿；事实查证并行进行",
  "question_ids": ["OQ-7", "OQ-9"],
  "research_ids": ["OQ-8"]
}
```

`question_ids` 只包含本轮实际问给用户的节点；`research_ids` 包含已经派发、尚未完成的事实查证，不论负责人是 AI 还是用户侧角色。即使当前只是在等待事实查证，`next_action.type` 仍使用 `stage1_frontier`，不得发明另一种类型。每次用户回答或查证返回后，先更新 `open_questions`，再按依赖关系重算并覆盖 `next_action`。用户要求分批回答时，`question_ids` 可以是完整可问前沿的子集；不得加入依赖仍未解决的节点。

恢复阶段 1 时，从 `open_questions` 重算当前前沿并覆盖 `next_action`，不向用户重复已解决的问题。

## Controller 何时更新 state.json

- 每次阶段切换（如 0→1、4.6→5.1）
- 每次企业家/技术负责人拍板且满足「关键决策闸门」时（写入 key_decisions_made；普通确认不写）
- 每次用户通过必做人工门禁时，立即更新 `stage_confirmations` 或 `value_confirmation`；普通确认虽不进入 `key_decisions_made`，但不能只留在聊天记录
- 阶段 1 每次回答后重算决策树：新增未决节点、移除已解决节点，并为 OQ 标记 `kind=fact|decision`、依赖、优先级和责任人
- 用户暂停时，把本轮 `question_ids` 和仍在运行的 `research_ids` 写入 `next_action`；只要仍有阻塞阶段 2 的 P0/P1 OQ，就不得把阶段 1 标记完成
- 每次输出文件（更新 deliverables）
- 每次切换 work_type/workflow_mode 或需求 revision（更新 contract_revision/source_ids_changed）

### Feature 价值确认硬门禁

`value_confirmation` 是进入阶段 3–6 的必填状态，不是可选备注：

- `status` 必须为 `confirmed`；
- `decision` 只允许 `认可 / 不认可 / 需要先验证`，三者都表示“用户已经完成价值确认”，不要求必须认可；
- `confirmed_at_utc` 和 `basis` 不得为空；
- `scene-anchor.md` 必须同时包含「价值论证（阶段 2 已确认）」及相同决定。

在任何 `2→3` 阶段切换或阶段 3–6 恢复前都重新校验这四项。缺任一项时，把 `current_stage` 设为 `2`，`next_action` 设为让用户完成价值确认；禁止从上下文猜测、禁止默认认可、禁止以已有后续产物为由绕过。Feature 的 `skipped_stages` 必须始终为 `[]`。

### Feature 完整流程门禁

每次阶段切换或恢复时，按目标阶段校验最早缺失项：

| 进入目标 | 必须已有 |
| :--- | :--- |
| 阶段 2 | `stage1_shared_understanding.status=confirmed` |
| 阶段 3 | 上述价值确认硬门禁全部通过 |
| 阶段 4 | `evidence/competitors.md`、`evidence/benchmark.md`，且 `stage3_research_sufficiency.status=confirmed` |
| 阶段 4.6 | `proposal-v0.md`、`debate-log.md`、`proposal-v1.md`，且三轮多 Agent 辩论完成、`stage4_5_v1.status=confirmed` |
| 阶段 5 | `proposal-v1.md` 含「MVP 划分（已与企业家确认）」且 `stage4_6_mvp.status=confirmed` |
| 阶段 6 | `PRD详细版.md`、`requirements.md`、`requirements-analysis.md`、`PRD-summary.md`、`PRD-dev.md` 均已生成并通过相应校验 |
| 标记完成 | `ppt.md` 与声明的全部 `ppt/pNN.html` 均存在并通过全局自校验 |

缺失时从表中最早缺失项恢复，不得用空文件、`skipped_stages` 或“需求简单”绕过。`tech-constrained` 还须存在 `evidence/technical-feasibility.md`，但其余门禁完全相同。

**写入方式**：用 Read + Write 原子操作（先读再覆盖）。

## 启动与恢复协议

当用户说"启动 PRD 大师"或"继续上次的 PRD"时，Controller：

### Step 0: 扫描已有项目

```bash
ls -d */  # 找出所有项目（每个项目=工作区下一个以项目名命名的目录）
```

每个项目读 `state.json`，按 `last_updated_at_utc` 倒序。

### Step 1: 用 AskUserQuestion 让用户选

```
question: "我看到你有几个进行中的项目"
options:
  - "继续 fba-smart-restock（上次到阶段 4.5，2 天前）"
  - "继续 xxx-xxx（上次到阶段 1.3，1 周前）"
  - "开始新项目"
```

### Step 2a: 选"继续"

Controller 读对应 state.json 的 `next_action` 字段，**直接执行那个 action**（如发对应 AskUserQuestion）。

同时给企业家一份"上次进度回顾"行动卡：

```
📌 你上次的项目: fba-smart-restock（FBA 智能补货决策引擎）

📍 上次进度：阶段 4.5（V1 方案待确认）
🎯 已完成: 价值论证、调研和四方评审三轮博弈
⏸ 暂停原因: 你说"我先想想"

🔄 现在你需要做的:
   {next_action.description}

📚 你想先看历史吗？
   - 看场景锚点 scene-anchor.md
   - 看 V1 方案 proposal-v1.md
   - 看仍待拍板的 OPEN_QUESTION
```

### Step 2b: 选"开始新项目"

直接写入 `work_type=feature`，不得询问 Feature / Bugfix 二选一。默认写入 `workflow_mode=standard`；只有既有架构、严格性能/合规或迁移约束已有证据并会决定范围时，才自动写入 `tech-constrained`，且不让用户选择流程模式。只有用户明确提出“做 bugfix 规格”“整理复杂缺陷”或等价意图时，才改走 `work_type=bugfix` 专用链路。

## 快速恢复的 3 种场景

### 场景 A: 1 小时内继续

直接读 state.json 的 `next_action`，立刻执行。无需任何展示。

### 场景 B: 1 天-1 周回来

展示“上次进度回顾”行动卡（见 Step 2a），让用户决定是否需要先回看历史。

### 场景 C: 1 周以上回来

主动展示：
- 上次场景锚点（提醒"你当时想的是这个"）
- 上次 V1 方案
- 上次未解决的 OPEN_QUESTION
- 询问"过去 X 天有什么变化吗？要更新场景理解吗？"

如果用户说"有变化"→ 回到阶段 0 重做激进抽取（输入 = 老场景 + 新变化）

---

## state.json 跟 conversation.md 的区别

| 文件 | 用途 | 写入方式 |
|------|------|---------|
| `state.json` | 结构化状态（机器读） | Controller 自动维护 |
| `conversation.md` | 完整对话存档（人读） | Controller 累加追加 |

state.json 是 conversation.md 的"索引"。conversation.md 是史诗，state.json 是 TOC。

## 兜底机制

如果 state.json 损坏或缺失：

```python
# Controller 启动时
if not state_json.exists():
    # 重建：扫描 deliverables 目录推断状态
    if output/bugfix.md exists: state.work_type = "bugfix"
    elif output/requirements.md exists: state.work_type = "feature"
    if output/ppt.md exists and every page p01..pNN declared in ppt.md exists: state.current_stage = "6.3"
    elif output/ppt.md exists: state.current_stage = "6.2"
    elif output/requirements.md exists: state.current_stage = "需求契约已生成"
    elif output/PRD详细版.md exists: state.current_stage = "PRD 已生成，待需求契约"
    elif drafts/r3-*.md exists: state.current_stage = "5.3"
    elif proposal-v1.md exists: state.current_stage = "4.5"
    elif scene-anchor.md contains "价值论证（阶段 2 已确认）" and reconstructed value_confirmation is complete: state.current_stage = "3"
    elif scene-anchor.md contains "价值论证（阶段 2 已确认）": state.current_stage = "2"  # 确认状态不完整时重新确认
    elif scene-anchor.md exists: state.current_stage = "1.5"
    else: state.current_stage = "0"
```
