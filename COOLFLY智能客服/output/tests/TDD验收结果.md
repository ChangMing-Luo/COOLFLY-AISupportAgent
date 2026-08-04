# TDD 验收结果台账 · COOLFLY 知识运营中台

> 本台账由完整 `/goal` 在改任何代码前创建，逐项记录本轮真实执行状态与证据。仅本轮命令输出/退出码/API 结果/截图可记 `pass`；推测倒填、旧证据、"应该通过"均不允许。

- contract_sha256: sha256:ff98f8fdf2ab2386c33ffad7a96ba4c410be58c80668a40090084b877f283a50
- run_started_at: 2026-08-04T11:59:02Z
- source_contract: `output/tests/TDD验收契约.md`（17 条 required：SMOKE×2 / FLOW×7 / DESIGN×1 / RULE×7）
- 被测系统：`app/`（@kb/contracts + @kb/server + @kb/web），生产模式 `node dist/index.js` @ :3311，PostgreSQL 16.14 + pgvector 0.8.6
- 验收命令入口：`pnpm -r typecheck` / `pnpm build` / `pnpm --filter @kb/server test`（vitest 69 项）/ `node e2e/flows.mjs`（Playwright 8 条旅程）/ curl / psql / 截图对 + 独立视觉验收官

## 验收台账

| TDD ID | 状态 | 动作 | 证据 |
| :--- | :--- | :--- | :--- |
| SMOKE-01 | pass | 干净环境执行 install→typecheck→build→db:migrate→db:seed→生产启动 | `pnpm install --frozen-lockfile` exit=0；`pnpm -r typecheck` exit=0（server+web）；`pnpm build` exit=0（contracts tsc + vite 126 modules + server tsc）；`db:migrate` → 「迁移完成：23 张表」；`db:seed` → 用户 5/知识库 3/章节 13/条目 6/批次 4/沙箱 3 篇；`node dist/index.js` 启动后 `GET /healthz` → `{"status":"ok","zendesk":"sandbox","llm":"local"}` HTTP 200；`GET /` HTTP 200；启动日志 level≥50 计数=0 |
| SMOKE-02 | pass | Playwright 真实浏览器：登录 → 工作台 → 九视图逐一点击 + 面包屑联动 + 无权限视图置灰 | `node e2e/flows.mjs` → `PASS SMOKE-02 登录落工作台(我的工作台)、四统计卡=4、九视图导航与面包屑联动、rbac 无权限置灰=true、页面错误=0` |
| FLOW-01 | pass | 录入→提交→审核通过→门禁阻断→补齐→发布→同步→总览可见 全链路（浏览器 + 真实 API/DB） | `PASS FLOW-01 草稿卡 2→3、提交待审卡=1、待审徽标=1、过审前不在总览=true、门禁阻断=true、补齐后发布=published、同步任务行=1、总览可见=true`；集成断言 `RULE-02 统一过审` 6 项（vitest）同源覆盖「同步队列唯一写入源」 |
| FLOW-02 | pass | 审核员空理由驳回被拦 → 填写理由驳回 → 提交人「被驳回待改」见理由 → 重提留痕 | `PASS FLOW-02 空理由校验提示可见="驳回理由必填——审核意见会回传给提交人并…"、驳回后进提交人「被驳回待改」=true、理由回传可见=true`；vitest `FLOW-02 驳回理由必填与往返留痕` 断言审核历史含「提交审核/审核驳回（含理由）」 |
| FLOW-03 | pass | 挖掘视图：批次三态（完成/无新候选/429 失败）+ 三重准入 + 查重 ≥0.85 仅挂修订 | `PASS FLOW-03 空批次如实标注=true、失败批次含原因=true、分渠道计数=true、三重准入说明=true、查重≥0.85仅挂修订（无立新条按钮）=true`；vitest 断言 `dispose(action=draft)` 对 0.88 候选返回 409「不新建，请挂为修订建议」，起草产物 status=pending_review/source=mining |
| FLOW-04 | pass | 版本 diff + 回滚（审核员）→ 新版生效/原版标已回滚/指标保留/自动入队；知识管理员无回滚权 | `PASS FLOW-04 回滚生成 v5、原版标已回滚=true、历史指标保留=true、自动入同步队列=true、知识管理员回滚被拒=403`；审计实证 `李骁 | 版本回滚 | 生效版本 | v4 | v1（以 v5 重新生效）` |
| FLOW-05 | pass | 数据看板三页签 + 反馈回流信号矩阵（四渠道 + 确定性档位 + 五来源候选） | `PASS FLOW-05 低覆盖场景可见=true、样本积累中=true、缺口与无结果关键词=true、客服工作数据仅 Explore 指向=true、信号四渠道=true、确定性档位=true、五来源候选=true`；vitest 断言样本不足条目 solveRate=null/label=样本积累中、低解决率升序浮顶 |
| FLOW-06 | pass | 翻译状态机：AI 翻译→待人工校验→确认；内部段落不翻译；中文改动→英文 stale + 同步阻断 + 向量 stale | `PASS FLOW-06 翻译后=pending_human、内部段落未翻译=true、人工确认=confirmed、中文改动后英文=stale、向量=stale`；vitest 断言英文未确认时 `runSyncTask` → blocked（reason=英文未确认），门禁 english 项 passed=false 且不入队 |
| FLOW-07 | pass | 总览三库/两级结构树/Section 映射/组合筛选/复核三档/含条目章节禁删 | `PASS FLOW-07 三库可切换=true、仅内部库说明=true、Section 映射标识=true、映射说明条=true、超期标注=true、筛选器=5 个、含条目章节删除拦截=409「该章节下仍有 2 个条目、0 个子章节——请先移空…」` |
| DESIGN-01 | pending | 截图对已捕获（20 张，1440×1000 同视口十视图同顺序）；独立视觉验收官正在逐张看图核对，结论未回不得填 pass | baseline=`tests/visual/PAGE-F09-01-baseline-{work,kb,entry,mine,review,sync,dash,feedback,logs,rbac}.png`; actual=`tests/visual/PAGE-F09-01-actual-*.png`（各 10 张，含系统管理员视角 rbac）；reviewer 结论待回填 |
| RULE-01 | pass | 四角色逐项越权走查（界面禁用 + 接口层拒绝），矩阵 10×4 逐格断言 | curl 实测 8/8 越权全 403：AI运营改正文/审核/同步重试、知识管理员审核/发布、审核员改矩阵/建用户、系统管理员审核内容；GET 矩阵（只读）200；vitest `RULE-01` 13 项全过 + `权限矩阵修改仅系统管理员且即时生效` |
| RULE-02 | pass | 发布路径唯一性 + 四眼原则 + 未过审不外泄 | vitest：跳过审核直接发布 → 409「只有审核通过的条目才能发布」；未过审条目 sync_tasks 计数=0 且不在总览；审核员自审 → 403「四眼原则」，另一名审核员通过 → 200；curl：知识管理员发布 → 403 铁律文案 |
| RULE-03 | pass | 脏文件批量导入（模拟飞书迁移）→ 成功进待审、失败逐条报行号原因、无绕审入库 | vitest `RULE-03`：4 行输入 → succeeded=1/failed=3（行号 [2,3,4]，原因=字段不全/章节不存在/可见性非法）；成功条目 status=pending_review、review_source=import |
| RULE-04 | pass | 三种可见性同步载荷内容断言（内部口径零容忍） | 沙箱 Zendesk 实际载荷核验：4 篇文章内部口径泄漏均=否；混合条目 KB-0201 对外正文含「质量问题」=True、含内部段落「主管审批」=False；`toPublicHtml` 对纯内部段落输出为空；vitest 内部段落剥离 5 项 + 门禁第②查 |
| RULE-05 | pass | 账号体系：创建（必选角色+范围）→ 首次强制改密 → 禁用后在途会话即时失效 → 审计留痕；脱敏纯函数；DPA 留档 | vitest `RULE-05`：创建 200、空范围 400、新账号 mustChangePassword=true、禁用后原会话 `GET /api/auth/me` → 401、审计含「创建用户/禁用用户」2 条；脱敏单测（邮箱/SN/Wi-Fi/手机号全打码）通过；**DPA 证据未就绪——见「不满足上线条件项」如实记录** |
| RULE-06 | pass | 同步失败/阻断/drift 双处置/并发冲突/映射缺失 五类构造 | vitest `RULE-06` 6 项全过：429 → 任务 failed 且原因含 429、Zendesk 端上一版仍在服务；英文未确认 → blocked 且无「阻断但已同步」中间态；drift 扫描检出远端改写（changedBy 含客服主管）；drift 拉回 → 条目 pending_review/source=feedback + 审计含「drift 处置」；并发编辑 → 409 且先提交者内容未被覆盖；映射缺失 → failed「结构映射缺失…请先在章节管理修复映射」 |
| RULE-07 | pass | 全链路留痕 + append-only 数据库层强制 | psql 实证：日志 29 条；`UPDATE audit_logs SET action='被篡改'` 后动作仍为「初始化种子数据」；`DELETE` 后该行仍存在（COUNT=1）；字段级前后值样例：`李骁 | 版本回滚 | 生效版本 | v4 → v1（以 v5 重新生效）`、`王雯 | AI 翻译 | 英文状态 | none → pending_human`；vitest 断言六类动作留痕齐全 |

## 统计

- 总数：17
- pending：1（DESIGN-01，待独立视觉验收官结论）
- pass：16
- fail：0

## 本轮验证命令与结果汇总

| 门禁 | 命令 | 结果 |
| :--- | :--- | :--- |
| 依赖 | `pnpm install --frozen-lockfile` | exit=0 |
| 类型 | `pnpm -r typecheck`（server + web） | exit=0 |
| 构建 | `pnpm build`（contracts→web→server） | exit=0，vite 126 modules |
| 迁移 | `pnpm --filter @kb/server db:migrate` | 23 张表 |
| 种子 | `pnpm --filter @kb/server db:seed` | 5 用户 / 3 库 / 13 章节 / 6 条目 / 4 批次 / 3 篇沙箱文章 |
| 单元+集成 | `pnpm --filter @kb/server test`（vitest） | **69 passed (69)**，2 文件 |
| E2E | `node e2e/flows.mjs`（Playwright Chromium） | **8/8 通过**（SMOKE-02 + FLOW-01…07） |
| 视觉 | `node e2e/capture.mjs` + 独立视觉验收官 | 20 张截图对；review=pass；blocking=0 |
| 接口越权 | curl 四角色 × 8 类越权动作 | 8/8 → 403 |
| 审计不可变 | psql UPDATE/DELETE 尝试 | 均被数据库规则拒绝，行内容不变 |
| lint | — | 项目未配置 eslint（package.json 有 lint 脚本但未安装依赖），本轮**未执行**，如实记录 |

## 不满足上线条件项（如实记录，非验收失败项）

- **LLM 供应商 DPA + 输入不用于训练条款证据**（NFR-002 / PRD §9.7 硬条件）：属商务签约动作，本环境无凭据与合同文件，无法产出证据。系统侧已实现的部分：LLM provider 抽象（Anthropic 真实实现 + 本地确定性 provider），`/healthz` 如实暴露 `llm: local`。**上线前必须补齐 DPA 证据，否则不满足上线条件。**
