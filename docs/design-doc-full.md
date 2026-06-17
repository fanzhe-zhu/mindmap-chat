# Mind Map Chat — Full Vision Design Doc (v1 / v2 / v3+)

> **Status**: Living vision doc(每条规则带版本标签)
> **Version**: 2026-05-11(updated after v1 scope critique)
> **Companion**: `design-doc-v1.md`(v1-only build spec)— **sprint 期间用那份**,这份用于规划 / portfolio 故事 / v2 启动时回看
> **Legend**:
>   - `[v1]` — 当前 sprint 必须 build
>   - `[v2]` — v1 ship 后下一个 sprint 候选
>   - `[v3+]` — 远期,v2 dogfood 后再决定

---

## TL;DR

**What**:A multi-agent harness where mind map IS the orchestration graph — editable, inspectable, steerable.

**Two-layer thesis**:
- 表层:Linear chat is a UX bug
- 底层:Mind map = multi-agent 系统的 **user-facing orchestration topology**

**核心哲学**:节点边界 = 思考权和规划权的分界线
- 节点**之间**(系统帮): 生成大纲、铺节点、组织结构
- 节点**之内**(用户来): 提问、思考、追问

**Route**:Portfolio,不是 startup。 目标 Anthropic / Pika 级 AI 公司 PM offer

**Tech stack**:Next.js 14 + TypeScript + React Flow + Anthropic SDK + Brave/Tavily + localStorage(v1)/ DB(v2+)+ Vercel。 **禁用** LangGraph / CrewAI / AutoGen

**Time box**:v1 = 3 周硬截止,15+ hr/week

---

# Part I — Foundation

## 1. 项目元决策

| 决策 | 内容 | 理由 |
|---|---|---|
| 路线 | Portfolio,不是 startup | "Shipped prototype + 清晰 case study" > "用户、增长、商业模式" |
| v1 形态 | Multi-agent harness | 真 agent system,不是 LLM wrapper |
| 时间盒 | v1 = 3 周硬截止 | Portfolio 路线下 shipped 远比 polished 重要 |
| 投入 | 15+ hr/week | 低于此必须缩 scope,不能拖时间 |
| Tech stack | TS / Next.js / React Flow / Anthropic SDK | 复用已有 TS 经验 |
| Framework 政策 | 禁用 LangGraph / CrewAI / AutoGen | 抽象掉的恰恰是 portfolio 要展示的判断力 |

**v1 ship fallback**:3 周到了没做完 → 退回 LLM wrapper 故事 + portfolio,**不延期**

## 2. Product Thesis(双层)

**表层(UX 层)**:Linear chat is a UX bug。 人的思考是 tree-shaped 的。

**底层(架构层)**:Mind map 不是 chat 的 visualization,是 **multi-agent 系统的 user-facing orchestration topology**。 用户可以 pause 任何 agent、edit 任何 node、redirect 任何 subtask。

## 3. 核心哲学:节点边界

**节点边界 = 思考权和规划权的分界线**

| 在哪里 | 谁来做 | 做什么 |
|---|---|---|
| 节点**之间** | 系统 | 生成大纲、铺节点、组织结构、维护 reactivity(v2+) |
| 节点**之内** | 用户 | 提问、思考、追问、close |

区别于 Deep Research / Manus 等 auto-planning agent — 他们替用户做完所有事,**剥夺 cognitive work**。 这是产品灵魂,**所有设计决策回到此原则检验**。

## 4. 不是什么(同样重要)

- ❌ 不是严格意义 agent system(v1 节点是 LLM call + tool use,v2 才升级 specialist)
- ❌ 不是 ChatGPT 竞品
- ❌ 不是 auto-planning agent(全自动跑完所有节点)
- ❌ 不是笔记工具(对话是一等公民)

## 5. Design Principles

| # | 原则 | 含义 |
|---|---|---|
| 1 | 节点之间系统化,节点之内人工化 | Cognitive load 在外,cognitive work 在内 |
| 2 | 系统提议,用户决策 | 所有 CRUD agent 只能 propose,用户保留 final say |
| 3 | Personalization 显式呈现 | Agent 必须 summarize 它对用户的理解,等 confirm |
| 4 | Brute-force 优先 | 架构复杂度只能由 brute-force 失败的具体痛点解锁,不预设 |
| 5 | 诚实命名 | v1 leaf agent(有 tool use)、v2 才叫 specialist |
| 6 | Title 匹配认知姿态 | [v2+] Title 形式匹配认知功能(见 §10) |

---

# Part II — System Design

## 6. Agent Architecture

### 6.1 Stateless function,不是 actor `[v1+]`

- 每次 run 重组 context,无 agent 实例对象
- 理由:Anthropic SDK 原生 stateless;actor 模型(message queue / ack / retry)是 v3+ 的事
- 跨所有版本保持 stateless,直到 brute-force 失败才考虑 actor

### 6.2 State 住在 Node 上 `[v1+]`

- 所有 agent state(messages array)作为 Node 字段
- Node = single source of truth
- 不引入 graph 层 global state

### 6.3 Agent 权限边界

| 操作 | v1 | v2 | v3+ |
|---|---|---|---|
| 写自己 node 的 messages | ✅ | ✅ | ✅ |
| 写自己 node 的 summary | ✅ end_turn 时 | ✅ | ✅ |
| 提议新 node | ✅ 用户确认 | ✅ | ✅ |
| 提议 reference edge | ❌ 无 ref edge | ✅ 用户确认 | ✅ |
| 直接创建子 node | ❌ | ❌ | ❌(永远不) |
| 改别的 node 内容 | ❌ | ❌ | ❌(永远不) |
| Archive / delete 别的 node | ❌ | ❌ | ❌(永远不) |

**核心(所有版本)**:Agent 在自己 node 内有完全权力,跨 node 必须 escalate 到用户

### 6.4 Trigger 模式

| 版本 | 支持的 trigger | 理由 |
|---|---|---|
| `[v1]` | 只 manual(用户点节点 / 发消息) | 最小可行 |
| `[v2]` | + upstream-auto(父节点更新 → 子节点 mark stale) | 前置依赖:reactivity 传播规则成熟 |
| `[v3+]` | + cron / scheduled | 暂不规划 |

### 6.5 "完成"两层 `[v1+]`

- **Turn-level**:`stop_reason === "end_turn"` 时 ReAct loop 终止
- **Node-level**:节点学习/任务"完成"是**用户决定**,不是 agent 自决

Agent 不应自己决定"我够了"。 Node closure 是用户行为,保护 cognitive ownership。

## 7. Memory Model

### 7.1 三层 Memory 架构(分版本)

| 层级 | 内容 | 范围 | v1 | v2 | v3+ |
|---|---|---|---|---|---|
| **短期** | 节点级(messages + summary) | 单节点 | ✅ | ✅ | ✅ |
| **中期** | 树级 memory(goal、整体进展) | 单棵树 | ❌ | 候选 | ✅ |
| **长期** | 用户画像 facts | 跨所有树 | ❌ | ❌ | ✅ |

**v1 简化**:单棵树,无长期 memory,无中期 memory。 整棵树通过 ancestors_summary_chain + siblings_metadata 喂给 leaf agent(见 §9)。

### 7.2 长期 memory 用 Facts,不用 Summary `[v3+]`

- 结构化抽取的 facts(带 timestamp),不是 narrative summary
- 避免 "summary of summaries" 累积失真
- 新 fact supersede 旧 fact,但旧 fact 进 history

## 8. Schema(分版本)

### 8.1 v1 Schema `[v1]`

```typescript
type Node_v1 = {
  // Identity
  id: string
  parent_id: string | null
  created_at: timestamp
  updated_at: timestamp
  
  // Content
  title: string          // free-form,LLM 自然生成
  one_liner: string      // ≤25 字
  
  // Agent runtime
  system_prompt: string  // base + injected sibling awareness
  messages: Message[]    // Anthropic SDK messages array
  tool_config: ToolConfig
  
  // Summary(v1 只一份,structured)
  summary_for_parent: SummaryForParent_v1 | null
  
  // Lifecycle(简化)
  status: 'active' | 'archived'
  
  // Metadata
  tags: string[]
  user_notes: string | null
}

type SummaryForParent_v1 = {
  topic: string               // 这个节点讨论什么(1 句)
  key_takeaways: string[]     // 核心 point(3-5 条)
  status: 'mastered' | 'partial' | 'confused'  // LLM 自评(v1 接受 imperfect)
  open_questions: string[]    // 未解决问题(0-N 条,为 v3 Global Q&A Gap pattern 留接口)
}

type Edge_v1 = {
  type: 'parent'         // v1 只一种
  from: NodeId
  to: NodeId
}
```

### 8.2 v2 新增字段 `[v2]`

```typescript
type Node_v2 = Node_v1 & {
  title_type: 'concept' | 'skill' | 'reference' | 'task' | 'comparison'
  //   ↑ v2 启用:不同 type 装不同 specialist
  freshness_version: number
  //   ↑ v2 启用:reactivity 系统需要
  status: 'active' | 'stale' | 'archived'
  //   ↑ v2 扩展:加 'stale' 状态
}

type Edge_v2 = Edge_v1 | {
  type: 'reference'
  from: NodeId
  to: NodeId
  reason: string  // agent / 用户填的"为什么 link"
}
```

### 8.3 v3 新增字段 `[v3+]`

```typescript
type Node_v3 = Node_v2 & {
  summary_for_user: string | null  // 给 Global Q&A 看,自然语言
  //   ↑ v3 启用:Global Q&A agent 需要
}

type Edge_v3 = Edge_v2 | {
  type: 'derived_from'
  from: NodeId      // 新 node
  to: NodeId        // promote 来源
}
//   ↑ v3 启用:bottom-up promotion provenance

// v3 长期 memory schema
type UserFact = {
  id: string
  category: string  // 'preference' | 'history' | 'goal' | 'context'
  content: string
  timestamp: timestamp
  superseded_by: string | null
}
```

### 8.4 关键设计决定

- **不存独立 `agent_state` 字段** — state 就是 messages array
- **两份 summary**(v3 才齐): 给 agent 看 vs 给用户看,**消费者不同所以 summary 不同**
- **`summary_for_parent` 是 structured(4 字段),`summary_for_user` 是 free-form narrative** — agent 消费者要稳定 schema 方便程序拼 context;用户消费者要自然语言读起来顺
- **`open_questions` 字段 v1 就存** — 即使 v1 没 Global Q&A,字段先存好,v3 启用时零 migration
- **Tree-only,只 v2 加 reference edge**(还不是 DAG)
- **`derived_from` 是 v3 才用的 provenance**(因为 v2 才有 bottom-up promotion)

## 9. Context Propagation

### 9.1 v1 默认 Context `[v1]`

```
1. node.system_prompt(含 base + sibling awareness 注入)
2. node.messages(自己的对话历史)
3. ancestors_summary_chain
   = [root.summary_for_parent, ..., parent.summary_for_parent]
4. siblings_metadata: [{title, one_liner}, ...]
   (注入到 system_prompt,告知"不重复 sibling 已覆盖方向")
```

### 9.2 v2 增加 `[v2]`

- Reference edge 目标(agent 通过 tool call 主动 retrieve)
- 完整 sibling summary(按需,通过 tool call)

### 9.3 v3+ 增加 `[v3+]`

- 长期 facts memory(root agent 启动时 load)
- 中期 tree memory(树内任意 agent 可读)
- 其他 subtree 内容(按 vector index retrieve)

**核心原则(全版本)**:**垂直 chain 默认 load(短且必要),横向跨支按需取(数量不可控)**

### 9.4 Sibling Awareness `[v1+]`

- 每个 leaf agent 的 system prompt 注入 sibling list(title + one_liner)
- 明确告知: "以下 sibling 已覆盖这些方向,不要重复"
- **理由**:v0 dogfood 撞到的真问题 — agent 推荐用户去问 sibling node 已经在讲的内容

## 10. Reactivity(分版本最大)

### 10.1 v1 Reactivity `[v1]`

**极简**:用户编辑 node 的 messages → 在下次 agent run 的 end_turn 时 regenerate `summary_for_parent`(1 次 LLM call)→ 完成。

**v1 不做**:descendant 传播、parent 上传、stale UX、reference 影响。 用户想 re-run 下游 → **手动点**。

**为什么 v1 不做完整 reactivity**:v1 用户头三周大概率不反复编辑上游 node。 装上传播机器是 cost(代码 + 维护 + 认知 + LLM call),v1 几乎无收益。

### 10.2 v2 Reactivity `[v2]`

**Edit 触发的完整传播**:
```
1. node.freshness_version += 1
2. node.summary_for_parent regenerate
3. mark all descendants stale:
   {stale_because: node.id, since_version: new_version}
4. mark all reference-edge sources stale(reason: "referenced node changed")
```

**Summary 上传规则(关键 cost insight)**:
```
node.messages 变 → node.summary_for_parent regenerate
if summary 实质变化(diff above threshold)
  → parent.freshness_version += 1
  → recursively up to root
```

**核心 insight**:messages 改不自动传 parent,**只有 summary 实质变化才传**。 避免每改一字 root 都 stale。 **这是 LLM cost 约束下设计 reactivity 的核心 trade-off**。

### 10.3 Stale UX `[v2]`

- 视觉:stale node 周围淡黄 ring + 角标 "based on outdated parent"
- 用户点 stale node:弹 banner "Context has changed. [Re-run agent] [Ignore]"
- 可 ignore:是。 但 stale 状态持久,每次打开提示一次
- 自动 expire:**不做**。 用户行为决定(re-run / dismiss)

### 10.4 Aggregation Query 看到什么 `[v3+]`

- 默认看 latest content(不管 stale)
- 在响应里 **flag** 哪些 stale
- 理由:看 latest 保证 query 始终有结果;flag stale 给 metacognitive signal;用户决定要不要 refresh 后重问

---

# Part III — UX

## 11. Root Agent 启动流(3 步对话)`[v1+]`

| 步 | 行为 | 目的 |
|---|---|---|
| 1 | **Clarifying questions** — agent 反问 1-2 个最关键问题 | 不把用户当白纸 |
| 2 | **Confirm understanding** — agent 显式 summarize | Transparency |
| 3 | **Generate outline** — confirm 后才生成 mind map | 个性化前提 |

**理由**:v0 dogfood 撞到 — 直接生成大纲会给通用 syllabus,把用户当白纸

## 12. Title Type System

### 12.1 v1: 不做行为分支 `[v1]`

- v1 不存 `title_type` 字段
- Title 由 LLM 自然生成,style 随 context(question / noun phrase / imperative 都可)
- 不强制统一 — v0 dogfood 显示统一化反而效果差

### 12.2 v2: 启用 type 驱动 specialist `[v2]`

| Type | 认知姿态 | Title 风格 | 例 |
|---|---|---|---|
| `concept` | 想理解 | Question | "How does attention work?" |
| `skill` | 想学会做 | Imperative | "How to call the API" |
| `reference` | 想查 | Noun phrase | "Attention variants" |
| `task` | 想完成 | Action phrase | "Polish my resume" |
| `comparison` | 想比较/决定 | Comparison/question | "RNN vs Transformer" |

**v2 实现**:LLM 在 outline generation 时分类 + 写 matching title。 不同 type 装不同 specialist system prompt(concept → tutor mode、skill → coach mode、reference → search mode、task → action mode、comparison → analyst mode)。

**为什么 v1 不做**:v1 没 specialist,type 不驱动任何东西 → cosmetic over-engineering。

**v2 前需验证**:5 种 type 是否合适?可能 3 种(concept/skill/task)够,也可能要 7 种。 v2 启动前重新做一次 outline 分类 ground truth check。

## 13. Node 开场体验 `[v1+]`

每个节点**首次打开**,UI 上方显示:

1. **One-liner**(≤25 字):节点要回答什么
2. **Intro**(2-3 句):tutor 风格开场(**无 markdown header / 列表**)
3. **3 个推荐问题**:具体、actionable、严格控制本节点 scope,不跨 sibling

**目标**:用户进入节点第一秒,从"我得想问什么"变成"我想点哪个"

**生成时机**:节点创建时 prefetch(避免点开等)

## 14. Tool Use 可见 `[v1+]`

- 节点 agent 调工具时,UI 显示 "agent is searching the web" indicator(streaming)
- Transparency;区别于 ChatGPT 的黑盒搜索

## 15. 入口模式

| 版本 | 支持的入口 |
|---|---|
| `[v1]` | Top-down only(用户给 goal → 系统生成 mind map) |
| `[v2]` | + Bottom-up(用户从一个 node 开始随便聊 → 概念识别 → 结构涌现) |

**v2 bottom-up 实现路径**:
- 节点对话中 agent 后台跑 concept extraction
- 识别到概念 → UI 提示 "💡 detected: X, Y, Z",用户可一键 promote 成新 node
- Agent 提议挂载位置(当前节点子节点 / sibling / 新 root),用户决策
- 这时 `derived_from` edge 启用(provenance)

**v2 默认 UX**:默认 top-down,"I just want to chat first" 作为 escape hatch

---

# Part IV — Roadmap

## 16. Agent 化路线图

| 阶段 | 节点形态 | 是否真 agent | Time horizon |
|---|---|---|---|
| **v0** | LLM call + system prompt | ❌ LLM wrapper | 已 done |
| **v1** | LLM call + tool use + ReAct loop | ✅ 最小 agent | 3 周 sprint |
| **v2** | Specialist agent(topic-aware + 多工具) | ✅ 真 specialist | v1 ship 后下一 sprint |
| **v3** | Meta-agent 选 specialist + library + Map agent + Global Q&A | ✅ Multi-agent system | v2 ship 后,根据 dogfood 决定 |
| **v4+** | 用户自定义 specialist + community marketplace | Agent ecosystem | 远期,先 ship v1-v3 |

**不会走的路**:❌ Goal-driven 全自动 agent(用户给 goal,agent 自己跑完所有节点)— 违反"不替用户思考"哲学

## 17. v0 → v1 Dogfood Insights → 必落地 `[v1]`

6 项 v0 撞到的真问题,**v1 必须落地**:

1. Root agent 必须 ask clarifying questions(不预设白纸)
2. Title 由 LLM 自然生成(不一律 question)— **v1 不做分类**,v2 才做
3. Node 开场 = one-liner + intro + 3 starter questions
4. Leaf agent 必须 sibling-aware(prompt 注入 sibling metadata)
5. 用户必须能手动建 node(基础 UX,非可选)
6. UI 文字颜色对比度足够

## 18. 3-Week Sprint Plan(v1)

### Week 1:Single Agent CLI
- **Ship**:CLI 脚本。"Weather in Tokyo?" → web_search → ReAct → 答用户
- **Success**:能 debug、能解释 loop 终止、知道 token 消耗

### Week 2:Root + Leaf CLI
- **Ship**:CLI。 goal → root agent 3 步流 → outline JSON → 选 node → leaf agent ReAct 对话
- **Success**:能解释 root 与 leaf 的 context 差别、sibling awareness 落地、Week 1 代码作为 leaf base
- **不做**:"Tokyo trip planner+executors+synthesizer" 那种 generic toy — pattern v1 不用,直接做 root+leaf 更直线

### Week 3:Web App Integration
- **Ship**:Web app。 root agent UI → React Flow mind map → leaf node 对话(tool use 可见)→ localStorage 持久化
- **Success**:朋友 5 分钟想问 "what's underneath this?"、你自己用它准备真 AIPM mock

## 19. v2 Backlog

**v1 ship 后,根据 dogfood pick 1-2 个**:

- Reactivity 完整传播 + stale UX(v2 头号候选,因为这是 portfolio 的 reactive memory propagation 故事的真章)
- Specialist agent library + type-driven 路由
- Bottom-up entry + concept extraction + promotion UI
- Reference edge UX(可拖拽)
- Title type 分类 ground truth check + 启用

## 20. v3+ Backlog(远期)

- Specialist library + meta-agent 选 specialist
- 长期 memory facts schema(跨树)
- 中期 tree memory(树级 goal / 进展)
- Slot-based parent view + cross-child lazy synthesis
- Map agent(后台抗熵)
- Global Q&A("Ask the Map") + `summary_for_user`
- `derived_from` edge(配合 bottom-up promotion)
- Share / clone mind map
- Schema 演化:DAG / multi-parent(撞到真痛点才做)

---

# Part V — Map-level Agents 设计(v3+,记录用)

## 21. Map Agent(抗熵 background agent)`[v3+]`

- 不在用户对话路径
- 后台定期跑
- 工作:检测重复节点、孤儿节点、可合并节点
- 输出走专门 review queue,不打断 user flow
- 不持有全图 context,通过 vector index retrieve

## 22. Global Q&A Agent("Ask the Map")`[v3+]`

- 独立入口(不嵌 root 节点)— 避免 context 污染
- 工具集:`retrieve_relevant_nodes`、`get_node_summary`、`get_tree_progress`、`get_user_facts`、`compare_nodes`
- 4 种 question pattern:Progress / Connection / Gap / Synthesis

## 23. Slot-based Parent View `[v3+]`

- 父节点对子节点的 memory 按槽位存储:`parent_view = {child_A: summary_A, child_B: summary_B, ...}`
- CRUD 是槽位操作(删、替换、move + recontextualize)
- Cross-child synthesis 用 lazy view:槽是 source of truth,合成是 derived view,可丢可重建

---

# Part VI — Guardrails

## 24. Hard Rules(v1 sprint 期间不可妥协)`[v1]`

1. **No new product ideas until Week 1 ships.** Ideation 全部 pause。
2. **3 周时间盒。** Day 21 ship or retreat,不延期。
3. **15+ 小时/周。**
4. **TypeScript only.** 不学 Python。
5. **Tree only.** 不动 DAG。
6. **Ship trumps polish.** 朋友 5 分钟能用 > 漂亮但跑不起来。

**v2+ 启动时,这些 rules 重新 review,不自动延续。**

## 25. Forbidden Anti-Patterns

- ❌ 建之前再设计 schema(已设计完,不返回)
- ❌ 为了"选最好的 framework"读更多 framework
- ❌ 中途加 feature 因为想到了新点子
- ❌ "顺手做了 v2 的 X" — v2 的东西**永远 defer 到 v1 ship 后**
- ❌ Agent loop 没工作前先 polish UI
- ❌ 担心商业模式 / PMF / 增长
- ❌ 跟 BranchCanvas / Heptabase / Roam 对比焦虑
- ❌ v1 阶段叫节点 "agent" 直到它真调工具

## 26. Portfolio Story(锁定)

> 我做了一个 minimal multi-agent harness,mind map 是 user-facing 的 orchestration topology。
>
> 系统有两层 agent:
> - **Root agent (planner)**:把 learning goal 通过 3 步对话拆解成 mind map of subtopics
> - **Leaf agent (specialists)**:处理每个节点的对话,能调工具(web search、fetch)真实 grounding
>
> 区别于大部分 multi-agent system 的 orchestration 是黑盒 — **mind map IS the orchestration graph** — 可编辑、可审查、可持久。 用户能 pause 任何 agent、edit 任何 node、redirect 任何 subtask。
>
> v1 故意砍掉了 stale propagation 和 specialist library 这些复杂度。 **因为我把 reactive memory propagation 在 LLM cost 约束下的 trade-off 当成核心设计问题** — 装一套传播机器但用户没痛点会让 cost 不必要地翻倍。 v2 的 reactivity 系统(§10.2)是这个 trade-off 的正面回答:summary 不全量传播、stale 不 auto-refresh,让 N 节点的图不变成 N² 次 LLM call。
>
> Thesis:随着 agent 能力变强,瓶颈从 capability 转向 **steerability**。 Topology-as-UI 是一种答案。

**对齐主题**:
- Anthropic 的 interpretability / steerability themes
- Cognitive UX(linear chat is a UX bug)
- Transparent personalization
- System design under cost constraints

---

*Locked 2026-04-30 by Yvonne + Claude.*
*Reorganized 2026-05-11(v1 critique fix + version tags throughout).*
*Next update: v1 ship 后 retro。*
