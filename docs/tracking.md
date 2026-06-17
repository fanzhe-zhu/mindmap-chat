# Mind Map Chat — Project Tracking

> **Last updated**: 2026-05-26(W0 prep 完成 — P1-P4 + P8 test set 全部 land,W1 unblocked)
> **Sprint window**: 3 weeks for v1(✅ ready to kick off W1)
> **Time commitment**: 15+ hr/week
> **Companions**:
>   - `design-doc-v1.md` — sprint 期间 build spec(含 eval framework §13-19)
>   - `design-doc-full.md` — full vision,v2/v3 详细设计

---

## 📊 总览状态

| Track | 状态 | 进度 | 关键 blocker |
|---|---|---|---|
| **v1 Design** | ✅ Locked | 2026-05-11 v1-only + eval 完成 | — |
| **v1 Pre-impl Prep** | ✅ Done | 2026-05-26 完成 | — |
| **v1 Week 1** (Single Agent CLI) | 🟢 Ready | prep 清零,可 kick off | — |
| **v1 Week 2** (Root + Leaf CLI) | ⚪ Blocked | 等 W1 | — |
| **v1 Week 3** (Web App) | ⚪ Blocked | 等 W2 | — |
| **v1 Portfolio Packaging** | 🟡 Partial | 故事锁定,artifact 待做 | parallel |
| **v2 Planning** | 🟡 Candidates listed | Blocked on v1 ship + 1 周 dogfood | 看 v2 section |
| **v3 Roadmap** | 🟡 Held loosely | Blocked on v2 ship + dogfood | 看 v3 section |

**状态符号**: ✅ done · 🟢 on track · 🟡 partial / risk · 🔴 blocked / off-track · ⚪ not started

---

## 🎯 当前最重要的事

W0 prep 已全部完成(下面 P1-P4 + P8 详见各节)。**下一步 = kick off Week 1 Day 1。**

W1 启动只需:
1. **确认 prep 产物都在代码 repo 里** — `prompts.md` + P2/P3/P4 doc + eval `.ts`(`eval-types.ts` / `goals.ts` / `scenarios.ts` 已 typed & typecheck 通过;runner `eval-leaf.ts` / `eval-report.ts` 待 W1 wire)
2. **Project init**(Next.js + Anthropic SDK)→ 按 P3 pseudocode 实现 `runReActLoop` → 跑 3 个测试 query → W1 ship

W1 ship 才需要的尾巴(不挡启动):eval runner 脚本接上 W1 agent code + trace shape 核对。

---

# 📝 v1 Pre-Implementation Prep(Week 0)

> ✅ **DONE 2026-05-26.** v1 design locked → 翻译成 code template 的工作已完成。
> 状态汇总:P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ · P8 test set ✅(typed + typecheck + 304 条不变量断言通过)。
> P5/P6/P7 按设计 defer(见各节)。**可进 Week 1。**

## P1: System Prompts(最高优先级)— ✅ DONE

> 交付:`prompts.md`(v0.2,在 project 里)。4 个 prompt + schema-enforcing tool 定义 + implementation notes。

- [x] **Root agent system prompt** — 三步流程(clarify → confirm → outline),phase 3 用 `submit_outline` tool 强制 schema(三段拆成独立 LLM call,state 在 code 里)
- [x] **Leaf agent system prompt** — 含 sibling awareness 注入、tool use 触发、off-tree drift 处理(instruction #9);end_turn 后单独 call summary generator(不 inline)
- [x] **Summary generator prompt** — `submit_summary_for_parent` tool 强制 `{topic, key_takeaways[], status, open_questions[]}`;`summary_for_user` defer 到 v3
- [x] **Node intro generator prompt** — one-liner + tutor intro + 3 starter questions

**v1 不需要的 prompt**:
- ~~Title type classifier~~ — v1 不分类,title 由 LLM 自然生成

**Location**: 单开一份 `prompts.md`,每个 prompt 带版本号 + 修改日期

## P2: Cost Model — ✅ DONE

> 结果:**~$0.10/map(root 启动)· ~$0.14/node(对话+summary)· sprint 总估 $120-180**。
> Pricing 参考(2026-05):Opus 4.7 $5/$25 per MTok(注意新 tokenizer 比 4.6 多 ~35% token);Haiku 4.5 $1/$5。
> Prompt caching 从 W1 开 leaf system block,30 节点树省 ~$0.85。

- [x] 每个操作的 token 估算(root 启动 / leaf 单轮 / summary / intro / eval 一次跑)— leaf 单轮 input floor ~1800 token
- [x] 每周总成本估算 — dev 期 ~$103,medium ~$157,heavy ~$262(含 eval ~$25)
- [x] Budget cap 思路已定(leaf 单轮 1800-token floor 是主要优化杠杆)

## P3: Week 1 ReAct Loop Pseudocode — ✅ DONE

> 交付:`P3-react-loop-pseudocode.md`(完整 `runReActLoop()` spec)。W1 直接照写。

- [x] Loop pseudocode 完成 — stop_reason 分支(end_turn / tool_use / max_tokens / refusal / max_iterations_hit / error)、tool dispatch、token 累加器、trace 钩子
- [x] **Max iteration cap = 10**(eval target P95 < 8,留 headroom)
- [x] 关键约定记录:多个 tool_use → 一个带多个 tool_result 的 user message;handler 抛异常 vs 返回 is_error 分开处理;W1/W2 不流式(W3 才加)

## P4: Tool & Infrastructure 选定 — ✅ DONE

> 交付:`P4-tools-and-infra.md`。**API key 已验证通过(Tavily + Anthropic)。**

- [x] **Search tool = Tavily**(free tier 无信用卡;自写 dispatch 正好展示 eval §15 的 tool-use 判断力;W3 撞瓶颈再换 Anthropic native 是一天的活)
- [x] **Logging** = 每 run 一个 JSON trace 文件 + 控制台 one-liner 每 iteration
- [x] **Error handling** = API 错误指数退避(3 次);tool 错误不重试,返回 `is_error: true` 让模型自己处理;context overflow 截断策略已记
- [x] Prompt caching = leaf system block 从 W1 开

> **P7 Failure Modes** 已并入本节的 error handling(rate limit / timeout / 非法 tool call / refusal / overflow / tab 关闭 / localStorage quota)。不再单列。

## P5: User Scenario Walkthrough — ⏸ DEFERRED 到 W3 prep

> W1/W2 是 CLI,没有 click 级 UX。这一项挪到 **Pre-Week-3 Decisions** 做更合适。下面保留原始 checklist 供 W3 用。

走到 click 级,在 code 前:

- [ ] **Scenario A: 用户初次 onboarding**(root agent 3 步流)
  - 用户输 goal 后看到什么?
  - Agent 提 clarifying questions 怎么呈现?多个问题一次显示还是依次?
  - "Confirm understanding" 步骤用户怎么 confirm / correct?
  - Outline 生成是 streaming 还是一次出?

- [ ] **Scenario B: 用户在 leaf node 对话,agent 调用 web search**
  - "agent is searching the web" indicator 长什么样?
  - Search 返回的内容如何 stream?
  - Sibling awareness 怎么 verify 起作用了?(agent 真的没和 sibling 重复?)
  - 对话结束(`stop_reason==end_turn`),summary 何时生成?

- [ ] ~~Scenario C: 用户编辑上游节点导致下游 stale~~ — **v1 不做 stale 系统,移到 v2**

## P6: localStorage Schema — ⏸ DEFERRED 到 W2 末尾

> W3 才用 localStorage。schema 在 W2 末尾(进 W3 前)定。保留 shape 草稿如下。

- [ ] **v1 JSON shape**(只一棵树):
  ```typescript
  type LocalStorageRoot_v1 = {
    version: number  // schema version
    tree: Tree | null  // v1 单棵树
  }
  type Tree = {
    id: string
    goal: string
    created_at: timestamp
    nodes: { [node_id: string]: Node_v1 }
    edges: Edge_v1[]
  }
  ```
- [ ] **决定: localStorage quota 满了怎么办?**(5MB 限制)
- [ ] **决定: schema version migration 策略**(v1 → v2 schema 变了时怎么办)

## P7: Failure Modes Table — ✅ 并入 P4

> 已并入 P4 的 error handling 策略(与之重合度高)。下面 case list 保留作 W1 实现时的覆盖清单。

- [x] 列出 v1 真实会撞到的 failure scenario(已在 P4 覆盖):
  - Anthropic API rate limit
  - Anthropic API timeout
  - Web search timeout / no results
  - LLM 返回非法 tool call(参数错误)
  - LLM 拒绝回答(refusal)
  - Context window overflow
  - User 中途关闭 tab(agent run 中)
  - localStorage 写失败 / 超 quota
- [ ] ~~Stale propagation 异常~~ — v1 不做

## P8: Eval Framework Setup — 🟢 test set ✅ LOCKED+TYPED · runner 待 W1

> 参见 `design-doc-v1.md` Part V(§13-19)。原则:第一版 2-3 小时,不是 2-3 天。
> **Test set 已 lock 并 typed**(2026-05-26):`eval-types.ts`(locked 类型)+ `goals.ts`(10 goal + 4 personalization pair)+ `scenarios.ts`(S1-S20)。
> 验证:`tsc --strict` 通过 + 304 条运行时不变量断言全过(9/11 tool 配比、6 条 sibling_awareness、每条 2 siblings、id 唯一、引用完整等)。
> Markdown 真源:`eval-goals.md` / `eval-scenarios.md`(均含 LOCKED statement)。

- [x] **10 个 root goal test set** — `eval-goals.md` + `goals.ts`(含 coverageMode: subtopic/clarify/granularity + answer key)
- [x] **20 个 leaf scenario test set** — `eval-scenarios.md` + `scenarios.ts`(parent context, 2 siblings, user message, needsTool, expectedBehavior, primaryMetric)
- [ ] **`eval-root.ts` 骨架** — 待 W2(import `runRootAgent`,W2 才存在)
- [ ] **`eval-leaf.ts` 骨架** — 待 W1(import `runReActLoop`,W1 才存在);test data 已就绪,只需 wire runner
- [ ] **`eval-report.ts` 骨架** — 待 W1(读最新 run 算自动 metric)
- [ ] **人工打分模板** — `human-scoring-template.md`,W1 ship 前做

**Eval 锁定原则**: test set 写完后 **整个 v1 sprint 期间不改不加不删**。 这样改 prompt 才能 apples-to-apples 比较。

---

# 📦 v1 Week 1: Single Agent CLI

> **Target ship**: Week 1 Day 7
> **Status**: 🟢 Ready to start(prep unblocked 2026-05-26)

## Goal
CLI 脚本,"Weather in Tokyo?" → agent 调 web_search → ReAct 多步推理 → 答用户

## Success Criteria
- [ ] 能 debug 失败 tool call 不慌
- [ ] 能用人话解释 loop 终止条件
- [ ] 跑完一次任务知道消耗了多少 token / 美金

## Tasks
- [ ] Project init(Next.js 项目 + Anthropic SDK 安装,即使 W1 只用 CLI)
- [ ] Web search tool 实现(选定 Brave/Tavily/Anthropic native 后)
- [ ] ReAct loop 实现(按 P3 pseudocode)
- [ ] Logging: 每一步 LLM call + tool call 都 print + JSON trace
- [ ] Token counter: loop 结束打印总消耗
- [ ] Error handling 覆盖 P4 列出的 case
- [ ] 跑 3 个测试 query:
  - "Weather in Tokyo?"(简单)
  - "What's the latest Anthropic paper about?"(需要多步)
  - 一个故意会失败的 query(测 error handling)

## W1 Eval(leaf agent baseline)
- [ ] 跑 `eval-leaf.ts` 在 20 scenario test set 上
- [ ] **记录 baseline 数字**(进 `eval-runs/W1-baseline/`):
  - Tool use call rate _____ %
  - Tool 参数 valid rate _____ %
  - ReAct iteration mean _____ / P95 _____
  - Token cost per scenario avg _____
- [ ] 人工填:
  - Hallucination on failed tool: _____ instances
  - 整体 leaf agent quality 1-5 scale: _____

## Portfolio Output
- [ ] Demo video(2-3 min,录终端跑 ReAct loop 的 trace)
- [ ] 一段 commit message 风格的 progress log
- [ ] W1 eval baseline 数字 → 进 portfolio

---

# 📦 v1 Week 2: Root + Leaf CLI

> **Target ship**: Week 2 Day 14
> **Status**: ⚪ Not started

## Goal
CLI 脚本,完整跑 v1 流程(无 UI):用户输 goal → root agent 3 步流 → outline JSON → 用户从 CLI 选 node → leaf agent ReAct 对话 → summary regen

## Success Criteria
- [ ] 能解释 root 与 leaf 的 context 差别
- [ ] **Sibling awareness 落地**(eval 人工抽查 verify)
- [ ] Week 1 代码作为 leaf agent base 直接 reuse

## Pre-Week-2 Decisions(Week 1 Day 7 前定)
- [ ] **Root agent outline 输出格式** — Structured JSON 还是自然语言后 parse?**推荐 structured output + JSON mode**
- [ ] **CLI 怎么呈现 mind map** — Indented text list / ASCII tree / numbered list?
- [ ] **Sibling list 怎么注入 leaf prompt** — placeholder 还是 prefix?
- [ ] **Week 1 → Week 2 代码 reuse** — **推荐抽 `runReActLoop()` 函数**,W1 和 W2 共用

## Tasks
- [ ] Root agent system prompt + 3 步状态机
- [ ] Outline structured output 解析(JSON mode)
- [ ] In-memory Tree 数据结构
- [ ] CLI 交互: input goal → clarify Q&A → confirm → outline 显示 → node selection → leaf agent
- [ ] Leaf agent system prompt(含 sibling awareness 注入)
- [ ] `summary_for_parent` regeneration logic
- [ ] 把 Tree 序列化到 JSON 文件方便人工检查

## W2 Eval(root + leaf 联合 baseline)
- [ ] 跑 `eval-root.ts` 在 10 goal test set 上(每个 goal × 3 次)
- [ ] 重跑 `eval-leaf.ts`(因为 sibling awareness 注入了,可能改变)
- [ ] **记录 baseline 数字**(进 `eval-runs/W2-baseline/`):
  - 自动 metric:Node count std/mean、tool use rate、ReAct iter mean/P95、token cost
  - **Summary schema 完整度**: _____ % (4 字段全填且类型正确)
- [ ] 人工填:
  - Coverage avg 跨 10 goal: _____ %
  - Personalization 是否明显(goal #10 vs 白纸 goal #5):是 / 否
  - Sibling overlap 抽 5 个 pair 平均: _____ %
  - Hallucination: _____ instances
  - **Summary status 准确性**(抽 10 个对话): _____ % 自评与人工一致

## Portfolio Output
- [ ] Demo video: 录全程 CLI 跑
- [ ] 一段 reflection: root vs leaf context 差别、sibling awareness 如何 verify
- [ ] W2 eval baseline 数字

---

# 📦 v1 Week 3: Web App Integration

> **Target ship**: Week 3 Day 21
> **Status**: ⚪ Not started

## Goal
Web app。 用户输 goal → root agent UI 3 步对话 → React Flow mind map → 点 node → leaf agent 对话(tool use 可见)→ localStorage 持久化

## Success Criteria
- [ ] 朋友用 5 分钟会问 "what's underneath this?"
- [ ] 至少 3 个朋友试用,各产生 1 份 feedback
- [ ] 你自己用它准备一次真 AIPM mock interview
- [ ] **W3 完整 eval 完成,数字进 portfolio**

## Pre-Week-3 Decisions(Week 2 Day 14 前定)
- [ ] **Node 的 intro + 3 starter questions 何时生成?** Prefetch 还是 lazy?
- [ ] **Streaming 实现** — Anthropic SDK streaming API 先跑通一个 toy
- [ ] **React Flow node component 设计** — 标题 + one_liner 缩略 + 状态徽章。 **不调 CSS**

## Tasks(精简版)
- [ ] Next.js project setup(W1 已 init)
- [ ] React Flow 集成 + custom node component(用 default 样式)
- [ ] Root agent 启动流 UI(3 步对话)
- [ ] Outline → mind map 转换
- [ ] Leaf node 对话 UI
- [ ] Tool use indicator(streaming)
- [ ] localStorage persistence(按 P6 v1 schema)
- [ ] Node 开场体验(one-liner + intro + 3 questions)
- [ ] Sibling awareness 注入(W2 复用)
- [ ] 6 个 v0 dogfood insight 全部 land

## Week 3 不做(已 defer 到 v2)
- ❌ Stale tag UI 系统
- ❌ Title type 5 分类 + 行为分支
- ❌ Reference edge UI
- ❌ Bottom-up entry
- ❌ Multi-tree 支持
- ❌ `summary_for_user` 生成

## W3 Eval(每改 prompt 重跑 + ship 后完整)
- [ ] **每改一版 prompt** → 跑自动 metric(`eval-report.ts`)对比 baseline,看 regression
- [ ] **每周末** → 人工 metric 跑一次
- [ ] **W3 ship 后完整 eval**(进 `eval-runs/W3-final/`):
  - 全部 4 维 root metric + 4 维 leaf metric
  - 跟 W1/W2 baseline 对比的趋势 chart
  - 这些数字 → 直接进 blog post + portfolio + 面试 pitch

## Portfolio Output
- [ ] Deploy 到 Vercel
- [ ] Demo video(3-5 min)
- [ ] Design doc 公开版(脱敏)
- [ ] Blog post: "Building a multi-agent thinking environment in 3 weeks" + eval 数字 + lessons learned
- [ ] **Eval results page**(blog post 配套,把数字 + methodology 单独列一页 → AIPM 面试时直接 reference)

---

# 🔄 Cross-Cutting(v1 sprint 全程并行)

## Cost Dashboard
- [ ] Week 1 起每次跑都记录 token 消耗
- [ ] 每周末汇总: 这周烧多少 token / 多少美金(含 eval 消耗)
- [ ] AIPM 面试有数字能讲

## Eval Cadence(新增)

> 详见 `design-doc-v1.md` §17。 这是 v1 sprint 期间最容易 skip 但 ROI 最高的 cross-cutting 之一。

- [ ] **自动 metric**(每次 prompt 改动后跑)— `eval-report.ts` 跑一次 5-10 分钟
  - Tool use rate / 参数 valid rate
  - ReAct iter mean/P95
  - Token cost
  - Node count std/mean(每周 Mondays root agent 改了才需要)
  - **Summary schema 完整度**(改了 summary generator prompt 后必跑)
- [ ] **人工 metric**(每周日跑一次,30-60 分钟)
  - Coverage scoring on 10 goal
  - Personalization 是否明显
  - Sibling overlap 抽样
  - Hallucination count
  - **Summary status 自评准确性**(抽 5-10 对话)
- [ ] **Eval log**: `eval-runs/` 目录,每次 baseline / 改动后记录数字
  - 看 prompt 调整 → metric 变化方向
  - 这本身就是 AIPM portfolio 资产("我做了 X 次 prompt iteration,coverage 从 60% 提到 85%")

## Feedback Collection
- [ ] **Week 3 ship 前**准备 3 个固定问题,问每个试用朋友:
  1. 最 confused 的瞬间是什么?
  2. 最有用的瞬间是什么?
  3. 你愿意每周再用吗?为什么 / 为什么不?
- [ ] 录屏(征得同意)— 看用户哪里卡住
- [ ] 找 3-5 个 beta user(在转 PM / AIPM 的朋友最理想)

**注意**: feedback collection 是 **qualitative** signal,跟 eval 的 **quantitative** signal 互补。 都需要,不能互换。

## Portfolio Artifact 节奏
- [ ] **每周末**产出一份 portfolio material:
  - Week 1: 终端 trace demo + reflection + W1 eval baseline
  - Week 2: CLI 跑全程 demo + multi-agent design reflection + W2 eval baseline
  - Week 3: full demo + blog post + W3 eval final + eval methodology page
- [ ] **最终包**:
  - 3-5 min main demo video
  - 30 秒 pitch 视频(数字必须能 say)
  - Blog post(含 eval 数字)
  - Eval results page(独立,methodology + 数字 + 限制)
  - GitHub repo
  - 面试 30 秒 + 5 分钟两个版本,练熟。 **5 分钟版本必须能讲 eval methodology + 一两个 specific result**

## Meta-Narrative
- [ ] 记录 "用 AI build 这个 AI 工具" 的经验:
  - 哪些 task 用 AI 做了,workflow 是什么
  - 哪些 task AI 帮倒忙,你怎么发现的
  - AI-assisted vs traditional 开发的 productivity 差距(token 数、时间)

---

# 🚀 v2 Planning(v1 sprint 期间只看,不动)

> **Status**: Blocked on v1 ship + 1 周 dogfood
> **Kick-off conditions**:
>   1. v1 已 ship 并稳定运行 1+ 周
>   2. v1 retro 完成
>   3. 至少 5 小时 v1 真实 dogfood(不是 demo,是真用)
>   4. 至少 3 个 beta user feedback 收齐
>   5. **W3 完整 eval 跑完,知道 v1 最弱的维度是什么**

## v2 Candidate Features(按 portfolio + 痛点综合排序)

设计详情见 `design-doc-full.md` 对应 section。 **v1 ship 后 pick 1-2 个,不是全做**。

| Feature | 来自 | Time est | Portfolio value | 选它的条件 |
|---|---|---|---|---|
| **Reactivity 完整传播 + stale UX** | full §10.2-10.3 | 2-3 周 | ⭐⭐⭐⭐⭐ — reactive memory propagation 故事正面回答 | v1 dogfood + eval 撞到 "edit 上游不知道下游过期" 痛点 |
| **Specialist agent library + type 路由** | full §12.2, §8.2 | 3-4 周 | ⭐⭐⭐⭐ — 真正展示 "multi-agent" | v1 eval 显示通用 leaf 在某类节点 metric 显著低 |
| **Bottom-up entry + concept extraction** | full §15 | 2-3 周 | ⭐⭐⭐ — UX 新维度 | v1 dogfood 发现用户常想 "从想法开始而不是 goal" |
| **Reference edge UX**(拖拽 / 创建) | full §8.2 | 1-2 周 | ⭐⭐ — 小但有用 | v1 dogfood 发现频繁需要跨支链接 |
| **LLM-as-judge eval 自动化** | v2 eval upgrade | 1-2 周 | ⭐⭐⭐ — 数据驱动改进能 scale | v1 eval 人工部分太慢,blocking 快速 iteration |
| **Title type ground truth 验证 + 启用** | full §12.2 | 1 周 | ⭐ — 准备工作 | 作为 specialist 启用前置 |

## v2 Sprint 启动 checklist

v1 retro 完成后:

- [ ] 选定 v2 主题(1-2 个候选)— **决策依据 = v1 eval 最弱维度 + dogfood 痛点**
- [ ] 写 v2 design doc(类似 v1-only 那种精简版)
- [ ] 估时间盒(3-4 周?根据当时 availability)
- [ ] 列 v2 scope cut(类似 v1 的 "Out of Scope" 表)
- [ ] 重新做 cost model(v2 有新的 LLM call 模式)
- [ ] **扩展 eval framework**(新增 v2 维度的 metric,旧维度继续追踪)
- [ ] 决定 v1 是否需要 schema migration(localStorage 迁移)

## v2 期间会重新审视的 v1 决定

v1 design 是基于 v0 dogfood 的。 v2 启动时,**v1 dogfood + eval 一定会推翻一些 v1 决定**。 已知候选(等真实数据 verify):

- Tree-only 够吗?需要 multi-parent 吗?
- `ancestors_summary_chain` 真的够 context 吗?还是要 sibling summary on-demand?
- Sibling awareness 注入用 prompt 真的足够?eval 数字是否达标?
- localStorage 真的够 v1 用?还是早就该上 DB?
- 10 个 root goal test set 还够吗?有 outlier 没覆盖?

---

# 🛰️ v3 Roadmap Holding(loosely held)

> **Status**: Blocked on v2 ship + dogfood
> **Note**: v3 **可能永远不发生**。 v1 + v2 可能就是 portfolio 最终形态。

## v3 Candidate Features(超粗略)

设计详情见 `design-doc-full.md` Part IV §20 + Part V §21-23:

- **Specialist library + meta-agent 选 specialist**
- **长期 memory facts schema**(跨树用户画像)
- **中期 tree memory**(树级 goal / 进展)
- **Map agent**(后台抗熵,检测重复 / 孤儿 / 可合并)
- **Global Q&A**("Ask the Map" + `summary_for_user`)
- **Slot-based parent view + cross-child lazy synthesis**
- **`derived_from` edge**(配合 bottom-up promotion provenance)
- **Schema 演化**:DAG / multi-parent
- **Share / clone mind map**
- **A/B eval framework**

## v3 启动前置条件

- v1 + v2 都 ship 且稳定
- 累积至少 50+ 小时 dogfood
- 至少 10 个真实用户(不是 demo viewer)
- portfolio 故事 v1+v2 已经讲完一轮(面过若干 AIPM)
- **还想做**(motivation 是真问题,不是 sunk cost)

## v3 不做的路线(已确认)

- ❌ **Goal-driven 全自动 agent** — 违反"不替用户思考"哲学,**永远不做**
- ❌ **任何 "user-defined specialist" / "marketplace"** — v4+ 才考虑

---

# 🛡️ Guardrails Reminder(v1 sprint 期间)

1. **No new product ideas until Week 1 ships.** Ideation 全部 pause。
2. **3 周时间盒。** Day 21 ship or retreat,不延期。
3. **15+ 小时/周。**
4. **TypeScript only.**
5. **Tree only.** v1 不动 DAG / multi-parent。
6. **Ship trumps polish.**
7. **Eval framework 第一版 2-3 小时写完,不是 2-3 天**(参见 design-doc-v1 §18)

**Anti-pattern 警报**:

- 这是不是建之前再设计 schema?
- 为了"选最好的 framework"读更多 framework?
- 中途加 feature 因为想到了新点子?
- **顺手做了 v2 的 X?**(最危险)
- Agent loop 没工作前先 polish UI?
- **Eval framework over-build?**(2-3 小时 → 2-3 天)
- **Skip 人工 eval metric 因为麻烦?**(AIPM 面试官想听的就是这部分)

冲动想做 v2 feature → 翻 `design-doc-v1.md` Part VII "Out of Scope" 表 → 关闭冲动 → 回 v1。

---

# 📅 v1 Sprint Retro 模板(Day 21 ship 后强制做)

> 无论 ship 成功还是 retreat,**强制做一次 retro**:

- 实际投入了多少小时?vs 计划 45 小时
- 哪些 estimate 错了?为什么?
- 哪些 v1 design 决定上线后被现实推翻了?(直接关联 v2 candidates)
- 哪些 v0 dogfood insight 还是 v1 没解决?
- 用户(包括自己)最 friction 的 3 件事 → v2 candidates
- **Eval 最弱的维度是什么?为什么?→ v2 candidates**
- AIPM 故事怎么讲最有 leverage?
- v2 选哪个?或者直接 portfolio 强化不做 v2?

**Retro 完成后**:
- 更新这份 tracking doc(把 v1 sprint section archive,v2 planning 升级为 v2 sprint)
- 更新 `design-doc-full.md`(把 v1 dogfood 学到的写进去)
- 决定要不要进 v2

---

*Created 2026-05-11 by Yvonne + Claude.*
*Update cadence: 每周日晚 update 一次状态。*
*v1 ship 后大改一次。*
