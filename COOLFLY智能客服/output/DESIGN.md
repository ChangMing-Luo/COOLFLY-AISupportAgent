# Design System Inspired by COOLFLY 智能客服

> Category: Media & Consumer
> 冰青底上的青蓝安抚系统（2026-08-04 按用户提供的现有 App 截图完成品牌校准）：为带着挫败进来的中老年用户设计的高可读支持对话界面，浅色单模式，色彩响应交互；粉紫→淡青渐变开场卡 + 机器鸟吉祥物位 + 来源徽章 + Done / It didn't work 大按钮节奏是它的签名。

---

## 1. 视觉主题与氛围

**核心隐喻：清晨的后院，鸟鸣与晨光。**

想象一位六十多岁的北美用户，此刻的处境：她刚买的 COOLFLY 智能喂鸟器配对失败了，折腾了半小时，手机在手里发烫，耐心在流失。她点开 "Get help"——这一刻，界面必须像一位坐在她身边、语速放慢、把手机转过来指给她看的耐心店员，而不是一个闪烁着高科技光效的机器人。

所以这套设计系统的物理感觉是：**一张摊在晨光里的白纸说明书，页边留着大片空白，重点句子用大号字写，每一步只讲一件事。** 背景是极浅的、通透干净的冰青（#EAF6F8），像清晨窗边的水汽与天光；消息卡是纯白的纸面（#FFFFFF），浮在背景之上但不投夸张的影子；品牌青蓝（#0D7594，2026-08-04 按现有 App 截图校准）只出现在最需要它的地方——那颗告诉你"下一步在这里"的大按钮上。

**用户情绪：从挫败到被接住的踏实感。**

用户是带着故障、带着怒气、甚至带着退货念头进来的（PRD §2.3 旅程 C 是真实差评还原）。因此这套系统的第一情绪使命不是"愉悦"，而是**安抚与可靠**：

- **冷静**：界面上任何时刻都不出现兴奋、催促、闪烁的元素。没有弹跳动画，没有渐变霓虹，没有大面积警示红。哪怕在情绪路径（用户打出 "I want a refund"）里，出口置顶卡也用中性纸面 + 青蓝行动按钮呈现——因为此刻刺激性的红色只会给怒气添柴。
- **掌控**：每一步排障卡只呈现一个动作决策（Done / It didn't work），用户永远知道自己在哪、下一步按哪。进度指示、恢复提示条、转人工常驻入口，都是"你不会被丢下"的视觉承诺。
- **诚实**：来源徽章（"Source: Setup Guide"）把 AI 回答的依据亮在明处；等待承诺按真实通路展示。视觉上用小而清晰的徽章而非炫技的引用卡——诚实应该低调而笃定。

**为什么是浅色单模式（设计决策的理由）：**

不是因为浅色安全，而是因为这个产品的核心用户是**中老年、老花镜、户外或窗边强光环境**（喂鸟器装在后院，排障场景经常发生在窗边看着设备的时候）。浅色高对比是这类人群与场景下可读性的最优解：正文 #13252B 对背景对比度 14.3:1，远超 WCAG AA。深色模式跟随主 App 能力后置（蓝图 §6 拍板），本期不做，避免双模式维护摊薄单模式的打磨深度。

**为什么是冰青与青蓝：**

COOLFLY 现有 App 的客服页（"Device Support"，2026-08-04 用户截图为源）已经把品牌语言立好了：浅冰青的页面底、白色大圆角卡、亮青蓝的行动色、粉紫→淡青的渐变问候区——轻盈、友好、通透。本系统与它同频：冰青是天空与水汽的颜色，天然冷静；青蓝在支持场景有第二重语义红利——它是"可信、专业、往前走"的颜色。当用户满心挫败时，一颗青蓝大按钮说的是"这事能解决"。截图的亮青（≈#4CC8E8）对白底仅 1.96:1，不能承载交互文字；校准策略是保留青蓝色相、调深到 #0D7594（对白底 5.26:1）做交互用色，亮青气质由浅色面（bg / surface-warm / 渐变端点）保留。

**风格定位：**

在行业坐标系里，这套系统站在 **Apple 人机界面指南（大字号、系统字体、44pt 触达）× 患者/长者友好医疗界面（单任务流、双选决策）× 现代客服产品（Intercom 的会话流骨架）** 的交点上。它刻意远离两类原型：Linear 式的微光玻璃拟态（对老花眼是噪音），以及游戏化客服机器人（对怒气用户是冒犯）。它超越普通客服界面的地方在于：把"排障步骤卡"当成产品的主角来设计——大字、配图、双选节奏——而不是把一切塞进气泡。

**色彩速览表：**

| 色值 | 角色 |
| :--- | :--- |
| #EAF6F8 | 页面背景（浅冰青，通透底色） |
| #FFFFFF | 卡片/气泡纸面 |
| #E0F1F6 | 温感面板（AI 气泡、徽章底，极浅青） |
| #13252B | 正文主色（近黑，带青调） |
| #4E6870 | 次要文字（灰青） |
| #0D7594 | 品牌青蓝 · 主行动色（2026-08-04 按截图校准） |
| #F3EAF8 → #E0F3F8 | 开场问候渐变端点（淡粉紫→淡青，品牌校准新增） |
| #177A57 | 成功（解决确认，偏青的柔和绿） |
| #8A5F1A | 警示（看板超区间等，柔和琥珀） |
| #B2453A | 危险（柔和陶土红；仅小面积状态文字/看板标红，禁大面积） |

**参考先例：**

- **Apple HIG（健康类 App 排版）**：汲取系统字体栈、17pt 正文基准、44pt 触达下限、Dynamic Type 不破版的工程纪律。
- **Intercom / 现代会话式支持产品**：汲取会话流承载一切（卡片、提示条、置顶卡皆为流内元素）的信息架构。
- **Headspace 的冷静色彩纪律**：汲取"单一柔和主色 + 大量留白"的情绪降噪手法，但把它的插画趣味换成器物级的朴素——我们的用户在修设备，不是在冥想。

---

## 2. 色彩美学

**色彩哲学：青蓝是承诺，中性色是空气，语义色是耳语。**

这套色板的每个值都有一个功能使命和一个情绪使命：

- **#0D7594（--accent，2026-08-04 按截图校准）**不是随机的蓝——它是截图亮青（≈#4CC8E8）沿同一色相调深的达标版：亮青对白底仅 1.96:1，无法承载链接与按钮文字；调深到 #0D7594 后白字对比度 5.26:1，可直接做按钮底色，同时保住"亮青蓝"的品牌辨识。它的情绪使命是"这事能解决"，功能使命是**指出唯一的主行动**。
- **#EAF6F8（--bg）**是截图页面底的浅冰青。纯灰是机房的颜色，掺入青绿水汽之后它变成了窗边的天光——通透、干净，与现有 App 客服页同频。开场问候区在它之上叠一层 **#F3EAF8→#E0F3F8（--grad-hello-start/end，品牌校准新增）** 的柔和粉紫→淡青渐变，复刻截图的问候卡气质。
- **#B2453A（--danger）**是柔和的陶土红而非信号红。它的使用纪律写死：**只用于小面积状态文字与看板超区间标红；情绪路径界面（出口置顶卡、共情消息）本身禁止任何大面积红色**——对怒气用户，红色是火上浇油。共情场景的视觉语言只允许中性纸面 + 绿色行动按钮。

**强调色纪律（硬约束）：**

`--accent` 每屏最多 2 处可见使用。典型组合：1 个主行动大按钮（Done / Send & connect / Talk to a human）+ 1 个来源徽章或内联链接。链接、hover 变色、focus ring 全部计入 accent 用量。占比上限声明：**中性色占画面 70–90%，accent 占 5–10%，语义色占 0–5%**。排障步骤卡上双按钮并列时，只有 Done 用 accent 实底，It didn't work 用中性描边——这既是用量纪律，也是"推荐下一步"的视觉语义。

**Surface 色板：**

| Token | Hex | 设计理由 |
| :--- | :--- | :--- |
| --bg | #EAF6F8 | 页面底色（浅冰青）；与纯白卡片形成 1.10:1 的极轻层差，靠色温而非阴影分层 |
| --surface | #FFFFFF | 消息卡/步骤卡/看板图卡纸面；最高可读性载体 |
| --surface-warm | #E0F1F6 | AI 气泡与徽章底的温感浅青；让 AI 的话比系统色更"有人味" |
| --surface-raised | #FFFFFF | 抬升态（下拉/悬浮层）；浅色模式下与 surface 同值，靠边框与阴影 token 区分 |
| --surface-overlay | #FFFFFF | 模态/底部抽屉（转人工确认面板）最高层 |
| --border | #CBE2E9 | 描边青灰；分隔而不切割 |
| --border-soft | #DFEEF3 | 卡内分隔线（摘要卡字段行间） |

**Data / Accent 色板：**

| Token | Hex | 情感定义 |
| :--- | :--- | :--- |
| --accent | #0D7594 | 承诺与前进；唯一主行动色（2026-08-04 按截图校准） |
| --accent-hover | color-mix 压暗 8% | 手指按上去时颜色沉一分——色彩响应哲学的核心表达 |
| --accent-active | color-mix 压暗 14% | 确认按下；沉两分 |
| --success | #177A57 | 解决确认的低语（偏青的柔和绿），避免与主按钮争抢语义 |
| --warn | #8A5F1A | 看板"超预期区间/数据回补中"的克制琥珀 |
| --danger | #B2453A | 柔和陶土红耳语；小面积状态专用，情绪界面禁大面积 |

**Text 色板：**

| Token | Hex | 可读性分析（对主要背景） |
| :--- | :--- | :--- |
| --fg | #13252B | 对 --bg 14.34:1，对 --surface 15.82:1——老花镜与强光下的安全余量 |
| --fg-2 | #31474E | 对 --surface 9.80:1；卡片副标题层 |
| --muted | #4E6870 | 对 --bg 5.38:1、--surface 5.94:1；辅助说明仍稳过 AA |
| --meta | #5A737B | 对 --surface 5.03:1、--bg 4.56:1；时间戳/来源徽章文字，AA 达标 |

对比度验证（WCAG 2.2 AA，2026-08-04 品牌校准后用公式逐对重算）：全部文本/背景配对 ≥ 4.5:1，最低的一对是 --accent 作交互文字对 --surface-warm（4.53:1）；--accent 对 --surface 5.26:1、对 --bg 4.77:1；--accent-on（#FFFFFF）对 --accent 按钮底 5.26:1，普通字号按钮达标；--fg 对渐变端点 --grad-hello-start / --grad-hello-end 分别 13.51:1 / 13.82:1。

本系统为**浅色单模式**：不提供 `[data-theme="dark"]` 覆盖块。原因：核心人群与强光使用场景下浅色高对比是可读性最优解，深色跟随主 App 能力后置（蓝图 §6 已拍板）；单模式让 56 个 token 的每一个值都被真实打磨而非对称复制。全部 CSS 变量收纳于 tokens.css 的单一 `:root {}` 块。

---

## 3. 排版与字体

**字体哲学：系统字体是对中老年用户的尊重，不是偷懒。**

SF Pro（iOS）与 Roboto（Android）是这批用户的眼睛读了十年的字形——肌肉记忆就是可读性。引入任何品牌字都会增加认知摩擦并破坏系统字号缩放（Dynamic Type / fontScale）的原生表现，而"系统字号缩放至最大档不破版"是 PRD 的硬验收（AC-C-01）。等宽字体只服务一处：SN 序列号与看板数值——数字像刻度一样对齐，传达"这是准确的数据"。

**字体栈（Display / Body / Mono）：**

```
Font labels for catalog extraction:

Display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
Body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
Mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace
```

**字号梯度（8 级）：**

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| --text-xs | 13px | 徽章、时间戳（下限，不再小） |
| --text-sm | 15px | 辅助说明、看板轴标签 |
| --text-base | 17px | 正文基准（PRD 定稿：对话正文 17pt） |
| --text-lg | 20px | 步骤卡说明大字（PRD 定稿：20pt+） |
| --text-xl | 24px | 步骤卡标题、抽屉标题 |
| --text-2xl | 28px | 对话页开场标题 |
| --text-3xl | 34px | 看板核心数值 |
| --text-4xl | 40px | 看板北极星大数 |

为什么是这个梯度：基准直接取 PRD 写死的 17pt，向下只留两级（13/15）——这个产品没有"小字场景"的合法性；向上按 ~1.18–1.2 比率爬升，保证系统字号缩放 1.35 倍后 20px→27px 仍在卡片布局承受范围内（弹性布局 + 不定高卡片，见 §5）。

**Letter-spacing 硬规则（精确数值表）：**

| 场景 | 数值 |
| :--- | :--- |
| ALL CAPS 文本（徽章 "SOURCE"） | 0.06em（无例外） |
| Display 大字（40px+ 看板大数） | -0.02em |
| 标题（24–34px） | -0.01em |
| 小文本（13px 徽章/时间戳） | 0.02em |
| UI 标签/按钮 | 0.02em |
| 正文（15–20px） | 0 |

**Line-height 规范：** 正文 `--leading-body: 1.55`——排障说明常为两三行完整句子，宽行距给老花眼留出行间呼吸，营造"说明书被人重新排过版"的从容感；标题与按钮 `--leading-tight: 1.25`，让大字标题结成一个视觉块。看板数值用 1.1 的紧行距（在组件内覆写为 tight），数字要像仪表读数一样紧凑笃定。

---

## 4. 间距体系

**间距哲学：间距是这套系统的语速。**

对挫败中的用户，界面"说话"必须慢而清楚——4px 基准之上，这套系统刻意偏大：消息与消息之间 12px，卡片内边距 20px，步骤卡按钮区上方留 24px。留白不是浪费屏幕，是把"一次只讲一件事"翻译成像素。4px 基准的理由：与 iOS/Android 原生网格兼容，所有触达高度（44pt）与内距都能落在整数倍上，RN 与 Web 看板共享同一套刻度。

**4px 基准间距（space-1 到 space-12）：** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px（见 tokens.css）。

**Section rhythm：**

| 设备 | 垂直节奏 | 理由 |
| :--- | :--- | :--- |
| desktop（看板 1280+） | 64px | 图卡区块间大呼吸，周报浏览是扫读节奏 |
| tablet | 48px | 过渡档（本期无承诺形态，仅保刻度连续） |
| phone（对话 375–430pt） | 32px | 会话流内以消息间距为主节奏，区块间距收紧以保首屏信息量 |

---

## 5. 布局与空间构成

**布局哲学：一条河（对话页）与一张桌（看板页），共用同一套河床石头。**

手机端对话页是**单列时间流**——消息、步骤卡、置顶卡、提示条全部是流内元素（PRD §5.3 R5-S1 写死：不做独立全屏排障模式）。这里的"Bento"不是多列网格，而是**流内卡片的模块化纪律**：每张步骤卡、摘要卡、图卡都是一个独立认知单元，携带自己的圆角、纸面与内距，用户的注意力一次只需落在一个格子里——这正是 Bento 思想对认知减负的本义，只是格子排成了一条竖直的河。

桌面看板页则是标准 **Bento Grid**：12 列网格、24px gap，图卡按 span 4/6/12 组合（双口径趋势 span 8、拒答分层 span 4、四个小图卡各 span 3 等），把周报数据收纳成一眼可扫的秩序。

**网格与断点：**

- 对话页：单列，内容宽度 100%，左右 gutter 16px；375–430pt 竖屏为唯一目标形态。
- 看板页：`--container-max: 1200px` 居中，gutter 32px；1280+ 桌面为唯一承诺形态，1280 以下仅保证不横向溢出，不做移动适配承诺（蓝图 §1）。
- 断点：≥1024px 用 desktop rhythm；768–1023 用 tablet rhythm；<768 用 phone rhythm。

**Container max-width 选择理由：** 1200px 让 12 列网格在 1280 屏上留出 40px 双侧余量；再宽则周粒度折线图被拉稀，数据密度失去仪表感。

**深度与层级：**

浅色系统的 Z 轴靠**纸感**而非发光：层级 0 是冰青背景（--bg），层级 1 是白色卡片（--surface + --elev-ring 一像素描边），层级 2 是常驻置顶元素（情绪出口卡：--elev-raised 弥散淡影，因为它必须"压"在滚动流之上），层级 3 是转人工底部抽屉（--elev-float + 遮罩）。重要的东西浮上来的方式是"更白、更完整的纸面 + 更大的字"，而不是更粗的边框——边框是切割，纸面是承载；对老花眼，一张干净的白卡远比一圈粗线更易聚焦。**hover 不改变阴影与位置**（交互哲学是色彩响应，§6），阴影只属于静态层级，动态反馈只属于颜色。

**响应式行为：** 步骤卡与消息气泡全部不定高、随字号缩放自动生长（min-height 而非 height）；双大按钮在缩放最大档下自动换行为上下堆叠（flex-wrap），保证 44pt 触达与完整文案（AC-C-01 不截断按钮文案）；看板图卡在 <1280 时按 span 降级为单列堆叠。

---

## 6. 组件设计

**组件哲学：** 每个组件都在回答同一个问题——"一位戴老花镜、正在生气的用户，能不能在一秒内看懂它、按准它"。因此所有交互组件共享三条铁律：触达 ≥44px、文字 ≥15px、状态变化用颜色说话。

**交互哲学（全站统一 · 色彩响应型）：** 本品牌的 hover/active/选中反馈**只通过颜色表达**——背景微沉、边框着色、文字变色。禁止阴影提升（`box-shadow` 不参与 hover）、禁止物理位移（`transform: translateY` 不出现在任何交互反馈中）。理由：位移与浮起是"轻快"的语言，而这个产品的语言是"稳"；同时色彩响应在 RN 与 Web 双端的实现成本与一致性最优。所有组件的过渡统一 `background-color / border-color / color` 三属性、时长 `var(--motion-fast)`。

### 6.1 大按钮双选（设计签名 · Done / It didn't work）

排障节奏的心脏：每张步骤卡底部，一颗 accent 实底的 Done 与一颗中性描边的 It didn't work 并列。实底 vs 描边的不对称是刻意的——它无声地说"多数人到这里点 Done"，但绝不把失败选项藏小（两者同高同字号，失败不该有心理惩罚）。圆角 12px：足够友好、不至于软塌。

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-family: var(--font-body); font-size: var(--text-lg);
  font-weight: 600; letter-spacing: 0.02em; line-height: var(--leading-tight);
  border: 1.5px solid transparent; cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-standard),
              border-color var(--motion-fast) var(--ease-standard),
              color var(--motion-fast) var(--ease-standard);
}
.btn-primary { background: var(--accent); color: var(--accent-on); }
.btn-primary:hover  { background: var(--accent-hover); }
.btn-primary:active { background: var(--accent-active); }
.btn-primary:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.btn-secondary { background: var(--surface); color: var(--fg); border-color: var(--border); }
.btn-secondary:hover  { border-color: var(--accent); color: var(--accent); }
.btn-secondary:active { background: var(--surface-warm); border-color: var(--accent); }
.btn-secondary:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.btn-row { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.btn-row .btn { flex: 1 1 45%; min-width: 140px; } /* 字号缩放最大档自动上下堆叠，不截断文案 */
```

### 6.2 排障步骤卡

会话流内全宽消息卡，一步一屏的载体。20px 大字说明 + 顶部进度指示（"Step 2"，无总数分母）+ 底部双按钮。内距 20px、圆角 16px——它是流里最大的纸面，圆角比气泡更大一号，宣告"我是主角"。

```css
.step-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
}
.step-card__eyebrow {
  font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--meta);
}
.step-card__title {
  font-family: var(--font-display); font-size: var(--text-xl);
  font-weight: 700; letter-spacing: -0.01em;
  line-height: var(--leading-tight); color: var(--fg);
}
.step-card__body { font-size: var(--text-lg); line-height: var(--leading-body); color: var(--fg-2); }
.step-card__figure { border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-soft); }
.step-card__figure img { display: block; width: 100%; max-width: 100%; }
/* 卡片本体非交互，无 hover 反馈——色彩响应只属于可点元素 */
```

### 6.3 消息气泡（AI / 用户）

AI 气泡用温感浅青纸面（--surface-warm）而非纯白——AI 的话应该比系统提示更有体温；用户气泡用 accent 实底、白字，让用户在流里一眼找到"我说过什么"。这是 accent 在对话页的第二处合法用量（与主按钮并存时，气泡属历史内容不计入当屏 2 处纪律的行动位）。

```css
.bubble {
  max-width: 85%; padding: var(--space-3) var(--space-4);
  font-size: var(--text-base); line-height: var(--leading-body);
  border-radius: var(--radius-lg);
}
.bubble--ai   { background: var(--surface-warm); color: var(--fg); border-bottom-left-radius: var(--radius-sm); align-self: flex-start; }
.bubble--user { background: var(--accent); color: var(--accent-on); border-bottom-right-radius: var(--radius-sm); align-self: flex-end; }
.bubble__meta { font-size: var(--text-xs); letter-spacing: 0.02em; color: var(--meta); margin-top: var(--space-1); }

/* 开场问候形态（设计签名 · 品牌校准 2026-08-04 新增）：
   仅用于会话开场披露气泡——粉紫→淡青柔和渐变底 + 左侧机器鸟吉祥物圆形头像占位
   （线描小鸟 SVG，全部颜色走 var()；正式吉祥物素材到位后替换图形不动结构） */
.ai-open-row { display: flex; align-items: flex-end; gap: var(--space-2); }
.mascot { flex: none; width: 44px; height: 44px; border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--grad-hello-start), var(--grad-hello-end));
  border: 1px solid var(--border-soft);
  display: inline-flex; align-items: center; justify-content: center; }
.bubble--hello { background: linear-gradient(135deg, var(--grad-hello-start), var(--grad-hello-end)); color: var(--fg); }
```

### 6.4 来源标注小徽章（设计签名）

事实性回答末尾的 "Source: Setup Guide"。它是诚实的物证，也是截图可识别的品牌记号：胶囊形、浅青底、13px 文字加书页圆点。刻意做小——诚实是气质，不是广告。可点（未来接跳转时）但视觉上先是徽章后是链接。

```css
.source-badge {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: 2px var(--space-2); min-height: 24px;
  background: var(--surface-warm);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs); letter-spacing: 0.02em; color: var(--meta);
  transition: border-color var(--motion-fast) var(--ease-standard),
              color var(--motion-fast) var(--ease-standard);
}
.source-badge::before {
  content: ""; width: 6px; height: 6px; border-radius: var(--radius-pill);
  background: var(--accent); flex: none;
}
.source-badge:hover { border-color: var(--accent); color: var(--fg-2); }
.source-badge:active { border-color: var(--accent); color: var(--fg); }
.source-badge:focus-visible { outline: none; box-shadow: var(--focus-ring); }
```

### 6.5 输入框（自由输入 / Add details）

17px 正文字号、48px 起跳高度。聚焦反馈是边框着色 + focus ring——色彩响应哲学在表单上的表达。占位文字用 --meta（对白底 5.15:1，占位也要老花眼能读）。

```css
.input {
  width: 100%; min-height: 48px;
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-body); font-size: var(--text-base);
  line-height: var(--leading-body); color: var(--fg);
  transition: border-color var(--motion-fast) var(--ease-standard),
              background-color var(--motion-fast) var(--ease-standard);
}
.input::placeholder { color: var(--meta); }
.input:hover { border-color: var(--accent); }
.input:active { border-color: var(--accent); }
.input:focus-visible { outline: none; border-color: var(--accent); box-shadow: var(--focus-ring); }
.input:disabled { background: var(--surface-warm); color: var(--muted); cursor: not-allowed; }
.input__count { font-size: var(--text-xs); letter-spacing: 0.02em; color: var(--meta); text-align: right; }
.input__count--over { color: var(--danger); } /* danger 的合法小面积用法 */
```

### 6.6 情绪出口置顶卡

旅程 C 的落点：共情语 + 双按钮（Talk to a human / Refund & return policy）常驻置顶。**全卡无一处红色**——退货政策入口用中性描边按钮呈现，与转人工按钮同排。它是唯一带弥散淡影的流内元素，因为它必须"压"在滚动内容之上（静态层级，非交互反馈）。

```css
.exit-card {
  position: sticky; top: var(--space-2); z-index: 10;
  background: var(--surface-overlay);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--elev-raised); /* 静态层级阴影，不随交互变化 */
  display: flex; flex-direction: column; gap: var(--space-3);
}
.exit-card__text { font-size: var(--text-base); line-height: var(--leading-body); color: var(--fg); }
.exit-card .btn-row .btn { min-height: 44px; font-size: var(--text-base); }
```

### 6.7 看板图卡与数值

B 端数据页由同一套 token 派生：同纸面、同描边、同圆角，只是字号档位切到 3xl/4xl 数值区。超预期区间标红是 --danger 在看板的唯一合法大字用法（数值文字，非色块）。

```css
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-2);
  transition: border-color var(--motion-fast) var(--ease-standard);
}
.stat-card:hover { border-color: var(--accent); }          /* 可点图卡（切维度）才启用 */
.stat-card:active { background: var(--surface-warm); }
.stat-card:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.stat-card__label {
  font-size: var(--text-sm); font-weight: 600; letter-spacing: 0.02em; color: var(--muted);
}
.stat-card__value {
  font-family: var(--font-mono); font-size: var(--text-3xl);
  font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--fg);
}
.stat-card__value--alert { color: var(--danger); }
.stat-card__note { font-size: var(--text-xs); letter-spacing: 0.02em; color: var(--meta); }
.stat-card__note--degraded { color: var(--warn); } /* "数据回补中 / 预警线待 G1 回填" */
```

---

## 7. 动效与交互物理

**动效哲学：这套界面的动效是呼吸，不是心跳。**

用户已经很急了，界面不能跟着急。所有动效只做两件事：①确认"你的操作被听到了"（颜色沉降，150ms）；②交代"新内容从哪来"（进场浮现，200ms）。没有弹簧、没有回弹、没有超过 240ms 的任何东西。色彩响应哲学延伸到动效层：**运动属性只有 opacity 与颜色，加上进场时一次性的轻微位移**——进场位移是叙事（内容落座），交互位移是禁忌（§6）。

**微反馈 CSS（按压 / 聚焦 / 悬停）：**

```css
/* 按钮按压：颜色沉降已在 .btn 各态定义，过渡统一走： */
.btn, .input, .source-badge, .stat-card {
  transition-duration: var(--motion-fast);
  transition-timing-function: var(--ease-standard);
}
/* 输入框聚焦：边框着色 + ring（见 .input:focus-visible），无尺寸变化 */
/* 卡片悬停：仅边框着色（见 .stat-card:hover），无阴影无位移 */
```

**进场动画 CSS（消息落座 / 图卡入场）：**

```css
@keyframes msg-settle {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.bubble, .step-card, .exit-card {
  animation: msg-settle var(--motion-base) var(--ease-standard) both;
}
/* 看板图卡 staggered 入场：从左上到右下依次落座，节奏克制（40ms 步进） */
.stat-card { animation: msg-settle var(--motion-base) var(--ease-standard) both; }
.stat-card:nth-child(2) { animation-delay: 40ms; }
.stat-card:nth-child(3) { animation-delay: 80ms; }
.stat-card:nth-child(4) { animation-delay: 120ms; }

/* responding 指示：流式回复前的三点呼吸，1.2s 缓慢节奏——是等待的陪伴不是催促 */
@keyframes dot-breathe { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
.typing-dot { display: inline-block; width: 6px; height: 6px; border-radius: var(--radius-pill);
  background: var(--muted); animation: dot-breathe 1.2s var(--ease-standard) infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }
```

**状态切换 CSS（抽屉 / 提示条 / 维度切换）：**

```css
/* 转人工确认面板：底部抽屉升起 + 遮罩淡入 */
.drawer-mask {
  position: fixed; inset: 0; background: color-mix(in oklab, var(--fg), transparent 55%);
  opacity: 0; pointer-events: none;
  transition: opacity var(--motion-base) var(--ease-standard);
}
.drawer {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: var(--surface-overlay);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--elev-float); /* 静态层级 */
  transform: translateY(100%);
  transition: transform var(--motion-base) var(--ease-standard);
}
.drawer.is-open { transform: translateY(0); }
.drawer-mask.is-open { opacity: 1; pointer-events: auto; }

/* 恢复提示条 / 转人工提示条：高度无关的淡入落座 */
.notice-bar { animation: msg-settle var(--motion-base) var(--ease-standard) both; }

/* 看板维度切换：内容交叉淡入，无横向滑动 */
.panel-swap { opacity: 1; transition: opacity var(--motion-fast) var(--ease-standard); }
.panel-swap.is-leaving { opacity: 0; }
```

**Reduced motion（针对具体类名，禁用全局 `*`）：**

```css
@media (prefers-reduced-motion: reduce) {
  .bubble, .step-card, .exit-card, .stat-card, .notice-bar {
    animation: none;
  }
  .drawer, .drawer-mask, .panel-swap {
    transition-duration: 0.01ms;
  }
  .typing-dot { animation: none; opacity: 0.6; }
}
```

---

## 8. 品牌情感与声音

**品牌灵魂：** 如果这个界面是一个人，ta 是**社区五金店里那位退休的老电工**——

- **耐心**：一步一步讲，从不因为你没听懂而加快语速（一步一屏、大字、双选）。
- **诚实**：知道就告诉你出处（来源徽章），不知道就直说并把你交给真人（拒答即转人工，从不硬撑）。
- **沉稳**：你拍桌子的时候 ta 不慌（情绪路径零红色、零打断、出口常驻）。
- **可靠**：说"会有人回复你"就真的按查证过的通路承诺（目标态/底线态双话术）。
- **谦逊**：青蓝只出现在该出现的地方，从不刷存在感（accent 每屏 ≤2 处）。

**情感化细节（边缘时刻）：**

- **空状态（新会话首屏）**：开场披露 + 四颗大按钮就是空状态本身——这个产品没有"空"的时刻，只有"从这里开始"的时刻。不放插画，放行动。
- **Loading（responding 指示）**：三点缓慢呼吸（1.2s 周期），配色用 --muted 而非 accent——等待不该被高亮。
- **故障态（C1/C2/C3 文案卡）**：降级卡用与 AI 气泡相同的温感纸面呈现，Retry 按钮走 .btn-secondary——故障提示长得越"平常"，用户越不慌。
- **解决确认**："Great — looks like you're all set!" 配 --success 色小对勾图标，是全系统唯一的庆祝时刻，也仅此而已——克制的喜悦才可信。

**插画/图形指引：** 本期图形资产为排障配图（路由器示意、指示灯状态等）与开场机器鸟吉祥物占位（线描小鸟 SVG 圆形头像，见 §6.3；正式素材到位后替换）。风格要求：说明书式线描 + 单色 accent 点缀，白底、圆角 8px 内嵌卡中；禁止照片素材混用（光影噪音）与卡通拟人（对成年挫败用户显得轻佻）。图是增强不是依赖，加载失败时文字必须独立完整（PRD §5.3）。

**Agent 设计指令（给生成 HTML 的 agent）：**

1. tokens.css 的 `:root` 块原样内联进每个页面 `<style>`，全文只用 `var(--xxx)`，出现一个裸 hex 即违规。
2. 每屏自查 accent 用量 ≤2 处可见行动位；情绪路径界面禁止任何红色元素（含图标）。
3. 所有可点元素 min-height ≥44px、字号 ≥15px；用字号缩放 1.35 倍预演布局，按钮换行不截断。
4. 交互反馈只改颜色：禁止 hover 阴影、禁止 hover/active 位移；阴影只用于 exit-card / drawer 的静态层级。
5. 文案一律引用 PRD §5 定稿英文原文，禁止自造或改写用户可见文案。

---

## 9. 设计禁忌

1. **禁止在情绪路径界面使用大面积红色或警示色块**——怒气用户面前红色是刺激源不是信息；--danger 只允许出现在小面积状态文字与看板标红。
2. **禁止 hover/active 使用阴影提升或 transform 位移**——全站交互哲学为色彩响应，混入位移或阴影反馈即破坏双端一致性与"沉稳"人格。
3. **禁止任何正文或按钮文字小于 15px、可点区域小于 44px**——中老年用户与 AC-C-01 硬验收不接受例外；徽章/时间戳 13px 是唯一下限且不可点。
4. **禁止给容器写死高度**——系统字号缩放最大档下卡片必须自动生长，写死 height = 破版即验收失败；一律 min-height + 弹性布局。
5. **禁止 accent 每屏超过 2 处可见行动位**——青蓝的指路价值来自稀缺；到处是青蓝等于没有路标。
6. **禁止排障步骤卡脱离会话流做成全屏页或浮层**——PRD R5-S1 已写死会话流承载；破坏它就破坏了"当前步骤可回达"与上下文衔接。
7. **禁止使用非系统字体渲染用户可见文字**——品牌字会破坏 Dynamic Type 原生缩放且增加中老年用户认知摩擦；等宽栈仅用于 SN 与看板数值。
8. **禁止进度指示出现总步数分母（如 "Step 2 of 5"）**——分支换路径时总数会变，虚假的确定性比没有确定性更伤信任（PRD §5.3 写死）。
