# TDD 验收结果台账 · COOLFLY 知识运营中台

> 本台账在改任何代码前重建，逐项记录本轮真实执行状态与证据。仅本轮命令输出/退出码/API 结果/截图可记 `pass`；推测倒填、旧证据、"应该通过"均不允许。
>
> **本轮 = 08-05-2026 四项变更返工轮**：①删除向量设计与技术栈集成 ②知识库总览结构树 UX/UI 对齐 v3 原型（三级折叠树）③取消四眼原则（审核员可自审）④审核中心变更对照改「摘要 + git diff」两层。开放点拍板：发布门禁四查→三查、挖掘查重改 LLM 两段式语义判定、授权破坏性 DDL。上一轮（08-04）台账 17/17 全 pass 的结论**不继承**——契约已改（新 sha256），全部 17 行重新置 `pending` 后重跑。

- contract_sha256: sha256:d06ed4f05ed3c2568abb265afdd92427c3b859d1e65eddfba3da29ff5eb66940
- run_started_at: 2026-08-05T03:33:16Z
- source_contract: `output/tests/TDD验收契约.md`（revision 6 · 17 条 required：SMOKE×2 / FLOW×7 / DESIGN×1 / RULE×7 · 43 required source）
- 被测系统：`app/`（@kb/contracts + @kb/server + @kb/web），生产模式 `node dist/index.js` @ :3311，PostgreSQL 16 @ localhost:5432/kb_console（**vector 扩展、entry_vectors 表、vector_status 列均已 DROP**，表数 23 → 22）
- 验收命令入口：`pnpm -r typecheck` / `pnpm build` / `pnpm --filter @kb/server test`（vitest 69 项）/ `node e2e/flows.mjs`（Playwright 8 条旅程）/ curl / psql / 截图对 + 独立视觉验收官

## 验收台账

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pass | 干净环境执行 install→typecheck→build→db:migrate（含删向量破坏性 DDL）→db:seed→生产启动 | `pnpm install --frozen-lockfile` exit=0；`pnpm -r typecheck` exit=0（contracts+server+web）；`pnpm build` exit=0（vite 126 modules）；`db:migrate` → 「迁移完成：**22 张表**」（原 23 张，entry_vectors 已 DROP）；`db:seed` exit=0 → 5 用户/3 库/13 章节/6 条目/4 批次/3 篇沙箱；`node dist/index.js` → `GET /healthz` 200 `{"status":"ok","zendesk":"sandbox","llm":"local"}`、`GET /` 200；启动日志 level≥50 计数=0。**删向量实证**（psql）：迁移后 `pg_extension` 无 vector、`to_regclass('entry_vectors')` 为空、`entries` 无 vector_status 列；新增列 `ai_summary / summary_source / summary_at` 就位 |
| SMOKE-02 | pass | Playwright 真实浏览器：登录 → 工作台 → 九视图逐一点击 + 面包屑联动 + 无权限视图置灰 | `node e2e/flows.mjs` → `PASS SMOKE-02 登录落工作台(我的工作台)、四统计卡=4、九视图导航与面包屑联动、rbac 无权限置灰=true、页面错误=0` |
| FLOW-01 | pass | 录入→提交→审核（含两层变更对照）→门禁阻断→补齐→发布→同步→总览可见；发布时生成 AI 摘要 | `PASS FLOW-01 草稿卡 1→2、提交待审卡=2、待审徽标=2、过审前不在总览=true、**变更摘要层=true、diff 默认折叠=true、展开后 diff 行=2（新增 2）**、门禁阻断=true、补齐后发布=published、同步任务行=1、总览可见=true、**发布后 AI 摘要来源=ai**`；vitest 同源覆盖「人工校正摘要后 source=human，再次发布不被 AI 覆盖（AC-F09-39）」 |
| FLOW-02 | pass | 审核员空理由驳回被拦 → 填写理由驳回 → 提交人「被驳回待改」见理由 → 重提留痕 | `PASS FLOW-02 空理由校验提示可见="驳回理由必填——审核意见会回传给提交人并…"、驳回后进提交人「被驳回待改」=true、理由回传可见=true`；vitest 断言审核历史含「提交审核/审核驳回（含理由）」 |
| FLOW-03 | pass | 挖掘视图：批次三态 + 三重准入 + **LLM 两段式语义查重**（判定理由、≥0.85 仅挂修订、降级如实标注） | `PASS FLOW-03 空批次如实标注=true、失败批次含原因=true、分渠道计数=true、三重准入说明=true、查重≥0.85仅挂修订（无立新条按钮）=true、**查重判定理由可见=true**、LLM 模式=local、**实跑批次=completed/每条含理由=true/本地模式标降级=true**、界面「语义查重未生效」可见=true`（E2E 真调 `POST /api/mine/batches/run` 跑了一批，非读种子数据）；vitest 断言 `dispose(action=draft)` 对 0.88 候选返回 409「不新建，请挂为修订建议」 |
| FLOW-04 | pass | 版本 diff + 回滚（审核员）→ 新版生效/原版标已回滚/指标保留/自动入队；知识管理员无回滚权 | `PASS FLOW-04 回滚生成 v5、原版标已回滚=true、历史指标保留=true、自动入同步队列=true、知识管理员回滚被拒=403`；审计实证 `李骁 | 版本回滚 | 生效版本 | v4 → v1（以 v5 重新生效）` |
| FLOW-05 | pass | 数据看板三页签 + 反馈回流信号矩阵（四渠道 + 确定性档位 + 五来源候选） | `PASS FLOW-05 低覆盖场景可见=true、样本积累中=true、缺口与无结果关键词=true、客服工作数据仅 Explore 指向=true、信号四渠道=true、确定性档位=true、五来源候选=true` |
| FLOW-06 | pass | 翻译状态机：AI 翻译→待人工校验→确认；内部段落不翻译；中文改动→英文 stale + 同步阻断；**门禁三查** | `PASS FLOW-06 翻译后=pending_human、内部段落未翻译=true、人工确认=confirmed、中文改动后英文=stale、**门禁三查=fields/internal/english**`（不含 proxy_eval）；vitest 断言英文未确认时 `runSyncTask` → blocked（reason=英文未确认）且不入队 |
| FLOW-07 | pass | 总览三库 / **三级结构树**（工具条 + 仅已发布 + 调整层级）/ Section 映射 / 组合筛选 / 复核三档 / 含条目章节禁删 | `PASS FLOW-07 三库可切换=true、仅内部库说明=true、Section 映射标识=true、映射说明条=true、超期标注=true、筛选器=4 个、**「仅已发布」徽章=true、结构工具条三按钮=true、三级树条目行=1 个（折叠后 0）、调整层级=200/移动生效=true**、含条目章节删除拦截=409「该章节下仍有 2 个条目、0 个子章节——请先移空…」`；审计实证 `王雯 | 调整章节层级 | 所属目录 | 售后政策 → 订单与物流` |
| DESIGN-01 | pass | 20 张截图对 + **两轮**独立视觉验收官逐图核对 | baseline/actual 各 10 张 @ `tests/visual/`。**第 1 轮 fail, blocking=3**：B-01 工作台角色说明仍写「四眼原则——自己提交的条目须另一名审核员通过」（真缺陷，`contracts/src/rbac.ts:17` 漏改）；B-02 审核中心为空态，变更摘要层与「查看具体变更」入口无从对照；B-03 门禁三查无证据且条目工作台门禁区定格「门禁检查加载中…」。**修复**：改角色说明文案；种子 KB-0212 改待审使队列非空；截图脚本改为 review 选中首条并展开 diff、entry 进既有条目；新建条目门禁区改说明性文案；顺带清运行时向量残留文案（保存 toast + 审计备注）与候选卡重复提示。**第 2 轮 pass, blocking=0**（reviewer=independent-visual，逐张 Read 20 图 + 7 处 2 倍裁切放大）：B-01/B-02/B-03 均实证已修复；五项变更逐项达标——删向量（十图无「向量/代理评测/pgvector」，挖掘改「② LLM 语义查重」）、三级树（副标+「仅已发布」徽章+三按钮工具条+逐级缩进+Sec 映射+文档图标，**操作按钮未常驻、无中文换行无逐字竖排，上上轮 B-01 未复现**）、去四眼（「通过」按钮实心可点未置灰）、两层 diff（摘要徽章「新建条目 · 3 个段落」+3 条概述 + git diff 行号槽/绿底 `+`/图例）、门禁三查（恰好三项，无第四项）。新增 non-blocking：N-01 本轮数据态只有新建条目故 diff 无红底删除行实拍、N-02 仅内部库说明文案重复一次、N-03 待审队列表头中文断行（可读可点）、N-04/N-05 复核临期徽章与审核历史卡未进取证视口、N-06 sync drift 告警条为数据态差异 |
| RULE-01 | pass | 四角色逐项越权走查（界面禁用 + 接口层拒绝） | curl 实测 **8/8 越权全 403**：AI运营改正文/审核/同步重试、知识管理员审核/发布、审核员改矩阵/建用户、系统管理员审核内容；只读 `GET /api/rbac/matrix` → 200；新增端点同样受控：AI运营 `PATCH /kb/chapters/:id/parent` → 403「目录与章节管理权限仅知识管理员与知识审核员。」；vitest `RULE-01` 13 项全过 |
| RULE-02 | pass | 发布路径唯一性 + **审核员自审放行且留痕**（四眼原则已取消）+ 未过审不外泄 | curl 实测：审核员自建自提自审 → `POST /api/review/:id/approve` **HTTP 200** `{"status":"approved"}`；审计留痕 `李骁 | 审核通过 | 自审通过（提交人 = 审核人，四眼原则已于 08-05-2026 取消）`；同一条目 `sync_tasks` 计数=0（仅过审不入队，发布 API 仍是唯一写入源）；知识管理员发布 → 403 铁律文案；vitest 跳过审核直接发布 → 409「只有审核通过的条目才能发布」 |
| RULE-03 | pass | 脏文件批量导入（模拟飞书迁移）→ 成功进待审、失败逐条报行号原因、无绕审入库 | vitest `RULE-03`：4 行输入 → succeeded=1/failed=3（行号 [2,3,4]，原因=字段不全/章节不存在/可见性非法）；成功条目 status=pending_review、review_source=import |
| RULE-04 | pass | 三种可见性同步载荷内容断言（内部口径零容忍） | 沙箱 Zendesk 实际载荷核验：**9 篇文章内部口径泄漏 0 篇**；KB-0201 对外正文含「质量问题」=True、含内部段落「主管审批」=False；vitest 内部段落剥离 5 项 + 门禁第②查 |
| RULE-05 | pass | 账号体系：创建（必选角色+范围）→ 首次强制改密 → 禁用后在途会话即时失效 → 审计留痕；脱敏纯函数；DPA 留档 | vitest `RULE-05`：创建 200、空范围 400、新账号 mustChangePassword=true、禁用后原会话 `GET /api/auth/me` → 401、审计含「创建用户/禁用用户」2 条；脱敏单测（邮箱/SN/Wi-Fi/手机号全打码）通过；**DPA 证据未就绪——见「不满足上线条件项」如实记录** |
| RULE-06 | pass | 同步失败/阻断/drift 双处置/并发冲突/映射缺失 五类构造 | vitest `RULE-06` 6 项全过：429 → 任务 failed 且原因含 429、Zendesk 端上一版仍在服务；英文未确认 → blocked 且无「阻断但已同步」中间态；drift 扫描检出远端改写；drift 拉回 → 条目 pending_review/source=feedback + 审计含「drift 处置」；并发编辑 → 409 且先提交者内容未被覆盖；映射缺失 → failed「结构映射缺失…请先在章节管理修复映射」 |
| RULE-07 | pass | 全链路留痕 + append-only 数据库层强制 | psql 实证：日志 18 条；`UPDATE audit_logs SET action='被篡改'` 后首条动作仍为「初始化种子数据」；`DELETE FROM audit_logs` 后条数仍为 18；字段级前后值样例：`王雯 | 调整章节层级 | 所属目录 | 售后政策 → 订单与物流`、`王雯 | AI 翻译 | 英文状态 | none → pending_human`、`李骁 | 版本回滚 | 生效版本 | v4 → v1（以 v5 重新生效）`；vitest 断言六类动作留痕齐全 |

## 统计

- 总数：17
- pending：0
- pass：17
- fail：0

## 本轮验证命令与结果汇总（最终干净重跑，2026-08-05T05:03Z）

| 门禁 | 命令 | 结果 |
| :--- | :--- | :--- |
| 依赖 | `pnpm install --frozen-lockfile` | exit=0 |
| 类型 | `pnpm -r typecheck`（contracts + server + web） | exit=0 |
| 构建 | `pnpm build`（contracts→web→server） | exit=0，vite 126 modules |
| 迁移 | `pnpm --filter @kb/server db:migrate` | exit=0，**22 张表**（含删向量破坏性 DDL，幂等） |
| 种子 | `pnpm --filter @kb/server db:seed` | exit=0，5 用户 / 3 库 / 13 章节 / 6 条目 / 4 批次 / 3 篇沙箱文章 |
| 单元+集成 | `pnpm --filter @kb/server test`（vitest） | exit=0，**69 passed (69)**，2 文件 |
| 生产启动 | `node dist/index.js` @ :3311 | healthz 200 `{status:ok, zendesk:sandbox, llm:local}`，根路径 200，运行期 level≥50 计数=0 |
| E2E | `node e2e/flows.mjs`（Playwright Chromium） | exit=0，**8/8 通过**（SMOKE-02 + FLOW-01…07） |
| 视觉 | `node e2e/capture.mjs` + 独立视觉验收官（两轮） | 20 张截图对；第 1 轮 review=fail/blocking=3 → 修复 → 第 2 轮 **review=pass; blocking=0** |
| 接口越权 | curl 四角色 × 8 类越权动作 + 新端点 | 8/8 → 403；新增 `PATCH /kb/chapters/:id/parent` 越权 → 403；只读矩阵 → 200 |
| 审计不可变 | psql UPDATE/DELETE 尝试 | 均被数据库规则拒绝，条数与内容不变 |
| lint | — | 项目未配置 eslint（package.json 有 lint 脚本但未安装依赖），本轮**未执行**，如实记录 |

## 本轮修复的真实缺陷（开发过程中发现，非验收失败项）

1. **挖掘批次日期在 UTC+8 下整体回退一天**：`listBatches` 对 DATE 列做 `toISOString().slice(0,10)`，本地午夜转 UTC 后退一天，界面上每个批次日期都早一天。改由 PG `to_char(batch_date,'YYYY-MM-DD')` 直接输出文本。（既有缺陷，本轮验证批次时发现）
2. **角色说明残留四眼原则文案**：`contracts/src/rbac.ts` 的 `ROLE_NOTES.kb_reviewer` 未随本轮改动更新，工作台仍向用户宣告「自己提交的条目须另一名审核员通过」，与实际行为（可自审）矛盾。由 DESIGN-01 第 1 轮视觉验收官发现。
3. **新建条目门禁区永久停在「门禁检查加载中…」**：新条目本就没有门禁可跑，`gate` 恒为 null 导致加载态不结束。改为说明性文案。
4. **运行时可见文案的向量残留**：保存草稿 toast 与审计日志备注仍写「向量置待重建」。已清理。

## 不满足上线条件项（如实记录，非验收失败项）

- **LLM 供应商 DPA + 输入不用于训练条款证据**（NFR-002 / PRD §9.7 硬条件）：属商务签约动作，本环境无凭据与合同文件，无法产出证据。系统侧已实现的部分：LLM provider 抽象（Anthropic 真实实现 + 本地确定性 provider），`/healthz` 如实暴露 `llm: local`。**上线前必须补齐 DPA 证据，否则不满足上线条件。**
- **本轮 LLM 用途扩大，DPA 覆盖面须同步扩展**：新增「条目 AI 摘要生成」与「挖掘语义查重判定」两类调用，二者都会把条目正文/客服会话摘要送至供应商。签约条款须覆盖这两类用途。
- **语义查重当前未真实生效**：无 `ANTHROPIC_API_KEY`，`/healthz` 为 `llm: local`，查重退回字面相似度并在候选卡与说明条如实标注「语义查重未生效」。配置凭据后即切真实语义判定，**但 LLM 打分稳定性与阈值 0.85 的实际契合度须在真实供应商下重新校准**（本轮只验证了链路与降级诚实性）。
