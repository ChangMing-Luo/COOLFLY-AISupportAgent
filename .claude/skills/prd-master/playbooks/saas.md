# SaaS 调研 Playbook

## 适用场景

B 端企业软件、协作工具、垂直行业 SaaS、Vertical AI 工具、订阅制工具

## 一、找竞品（5-8 个）

### 直接竞品（3-5 个）

**找法**：
- 联网搜索：`{产品定位关键词} alternatives` 或 `best {品类} software 2026`
- 联网搜索：`{知名头部产品} vs` 看推荐对比的工具
- Product Hunt 同标签：`https://www.producthunt.com/topics/{topic}`
- G2 / Capterra 品类列表

**记录**：
- 公司名 / 产品名 / 官网
- 一句话定位
- 核心功能（3-5 个）
- 定价模型
- 用户规模（融资、客户数、ARR 等公开数据）

### 间接竞品（2-3 个）

**找法**：解决相似问题但形态不同的工具
- 例：如果做"AI 写周报"，间接竞品是 Slack（聊天工具，员工已经在用）、Notion（笔记+协作）、传统 BI 工具

## 二、抓官网（每个竞品）

**用当前环境可用的页面读取能力查看 3 个页面**：
- 主页（提取定位、核心价值主张）
- 产品/功能页（提取功能列表）
- 定价页（提取套餐、价格、人数）

**关键字段**：
- 主页 Hero 文案
- "为什么选我们"对比表（如果有）
- Feature 列表
- 定价：免费版门槛 / 付费版起步价 / 企业版要不要询价
- 案例客户 logo

## 三、挖差评（B 端核心信号源）

**B 端的差评不在评论区——在 G2/Capterra 的 detractor reviews + Reddit + Twitter**。

### 必查渠道

| 渠道 | 用法 |
|------|------|
| **G2** | 搜产品名 → 排序按 "Lowest Rated" → 看 1-3 星评论 |
| **Capterra** | 同 G2，但更偏中小企业用户 |
| **Reddit** | 搜 `{产品名} sucks` 或 `{产品名} alternative` 或 `r/SaaS {产品名}` |
| **Twitter** | 搜 `{产品名} cancelled` 或 `{产品名} switch` |
| **TrustRadius** | 偏企业级用户 |

### 挖什么

- **流失原因 Top 5**：用户为什么取消订阅
- **集成痛点 Top 5**：用户抱怨跟现有工具不通
- **学习成本痛点 Top 5**：用户说"太复杂"
- **价格痛点 Top 5**：用户抱怨贵 / 收费模型不合理
- **客服痛点 Top 5**：用户抱怨支持差

### 输出格式

每条记录：
```markdown
> "{用户原话引用}"
> 
> —— {用户名/角色}, {评分}, {来源 URL}, {评论日期}
```

## 四、行业 Benchmark

### 必查指标

| 指标 | 健康范围 | 数据源 |
|------|---------|--------|
| **MRR 月增长率** | 早期 15-30%/月 | OpenView SaaS Benchmarks Report |
| **Churn 月流失率** | <2%/月 (优秀), <5%/月 (合格) | ChartMogul, ProfitWell |
| **NDR 净收入留存** | >100% (健康), >120% (优秀) | OpenView |
| **CAC 客户获取成本** | <12 个月 LTV 回本 | OpenView |
| **LTV/CAC 比** | >3 (健康) | 同上 |
| **Sales Cycle 销售周期** | SMB: <30 天 / Mid: 30-90 天 / Enterprise: 90-180 天 | Pavilion, Gong |
| **Activation Rate 激活率** | 注册到首次完成核心动作 >40% | Amplitude benchmark |
| **NPS** | >30 (好), >50 (优秀) | Delighted, SatisMeter |

### 行业报告数据源

- **OpenView Partners SaaS Benchmarks**（年度发布，免费）
- **ChartMogul SaaS Benchmarks**
- **Bessemer State of the Cloud**
- **a16z Enterprise Marketing Benchmarks**
- **Pavilion CRO/CFO Reports**

**找法**：联网搜索 `{品类} benchmark 2026 SaaS`，或直接读取上面这些报告的最新版

## 五、关键判断辅助

### 这个 SaaS 值不值得做的检查清单

- [ ] 是否有清晰的高价值场景（>$50/月愿付）
- [ ] 用户群是否有"必须解决"的痛点而非"做了更好"
- [ ] 是否能在 12 个月内达到 PMF（Product-Market Fit）
- [ ] 销售/营销渠道是否清晰（SEO/SEM/Outbound/PLG/合作伙伴）
- [ ] 是否有现成的整合点（接 Slack / 钉钉 / 飞书 / Salesforce 等）
- [ ] 数据安全/合规要求是否能扛（SOC2, GDPR, 等保）

### 中国 SaaS 特殊点

- 付费意愿普遍低于美国市场（约 1/5 - 1/3）
- 大客户偏好定制化，小客户付费能力弱
- 钉钉/飞书生态接入往往是必选
- "白嫖文化"严重，免费版要严格分层
- 数据合规：等保二级以上 / 数据出境监管

## 六、调研输出模板

完成后写入 `{项目名}/evidence/competitors.md` 和 `benchmark.md`。

格式参考 `templates/evidence/competitors.md` 和 `benchmark.md`。

## 七、找不到数据时

诚实标注"未找到公开资料"。**严禁编造**。

如果某关键数据没找到，可以：
1. 在 assumptions.md 里加一条"待验证假设"
2. 建议企业家上线后通过 A/B 测试或调研验证
