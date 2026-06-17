# Mind Map Chat — v1 Build Spec

> **Status**: Locked for 3-week sprint
> **Version**: 2026-05-11 (v1-only + eval framework added)
> **Companion**: `design-doc-full.md`(full v1/v2/v3 vision)— 当前文件只看 v1
> **用法**: 这是 sprint 期间打开的 build spec。 任何 "v2 / v3 怎么办" 的问题翻到 full doc,**v1 sprint 期间不动它们**。

---

## TL;DR

**v1 是什么**:Minimal multi-agent harness。 用户输 goal → root agent 通过对话(clarify → confirm → outline)生成 mind map → 用户点 node → leaf agent 对话(可 web search,tool use 可见)→ localStorage 持久化。 **Mind map = orchestration topology**(用户可见、可编辑)。

**v1 不做(全部 defer 到 v2/v3+)**:
- ❌ Reactivity 自动传播 + stale tag 系统
- ❌ Specialist agent 库 + meta-agent
- ❌ Bottom-up entry mode
- ❌ Cross-tree memory + 长期 facts
- ❌ Reference edge / derived_from edge
- ❌ 第二份 summary(`summary_for_user`)
- ❌ Title type 行为分支
- ❌ Aggregation query("Ask the Map")
- ❌ Map agent(背景抗熵)

**v1 是 v2/v3 的 foundation,不是 throw-away**:
- v1 leaf agent = v2 specialist 的 substrate
- v1 tree = v3 Map agent 的操作对象
- v1 `summary_for_parent` = v3 cross-node memory primitive

**Tech**:Next.js 14 + TypeScript + React Flow + Anthropic SDK (`claude-opus-4-7`) + Brave/Tavily web search + localStorage + Vercel
**Time**:3 weeks × 15 hr/week = 45 hours total

---

# Part I — Foundation

## 1. v1 Thesis

> A minimal multi-agent harness where mind map IS the orchestration graph—editable, inspectable, persistent.

**两层 thesis**:
- 表层(UX):Linear chat is a UX bug。 人的思考是 tree-shaped 的。
- 底层(架构):Mind map 不是 chat 的 visualization,是 **multi-agent 系统的 user-facing orchestration topology**。

## 2. 核心哲学:节点边界

**节点边界 = 思考权和规划权的分界线**:

| 在哪里 | 谁来做 | 做什么 |
|---|---|---|
| 节点**之间** | 系统 | 生成大纲、铺节点、组织结构 |
| 节点**之内** | 用户 | 提问、思考、追问、close |

区别于 Deep Research / Manus — 他们替用户做完所有事,**剥夺 cognitive work**。 这是产品灵魂,**所有 v1 设计决策回到这检验**。

## 3. v1 Design Principles

1. **节点之间系统化,节点之内人工化** — Cognitive load 在外,cognitive work 在内
2. **系统提议,用户决策** — 所有 CRUD 只能 propose,用户保留 final say
3. **Personalization 显式呈现** — Agent 必须 summarize 它对用户的理解,等 confirm
4. **Brute-force 优先** — v1 不为 v2/v3 预设架构。 v1 阶段不需要 v2 才用的字段、规则、机制
5. **诚实命名** — v1 节点叫 "leaf agent"(因为有 tool use + ReAct loop),不叫 "specialist"(那是 v2)

---

# Part II — v1 System Design

## 4. Agent Architecture

### 4.1 Agent 是 stateless function
- 每次 run 重组 context,无 agent 实例对象
- 理由:Anthropic SDK 原生 stateless;v1 不需要 actor 模型

### 4.2 State 住在 Node 上
- 所有 agent state(messages array)作为 Node 字段
- Node 是 single source of truth

### 4.3 Agent 权限边界(v1)

| 操作 | 允许 |
|---|---|
| 写自己 node 的 messages | ✅ 每轮对话 |
| 写自己 node 的 `summary_for_parent` | ✅ 在 `stop_reason==end_turn` 时触发 |
| 提议新 node(tool call: `propose_new_node`) | ✅ 用户确认才执行 |
| 直接创建子 node | ❌ |
| 改别的 node 内容 | ❌ |
| Archive / delete 别的 node | ❌ 永远只用户能做 |

**v1 不需要的权限**:propose reference edge(因为没 reference edge type)

### 4.4 Trigger:只有 manual
- 用户点节点 / 发消息触发 agent run
- **不做** upstream-auto trigger(那是 v2,需要 reactivity 传播规则,v1 不做)

### 4.5 "完成"
- **Turn-level**:`stop_reason === "end_turn"` 时 ReAct loop 终止
- **Node-level**:用户决定。 Agent 不自决"我够了"

## 5. v1 Schema(精简)

```typescript
type Node = {
  // Identity
  id: string
  parent_id: string | null
  created_at: timestamp
  updated_at: timestamp
  
  // Content
  title: string          // free-form, LLM 生成,style 随 context
  one_liner: string      // ≤25 字,节点要回答什么
  
  // Agent runtime
  system_prompt: string  // base + injected sibling awareness
  messages: Message[]    // Anthropic SDK messages array
  tool_config: ToolConfig
  
  // Summary(v1 只一份,structured)
  summary_for_parent: SummaryForParent | null  // 在 stop_reason==end_turn 时 regenerate
  
  // Lifecycle(简化)
  status: 'active' | 'archived'  // v1 不做 stale 状态
  
  // Metadata
  tags: string[]
  user_notes: string | null
}

type SummaryForParent = {
  topic: string               // 这个节点讨论什么(1 句)
  key_takeaways: string[]     // 核心 point(3-5 条)
  status: 'mastered' | 'partial' | 'confused'  // LLM 自评(eval 测准确率,见 §15)
  open_questions: string[]    // 未解决问题(0-N 条)
}

type Edge = {
  type: 'parent'         // v1 只有 parent 一种 edge
  from: NodeId
  to: NodeId
}
```

**关于 `summary_for_parent` 结构化的决定**:

- 不存 free-form text,存 4-field structured JSON。 让 ancestors chain prefix 时格式稳定,let leaf agent 拿到的 context 是结构化的
- **`status` 是 LLM 自评**,v1 接受 imperfect(eval framework §15 专门测这个准确率)
- **`status` 不含 `'untouched'`**——untouched = `summary_for_parent === null`,无需多一个枚举值
- **`open_questions`** 是 v3 Global Q&A 的 Gap 类问题核心依据(参考 doc-full §22),v1 就存上,跨版本零迁移
- **不存** v3 vision 提到的"用户掌握程度量化分数"——v1 用 3-tier 离散 status 够用,quantitative 等 LLM-as-judge eval 在 v2 再上

**v1 从 full vision 砍掉的字段**(全部 defer 到 v2/v3):
- `title_type`(v1 不接 specialist,type 不驱动行为)
- `summary_for_user`(v1 没 Global Q&A,没消费者)
- `freshness_version`(v1 没 stale 系统)
- `status: 'stale'`(同上)

**v1 从 full vision 砍掉的 edge 类型**:
- `reference`(v1 没跨支链接 UX)
- `derived_from`(v1 没 bottom-up promotion)

## 6. Context Propagation(v1 简化)

Agent run 时看到什么:

```
1. node.system_prompt(含 base + sibling awareness 注入)
2. node.messages(自己的对话历史)
3. ancestors_summary_chain
   = [root.summary_for_parent, ..., parent.summary_for_parent]
4. siblings_metadata: [{title, one_liner}, ...]
   (注入到 system_prompt,告知"以下方向已被 sibling 覆盖,不重复")
```

**v1 不做的 context retrieval**:
- 完整 sibling summary(只 metadata)
- Reference edge 目标(没有 reference edge)
- 其他 subtree 内容
- 全局 facts memory(没有长期 memory)

**核心原则**:垂直 chain 默认 load(短且必要),横向 metadata only。

## 7. Reactivity(v1 极简)

**用户编辑 node 的 messages**:

```
1. node.updated_at += now
2. 在下一次 agent run end_turn 时,regenerate node.summary_for_parent
   (1 次 LLM call)
3. DONE.
```

**v1 不做**:
- ❌ 下游 mark stale
- ❌ Transitive propagation
- ❌ Parent 自动 mark
- ❌ Reference edge 影响(没 reference edge)
- ❌ Stale UX(visual ring / banner)
- ❌ Aggregation query 看 stale flag

**用户想 re-run 下游 node**:**手动点**。 就这么简单。

**为什么这样**:v1 用户头三周大概率不反复编辑上游 node。 装上 stale 系统是 cost(代码 + 维护 + 用户认知),但 v1 几乎没收益。 v2 真撞到痛点再做。

---

## 8. v0 → v1 Dogfood Requirements(6 项必落地)

这 6 项是 v0 dogfood 教会但 design 没有的,**v1 必须实现**:

1. **Root agent 必须 ask clarifying questions**(不预设白纸)— §9
2. **Title style 由 LLM 自决**(自然语言生成,不硬塞 question 格式)— 不需要 enum
3. **Node 开场 = one-liner + 2-3 句 intro + 3 starter questions** — §10
4. **Leaf agent 必须 sibling-aware**(system prompt 注入 sibling metadata)— §6
5. **用户必须能手动建 node**(基础 UX,不是可选)
6. **UI 文字对比度足够**(不能灰)

---

# Part III — v1 UX

## 9. Root Agent 启动流(3 步对话)

| 步 | 行为 | 目的 |
|---|---|---|
| 1 | **Clarify** — agent 反问 1-2 个最关键问题("你已知什么 / 想到什么程度 / 想避开什么") | 不把用户当白纸 |
| 2 | **Confirm** — agent 显式 summarize 对用户的理解("我假设你 X,对吗") | Transparency |
| 3 | **Generate outline** — confirm 后生成 mind map(N 个 node,每个含 title + one_liner) | 个性化前提 |

## 10. Node 开场体验

每个节点首次打开,UI 上方显示:

1. **One-liner**(≤25 字):节点要回答什么
2. **Intro**(2-3 句):tutor 风格开场,**无 markdown header / 列表**
3. **3 个推荐问题**:具体、actionable、严格控制本节点 scope,不跨 sibling

**目标**:用户进入节点第一秒,从"我得想问什么"变成"我想点哪个"。

**生成时机**:节点首次创建时 prefetch(避免用户点开等 LLM)。 这部分 token 提前算进 cost model。

## 11. Tool Use 可见

- 节点 agent 调工具时,UI 显示 "agent is searching the web" indicator(streaming)
- 用户能看见 agent 在做什么 → 建立信任
- 区别于 ChatGPT 的黑盒搜索

## 12. 入口模式

**v1 只 top-down**:用户给 goal → 系统生成 mind map。 **不做** bottom-up(那是 v2)。

---

# Part IV — 3-Week Sprint Plan

## Week 1:Single Agent CLI

**Ship**:CLI 脚本。"Weather in Tokyo?" → agent 调 web_search → ReAct loop → 答用户。

**Success**:
- 能 debug 失败 tool call 不慌
- 能用人话解释 loop 终止条件
- 跑完知道消耗多少 token / 美金
- **Leaf eval baseline 数字记下来**(§14)

**禁用**:LangGraph / CrewAI / AutoGen,手写 orchestrator。

## Week 2:Root + Leaf CLI

**Ship**:CLI 脚本。 用户输 goal → root agent 跑 3 步流(clarify → confirm → outline,生成 5-7 个 node 的 JSON)→ 用户从 CLI 选一个 node → leaf agent 跑 ReAct 对话。

**Success**:
- 能解释 root agent 与 leaf agent 的 context 差别
- Sibling awareness 落地(leaf 不和 sibling 重复)
- Week 1 代码作为 leaf agent 的 base 直接 reuse
- **Root + Leaf 联合 eval baseline 数字记下来**(§13-15)

**为什么不做"Tokyo trip"那个 multi-agent toy**:那个 pattern(planner + executors + synthesizer)v1 产品不用。 直接做 root + leaf 是直线推进 v1。

## Week 3:Web App Integration

**Ship**:Web app。 用户输 goal → root agent 3 步流(UI 对话)→ outline → React Flow mind map → 点 node → leaf agent 对话(tool use streaming 可见)→ localStorage 持久化。

**Success**:
- 朋友用 5 分钟会问 "what's underneath this?"
- 你自己用它准备一次真 AIPM mock interview
- **W3 ship 后完整 eval,数字进 portfolio**

**Week 3 在做什么**(具体):
- React Flow + custom node component
- Root agent 对话 UI(3 步)
- Outline → node + parent edges 转换
- Leaf node 对话 UI(streaming + tool use indicator)
- localStorage persistence(单棵树)
- Sibling awareness 注入(§6)
- Node 开场体验(§10)
- 6 个 v0 dogfood insight 全部 land(§8)

**Week 3 不做的**(明确 defer):
- ❌ Stale tag 系统(visual / banner)
- ❌ Title type 分类(只生成 title)
- ❌ Reference edge UI
- ❌ Bottom-up 入口
- ❌ Multi-tree 支持(单树就够)
- ❌ 重新设计 React Flow 默认样式(用 default,够用就行)

---

# Part V — v1 Eval Framework

> **Why eval matters from day 1**: 不 eval = 每改一版 prompt 都是 vibe judge,改不动也说不清为什么。 也意味着 portfolio 故事没数字撑。 v1 eval 不要 over-engineer,但 **W0 prep 必须 set up**。

## 13. v1 要 eval 什么(明确范围)

v1 两个 agent,各自 eval:
- **Root agent**:outline 生成质量
- **Leaf agent**:节点对话 + tool use 质量

**v1 不 eval**(全部 v2/v3 的事):
- ❌ Stale propagation 准确性(v1 没这功能)
- ❌ Specialist 路由正确率(v1 没 specialist)
- ❌ Cross-tree memory 召回(v1 没长期 memory)
- ❌ Aggregation query 质量(v1 没 Global Q&A)

## 14. Root Agent Eval(outline 生成)

最 high-stakes — outline 错了后面 leaf 全错。

| 维度 | 怎么测 | Target | 类型 |
|---|---|---|---|
| **Coverage** | 跑 10 fixed goal,人工判断 outline 是否覆盖该 goal 的核心 subtopic(参照专家清单 / wiki TOC) | 80%+ 覆盖率 | 人工 |
| **Granularity** | 同一 goal 跑 5 次,node count 的方差。 太散(每次 5/30/12 个)= 不稳 | std/mean < 0.3 | 自动 |
| **Non-overlap** | LLM 自评 + 人工抽查: sibling 之间 conceptual overlap | <20% pair-wise | 半自动 |
| **Personalization** | 同一 goal 两个不同 clarifying answer(e.g. "我是 SWE" vs "我是 designer"),outline 实质不同 | 人工: 明显不同 | 人工 |

## 15. Leaf Agent Eval(节点对话)

| 维度 | 怎么测 | Target | 类型 |
|---|---|---|---|
| **Tool use success rate** | 20 个会触发 web search 的 query,统计 (a) agent 决定调 tool 的比例 (b) tool 调用参数合理的比例 (c) tool result 被合理 integrate 进回答的比例 | (a) >80% (b) >90% (c) >70% | 自动 (a/b) + 人工 (c) |
| **Sibling awareness** | 同一棵树点不同 leaf 问相似问题,看回答 overlap | <30% content overlap | 人工 |
| **ReAct loop 终止合理性** | 20 次对话,iteration 分布。 平均 2-4 轮合理;>10 轮 stuck;1 轮可能不会用 tool | mean 2-5,P95 < 8 | 自动 |
| **Refusal / hallucination** | Tool 失败时 agent 是说 "搜不到" 还是编内容? | 0 hallucination on failed tool | 人工 |
| **Summary schema 完整度** | end_turn 时生成的 `summary_for_parent` 是否 4 字段全填、类型正确 | 100% schema valid | 自动 |
| **Summary status 准确性** | 抽 10 个 leaf 对话,人工判断 status 自评(mastered/partial/confused)是否符合实际对话内容 | ≥80% 与人工一致 | 人工 |

## 16. Test Set(W0 必须 prep)

**10 个 root goal**(覆盖 type / 难度 / edge case):

| # | Goal | 测什么 |
|---|---|---|
| 1 | 理解 RLHF 的核心思想 | Concept-heavy outline |
| 2 | Transformer 怎么工作 | Concept-heavy, 涉及多层 |
| 3 | 学会用 PostgreSQL | Skill-oriented |
| 4 | 如何写好的 user research | Skill, soft topic |
| 5 | 从 SWE 转 AIPM 应该准备什么 | 你自己的 use case |
| 6 | 为我的 side project 写一份 PRD | Project-based |
| 7 | RAG 和 fine-tuning 该怎么选 | Comparison |
| 8 | 我想了解 AI | 模糊 goal,看 clarifying 起作用 |
| 9 | 学会 machine learning | 太大 goal,看 root 怎么处理 |
| 10 | 我已经 build 过 LLM app,想理解 agent | Personalization 测试(对比白纸用户) |

**20 个 leaf scenario**(每个含 parent context + 2 sibling context + user message):

设计原则:
- 一半需要 web search,一半纯推理
- 一半故意问 sibling 已经覆盖的(测 sibling awareness)
- 几个 user "我想试试边界": 问 off-topic、试 prompt injection
- 几个明显需要拒答 / clarify 的

具体 20 个 scenario 在 `eval-scenarios.md`(W0 prep 准备)。

## 17. Eval Cadence

| 时间点 | 跑什么 |
|---|---|
| **W0 prep** | 写 eval framework + test set + 跑分脚本骨架 |
| **W1 ship 后** | Leaf-only eval baseline,数字记下来 |
| **W2 ship 后** | Root + leaf 联合 eval baseline |
| **W3 期间** | 每改一版 prompt → 重跑自动 metric。 人工 metric 周末跑 |
| **W3 ship 后** | 完整 eval,数字进 portfolio / blog |

## 18. Eval Anti-Patterns

- ❌ **Build eval 比 build product 还久** — v1 eval 第一版 2-3 小时写完,不是 2-3 天
- ❌ **Skip 人工 metric 因为麻烦** — AIPM 面试官问 "you eval'd by what" 答案的灵魂在人工 metric。 "我跑了 10 个 goal 人工打分" 比 "我跑了 1000 个自动测试" 更打动面试官
- ❌ **Test set 中途改** — W0 锁定后不再加 / 减,只有这样改 prompt 才能 apples-to-apples 比较
- ❌ **追求 100% pass** — Target 设的是 reasonable threshold,不是 perfection。 "60% coverage" 是数据点不是失败

## 19. v1 Eval 不做的事(全部 defer)

- ❌ LLM-as-judge 自动化人工 metric — v2 才加
- ❌ A/B test 框架 — v2 才有意义
- ❌ User-side eval(true user feedback) — Week 3 ship 后做,但是 qualitative interview 不是 quant metric
- ❌ Regression test 自动化 in CI — solo project 不需要

---

# Part VI — Guardrails

## 20. Hard Rules(v1 sprint 期间不可妥协)

1. **No new product ideas until Week 1 ships.** Ideation 全部 pause。
2. **3 周时间盒。** Day 21 ship or retreat,不延期。 不 ship → 回退 LLM wrapper 故事 + portfolio。
3. **15+ 小时/周。** 低于此立即缩 scope。
4. **TypeScript only.** 不学 Python。
5. **Tree only.** 不动 DAG。
6. **Ship trumps polish.** 朋友 5 分钟能用 > 漂亮但跑不起来。

## 21. Forbidden Anti-Patterns

- ❌ 中途加 feature 因为想到了新点子
- ❌ "顺手做了 v2 的 X" — v2 的东西**永远 defer 到 v1 ship 后**
- ❌ Agent loop 没工作前先 polish UI
- ❌ 担心商业模式 / PMF / 增长
- ❌ 跟 BranchCanvas / Heptabase / Roam 对比焦虑
- ❌ 为了"选最好的 framework"读更多 framework
- ❌ **Eval framework over-build**(参见 §18)

**每次加 task / 想新 idea,自问**:"这个 v1 sprint 必要吗?"答"不必要"或"不知道" → defer。

---

# Part VII — 显式 Out of Scope(v2/v3 backlog 索引)

下面这些**全部不在 v1**,看见有想做的冲动 → 看一眼这份列表 → 关掉冲动。 具体设计见 `design-doc-full.md`。

| 想做的事 | 属于 | 为什么不在 v1 |
|---|---|---|
| Stale tag + 传播 | v2 | v1 用户编辑频率低,装上是 cost,无收益 |
| `summary_for_user` 第二份 summary | v3 | v1 没消费者(Global Q&A 是 v3) |
| Title type 5 分类驱动行为 | v2 | v1 不接 specialist,type 不驱动任何东西 |
| Reference edge + UX | v2 | v1 简化:tree-only,需要时 future 加 |
| `derived_from` edge | v2 | v1 没 bottom-up promotion |
| Specialist agent library | v2 | v1 只一个通用 leaf agent |
| Meta-agent 选 specialist | v3 | 没 library 就没需要选 |
| 长期 memory facts(跨树) | v3 | v1 单树 |
| Slot-based parent view | v3 | v1 整树 JSON 就够 |
| Cross-child lazy synthesis | v3 | 同上 |
| Map agent(背景抗熵) | v3 | 需要图大到熵积累,v1 不会 |
| Global Q&A(Ask the Map) | v3 | 需要图大到值得 query,v1 不会 |
| Bottom-up entry | v2 | top-down 先验证 |
| LLM-as-judge / A/B eval | v2 | v1 eval 人工打分够用 |
| 用户自定义 specialist | v4+ | v3 完了再说 |
| Community marketplace | v4+ | 同上 |

---

## 22. Portfolio Story(v1 ship 后用)

> 我做了一个 minimal multi-agent harness,mind map 是 user-facing 的 orchestration topology。
>
> 系统有两层 agent:
> - **Root agent (planner)**: 把 learning goal 通过 3 步对话(clarify → confirm → outline)拆解成 mind map of subtopics
> - **Leaf agent (specialists)**: 处理每个节点的对话,能调工具(web search、fetch)真实 grounding
>
> 区别于大部分 multi-agent system 的 orchestration 是黑盒 — **mind map IS the orchestration graph** — 可编辑、可审查、可持久。 用户能 pause 任何 agent、edit 任何 node、redirect 任何 subtask。
>
> v1 故意砍掉了 stale propagation 和 specialist library 这些复杂度,**因为我把 reactive memory propagation 在 LLM cost 约束下的 trade-off 当成核心设计问题** — 装一套传播机器但用户没痛点会让 cost 不必要地翻倍。 这是 v1 sprint 期间最重要的 design discipline。
>
> Eval 我跑了 10 个 fixed goal + 20 个 fixed leaf scenario,coverage [X]% / sibling overlap [Y]% / tool use success rate [Z]% / 平均 ReAct iteration [N] 轮 / leaf agent 自评 status 与人工一致率 [W]%。 这是 baseline,v2 会针对 [最弱的维度] 重点改进。
>
> Thesis:随着 agent 能力变强,瓶颈从 capability 转向 **steerability**。 Topology-as-UI 是一种答案。

**对齐主题**:Anthropic 的 interpretability / steerability themes、Cognitive UX、Transparent personalization、System design under cost constraints、Eval-driven iteration

---

*Locked 2026-05-11 by Yvonne + Claude.*
*Next update: Week 3 ship 后的 retro。*
*Sprint 期间任何 v2/v3 冲动:翻 `design-doc-full.md`,看完关闭,回 v1。*
