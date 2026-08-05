# TDD 验收结果台账 · COOLFLY 知识运营中台

> 本台账在改任何代码前重建，逐项记录本轮真实执行状态与证据。仅本轮命令输出/退出码/API 结果/截图可记 `pass`；推测倒填、旧证据、"应该通过"均不允许。
>
> **本轮 = 08-05-2026 四项变更返工轮**：①删除向量设计与技术栈集成 ②知识库总览结构树 UX/UI 对齐 v3 原型（三级折叠树）③取消四眼原则（审核员可自审）④审核中心变更对照改「摘要 + git diff」两层。开放点拍板：发布门禁四查→三查、挖掘查重改 LLM 两段式语义判定、授权破坏性 DDL。上一轮（08-04）台账 17/17 全 pass 的结论**不继承**——契约已改（新 sha256），全部 17 行重新置 `pending` 并重跑。

- contract_sha256: sha256:d06ed4f05ed3c2568abb265afdd92427c3b859d1e65eddfba3da29ff5eb66940
- run_started_at: 2026-08-05T03:33:16Z
- source_contract: `output/tests/TDD验收契约.md`（revision 6 · 17 条 required：SMOKE×2 / FLOW×7 / DESIGN×1 / RULE×7 · 43 required source）
- 被测系统：`app/`（@kb/contracts + @kb/server + @kb/web），生产模式 `node dist/index.js` @ :3311，PostgreSQL 16（Docker 容器 `coolfly-kb-pg`，**已 DROP vector 扩展与 entry_vectors 表**）
- 验收命令入口：`pnpm -r typecheck` / `pnpm build` / `pnpm --filter @kb/server test`（vitest）/ `node e2e/flows.mjs`（Playwright）/ curl / psql / 截图对 + 独立视觉验收官

## 验收台账

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pending | 干净环境执行 install→typecheck→build→db:migrate（含破坏性 DDL 去向量）→db:seed→生产启动 | — |
| SMOKE-02 | pending | Playwright 真实浏览器：登录 → 工作台 → 九视图逐一点击 + 面包屑联动 + 无权限视图置灰 | — |
| FLOW-01 | pending | 录入→提交→审核通过→门禁阻断→补齐→发布→同步→总览可见 全链路；发布时生成 AI 摘要、人工校正后不被覆盖 | — |
| FLOW-02 | pending | 审核员空理由驳回被拦 → 填写理由驳回 → 提交人「被驳回待改」见理由 → 重提留痕 | — |
| FLOW-03 | pending | 挖掘视图：批次三态 + 三重准入 + **LLM 两段式语义查重**（判定理由可见、≥0.85 仅挂修订、LLM 不可用如实标注降级） | — |
| FLOW-04 | pending | 版本 diff + 回滚（审核员）→ 新版生效/原版标已回滚/指标保留/自动入队；知识管理员无回滚权 | — |
| FLOW-05 | pending | 数据看板三页签 + 反馈回流信号矩阵（四渠道 + 确定性档位 + 五来源候选） | — |
| FLOW-06 | pending | 翻译状态机：AI 翻译→待人工校验→确认；内部段落不翻译；中文改动→英文 stale + 同步阻断；门禁**三查** | — |
| FLOW-07 | pending | 总览三库 / **三级结构树**（含工具条与调整层级）/ Section 映射 / 组合筛选 / 复核三档 / 含条目章节禁删 | — |
| DESIGN-01 | pending | 原型与成品十视图同尺寸截图对 + 独立视觉验收官逐图核对（本轮重点：三级结构树、AI 摘要面板、门禁三查、审核两层 git diff） | — |
| RULE-01 | pending | 四角色逐项越权走查（界面禁用 + 接口层拒绝），矩阵 10×4 逐格断言 | — |
| RULE-02 | pending | 发布路径唯一性 + **审核员自审放行且留痕**（四眼原则已取消）+ 未过审不外泄 | — |
| RULE-03 | pending | 脏文件批量导入（模拟飞书迁移）→ 成功进待审、失败逐条报行号原因、无绕审入库 | — |
| RULE-04 | pending | 三种可见性同步载荷内容断言（内部口径零容忍） | — |
| RULE-05 | pending | 账号体系：创建 → 首次强制改密 → 禁用后在途会话即时失效 → 审计留痕；脱敏纯函数；DPA 留档 | — |
| RULE-06 | pending | 同步失败/阻断/drift 双处置/并发冲突/映射缺失 五类构造 | — |
| RULE-07 | pending | 全链路留痕 + append-only 数据库层强制 | — |

## 统计

- 总数：17
- pending：17
- pass：0
- fail：0

## 本轮验证命令与结果汇总

| 门禁 | 命令 | 结果 |
| :--- | :--- | :--- |
| 依赖 | `pnpm install --frozen-lockfile` | 待执行 |
| 类型 | `pnpm -r typecheck`（server + web） | 待执行 |
| 构建 | `pnpm build`（contracts→web→server） | 待执行 |
| 迁移 | `pnpm --filter @kb/server db:migrate` | 待执行 |
| 种子 | `pnpm --filter @kb/server db:seed` | 待执行 |
| 单元+集成 | `pnpm --filter @kb/server test`（vitest） | 待执行 |
| E2E | `node e2e/flows.mjs`（Playwright Chromium） | 待执行 |
| 视觉 | `node e2e/capture.mjs` + 独立视觉验收官 | 待执行 |
| 接口越权 | curl 四角色 × 越权动作 | 待执行 |
| 审计不可变 | psql UPDATE/DELETE 尝试 | 待执行 |
| lint | — | 项目未配置 eslint（package.json 有 lint 脚本但未安装依赖），如实记录 |

## 不满足上线条件项（如实记录，非验收失败项）

- **LLM 供应商 DPA + 输入不用于训练条款证据**（NFR-002 / PRD §9.7 硬条件）：属商务签约动作，本环境无凭据与合同文件，无法产出证据。系统侧已实现的部分：LLM provider 抽象（Anthropic 真实实现 + 本地确定性 provider），`/healthz` 如实暴露 `llm: local`。**上线前必须补齐 DPA 证据，否则不满足上线条件。**（本轮 LLM 用途新增「条目 AI 摘要生成」与「挖掘语义查重判定」，DPA 覆盖面须同步扩展。）
