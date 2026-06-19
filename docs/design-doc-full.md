# Mind Map Chat — Full Vision Design Doc (v1 / v2 / v3+)

> **Status**: Living vision doc (each rule carries a version tag)
> **Version**: 2026-05-11 (updated after v1 scope critique)
> **Companion**: `design-doc-v1.md` (v1-only build spec) — **use that one during the sprint**; this one is for planning / portfolio story / looking back when v2 kicks off
> **Legend**:
>   - `[v1]` — must build in the current sprint
>   - `[v2]` — candidate for the next sprint after v1 ships
>   - `[v3+]` — long-term, decide after dogfooding v2

---

## TL;DR

**What**: A multi-agent harness where mind map IS the orchestration graph — editable, inspectable, steerable.

**Two-layer thesis**:
- Surface layer: Linear chat is a UX bug
- Underlying layer: Mind map = the **user-facing orchestration topology** of a multi-agent system

**Core philosophy**: A node boundary = the dividing line between thinking authority and planning authority
- **Between** nodes (the system helps): generate the outline, lay out nodes, organize structure
- **Within** a node (the user does it): ask questions, think, follow up

**Route**: Portfolio, not startup. Goal: a PM offer at an AI company on the level of Anthropic / Pika

**Tech stack**: Next.js 14 + TypeScript + React Flow + Anthropic SDK + Brave/Tavily + localStorage (v1) / DB (v2+) + Vercel. **Forbidden**: LangGraph / CrewAI / AutoGen

**Time box**: v1 = 3-week hard deadline, 15+ hr/week

---

# Part I — Foundation

## 1. Project Meta-Decisions

| Decision | Content | Rationale |
|---|---|---|
| Route | Portfolio, not startup | "Shipped prototype + clear case study" > "users, growth, business model" |
| v1 form | Multi-agent harness | A real agent system, not an LLM wrapper |
| Time box | v1 = 3-week hard deadline | On the portfolio route, shipped matters far more than polished |
| Commitment | 15+ hr/week | Below this, must cut scope — do not stretch the timeline |
| Tech stack | TS / Next.js / React Flow / Anthropic SDK | Reuse existing TS experience |
| Framework policy | Forbid LangGraph / CrewAI / AutoGen | What they abstract away is exactly the judgment the portfolio needs to show |

**v1 ship fallback**: If the 3 weeks are up and it's not done → fall back to the LLM wrapper story + portfolio, **no extension**

## 2. Product Thesis (two layers)

**Surface (UX layer)**: Linear chat is a UX bug. Human thinking is tree-shaped.

**Underlying (architecture layer)**: The mind map is not a visualization of chat; it is the **user-facing orchestration topology of a multi-agent system**. The user can pause any agent, edit any node, redirect any subtask.

## 3. Core Philosophy: Node Boundaries

**A node boundary = the dividing line between thinking authority and planning authority**

| Where | Who does it | What they do |
|---|---|---|
| **Between** nodes | System | Generate the outline, lay out nodes, organize structure, maintain reactivity (v2+) |
| **Within** a node | User | Ask questions, think, follow up, close |

This differs from auto-planning agents like Deep Research / Manus — they do everything for the user, **stripping away the cognitive work**. This is the soul of the product, and **every design decision is checked back against this principle**.

## 4. What It Is Not (equally important)

- ❌ Not an agent system in the strict sense (v1 nodes are LLM call + tool use; only v2 upgrades to specialists)
- ❌ Not a ChatGPT competitor
- ❌ Not an auto-planning agent (running through all nodes fully automatically)
- ❌ Not a note-taking tool (conversation is a first-class citizen)

## 5. Design Principles

| # | Principle | Meaning |
|---|---|---|
| 1 | Systematize between nodes, leave the within-node to humans | Cognitive load on the outside, cognitive work on the inside |
| 2 | System proposes, user decides | All CRUD agents can only propose; the user retains the final say |
| 3 | Personalization shown explicitly | The agent must summarize its understanding of the user and wait for confirmation |
| 4 | Brute-force first | Architectural complexity can only be unlocked by a concrete pain point where brute-force fails — not presupposed |
| 5 | Honest naming | v1 leaf agent (has tool use); only v2 is called a specialist |
| 6 | Title matches cognitive stance | [v2+] Title form matches cognitive function (see §10) |

---

# Part II — System Design

## 6. Agent Architecture

### 6.1 Stateless function, not an actor `[v1+]`

- Each run reassembles context; there is no agent instance object
- Rationale: the Anthropic SDK is natively stateless; the actor model (message queue / ack / retry) is a v3+ matter
- Stay stateless across all versions, until brute-force fails do we consider an actor

### 6.2 State Lives on the Node `[v1+]`

- All agent state (the messages array) lives as Node fields
- Node = single source of truth
- Do not introduce graph-layer global state

### 6.3 Agent Permission Boundaries

| Operation | v1 | v2 | v3+ |
|---|---|---|---|
| Write its own node's messages | ✅ | ✅ | ✅ |
| Write its own node's summary | ✅ on end_turn | ✅ | ✅ |
| Propose a new node | ✅ user confirms | ✅ | ✅ |
| Propose a reference edge | ❌ no ref edge | ✅ user confirms | ✅ |
| Directly create a child node | ❌ | ❌ | ❌ (never) |
| Change another node's content | ❌ | ❌ | ❌ (never) |
| Archive / delete another node | ❌ | ❌ | ❌ (never) |

**Core (all versions)**: An agent has full power within its own node; anything cross-node must escalate to the user

### 6.4 Trigger Modes

| Version | Supported triggers | Rationale |
|---|---|---|
| `[v1]` | Manual only (user clicks a node / sends a message) | Minimum viable |
| `[v2]` | + upstream-auto (parent node updates → child nodes marked stale) | Prerequisite: reactivity propagation rules are mature |
| `[v3+]` | + cron / scheduled | Not planned yet |

### 6.5 Two Layers of "Done" `[v1+]`

- **Turn-level**: the ReAct loop terminates when `stop_reason === "end_turn"`
- **Node-level**: a node's learning/task being "done" is a **user decision**, not the agent's own call

The agent should not decide "I've had enough" on its own. Node closure is a user action, protecting cognitive ownership.

## 7. Memory Model

### 7.1 Three-Layer Memory Architecture (by version)

| Tier | Content | Scope | v1 | v2 | v3+ |
|---|---|---|---|---|---|
| **Short-term** | Node-level (messages + summary) | Single node | ✅ | ✅ | ✅ |
| **Mid-term** | Tree-level memory (goal, overall progress) | Single tree | ❌ | candidate | ✅ |
| **Long-term** | User-profile facts | Across all trees | ❌ | ❌ | ✅ |

**v1 simplification**: a single tree, no long-term memory, no mid-term memory. The whole tree is fed to the leaf agent via ancestors_summary_chain + siblings_metadata (see §9).

### 7.2 Long-Term Memory Uses Facts, Not Summary `[v3+]`

- Structured-extracted facts (with timestamp), not a narrative summary
- Avoids the accumulated distortion of "summary of summaries"
- A new fact supersedes an old fact, but the old fact goes into history

## 8. Schema (by version)

### 8.1 v1 Schema `[v1]`

```typescript
type Node_v1 = {
  // Identity
  id: string
  parent_id: string | null
  created_at: timestamp
  updated_at: timestamp
  
  // Content
  title: string          // free-form, naturally generated by the LLM
  one_liner: string      // ≤25 chars
  
  // Agent runtime
  system_prompt: string  // base + injected sibling awareness
  messages: Message[]    // Anthropic SDK messages array
  tool_config: ToolConfig
  
  // Summary (v1 has only one, structured)
  summary_for_parent: SummaryForParent_v1 | null
  
  // Lifecycle (simplified)
  status: 'active' | 'archived'
  
  // Metadata
  tags: string[]
  user_notes: string | null
}

type SummaryForParent_v1 = {
  topic: string               // what this node discusses (1 sentence)
  key_takeaways: string[]     // core points (3-5 items)
  status: 'mastered' | 'partial' | 'confused'  // LLM self-assessment (v1 accepts imperfect)
  open_questions: string[]    // unresolved questions (0-N items, leaves an interface for the v3 Global Q&A Gap pattern)
}

type Edge_v1 = {
  type: 'parent'         // v1 has only one kind
  from: NodeId
  to: NodeId
}
```

### 8.2 v2 New Fields `[v2]`

```typescript
type Node_v2 = Node_v1 & {
  title_type: 'concept' | 'skill' | 'reference' | 'task' | 'comparison'
  //   ↑ enabled in v2: different types load different specialists
  freshness_version: number
  //   ↑ enabled in v2: the reactivity system needs it
  status: 'active' | 'stale' | 'archived'
  //   ↑ extended in v2: add the 'stale' status
}

type Edge_v2 = Edge_v1 | {
  type: 'reference'
  from: NodeId
  to: NodeId
  reason: string  // "why link" filled in by the agent / user
}
```

### 8.3 v3 New Fields `[v3+]`

```typescript
type Node_v3 = Node_v2 & {
  summary_for_user: string | null  // for Global Q&A to read, natural language
  //   ↑ enabled in v3: the Global Q&A agent needs it
}

type Edge_v3 = Edge_v2 | {
  type: 'derived_from'
  from: NodeId      // new node
  to: NodeId        // promotion source
}
//   ↑ enabled in v3: bottom-up promotion provenance

// v3 long-term memory schema
type UserFact = {
  id: string
  category: string  // 'preference' | 'history' | 'goal' | 'context'
  content: string
  timestamp: timestamp
  superseded_by: string | null
}
```

### 8.4 Key Design Decisions

- **No standalone `agent_state` field** — state is just the messages array
- **Two summaries** (only complete in v3): one for the agent to read vs one for the user to read — **different consumers, so different summaries**
- **`summary_for_parent` is structured (4 fields), `summary_for_user` is free-form narrative** — the agent consumer needs a stable schema so context is easy to assemble programmatically; the user consumer needs natural language that reads smoothly
- **The `open_questions` field is stored from v1** — even though v1 has no Global Q&A, store the field now so enabling it in v3 requires zero migration
- **Tree-only, with reference edges added only in v2** (still not a DAG)
- **`derived_from` is provenance used only from v3** (because bottom-up promotion only exists in v2)

## 9. Context Propagation

### 9.1 v1 Default Context `[v1]`

```
1. node.system_prompt (includes base + sibling awareness injection)
2. node.messages (its own conversation history)
3. ancestors_summary_chain
   = [root.summary_for_parent, ..., parent.summary_for_parent]
4. siblings_metadata: [{title, one_liner}, ...]
   (injected into system_prompt, telling it "do not repeat directions already covered by siblings")
```

### 9.2 v2 Adds `[v2]`

- Reference edge targets (the agent actively retrieves via tool call)
- Full sibling summaries (on demand, via tool call)

### 9.3 v3+ Adds `[v3+]`

- Long-term facts memory (loaded by the root agent at startup)
- Mid-term tree memory (readable by any agent within the tree)
- Contents of other subtrees (retrieved via vector index)

**Core principle (all versions)**: **the vertical chain is loaded by default (short and necessary), while horizontal cross-branch content is fetched on demand (uncontrollable in volume)**

### 9.4 Sibling Awareness `[v1+]`

- Each leaf agent's system prompt is injected with a sibling list (title + one_liner)
- Explicitly told: "the following siblings already cover these directions, do not repeat them"
- **Rationale**: a real problem hit during v0 dogfooding — the agent recommended the user go ask about content that a sibling node was already covering

## 10. Reactivity (varies most by version)

### 10.1 v1 Reactivity `[v1]`

**Minimal**: the user edits a node's messages → on the next agent run's end_turn, regenerate `summary_for_parent` (1 LLM call) → done.

**v1 does not do**: descendant propagation, upward parent propagation, stale UX, reference effects. If the user wants to re-run downstream → **click manually**.

**Why v1 skips full reactivity**: in the first three weeks a v1 user is very unlikely to repeatedly edit upstream nodes. Building a propagation machine is a cost (code + maintenance + cognitive + LLM calls), with almost no payoff in v1.

### 10.2 v2 Reactivity `[v2]`

**Full propagation triggered by edit**:
```
1. node.freshness_version += 1
2. node.summary_for_parent regenerate
3. mark all descendants stale:
   {stale_because: node.id, since_version: new_version}
4. mark all reference-edge sources stale (reason: "referenced node changed")
```

**Summary upward-propagation rule (key cost insight)**:
```
node.messages change → node.summary_for_parent regenerate
if summary substantively changes (diff above threshold)
  → parent.freshness_version += 1
  → recursively up to root
```

**Core insight**: a messages change does not automatically propagate to the parent; **only a substantive summary change propagates**. This avoids root going stale on every single-character edit. **This is the core trade-off when designing reactivity under LLM cost constraints**.

### 10.3 Stale UX `[v2]`

- Visual: a pale-yellow ring around the stale node + a corner badge "based on outdated parent"
- When the user clicks a stale node: pop a banner "Context has changed. [Re-run agent] [Ignore]"
- Can it be ignored: yes. But the stale status persists and prompts once each time you open it
- Auto-expire: **not done**. User behavior decides (re-run / dismiss)

### 10.4 What an Aggregation Query Sees `[v3+]`

- By default sees the latest content (regardless of stale)
- **Flags** which parts are stale in the response
- Rationale: seeing the latest guarantees the query always has a result; flagging stale gives a metacognitive signal; the user decides whether to refresh and re-ask

---

# Part III — UX

## 11. Root Agent Startup Flow (3-step conversation) `[v1+]`

| Step | Behavior | Purpose |
|---|---|---|
| 1 | **Clarifying questions** — the agent asks back 1-2 of the most critical questions | Don't treat the user as a blank slate |
| 2 | **Confirm understanding** — the agent summarizes explicitly | Transparency |
| 3 | **Generate outline** — generate the mind map only after confirmation | Prerequisite for personalization |

**Rationale**: hit during v0 dogfooding — generating an outline directly produces a generic syllabus and treats the user as a blank slate

## 12. Title Type System

### 12.1 v1: No Behavioral Branching `[v1]`

- v1 does not store the `title_type` field
- Title is naturally generated by the LLM; style follows context (question / noun phrase / imperative all fine)
- Don't force uniformity — v0 dogfooding showed forced uniformity actually works worse

### 12.2 v2: Enable Type-Driven Specialists `[v2]`

| Type | Cognitive stance | Title style | Example |
|---|---|---|---|
| `concept` | Want to understand | Question | "How does attention work?" |
| `skill` | Want to learn to do | Imperative | "How to call the API" |
| `reference` | Want to look up | Noun phrase | "Attention variants" |
| `task` | Want to complete | Action phrase | "Polish my resume" |
| `comparison` | Want to compare/decide | Comparison/question | "RNN vs Transformer" |

**v2 implementation**: the LLM classifies during outline generation + writes a matching title. Different types load different specialist system prompts (concept → tutor mode, skill → coach mode, reference → search mode, task → action mode, comparison → analyst mode).

**Why v1 skips it**: v1 has no specialists, so type drives nothing → cosmetic over-engineering.

**To verify before v2**: are 5 types appropriate? Maybe 3 (concept/skill/task) are enough, or maybe 7 are needed. Redo an outline-classification ground truth check before v2 kicks off.

## 13. Node Opening Experience `[v1+]`

The **first time** each node is opened, the UI shows at the top:

1. **One-liner** (≤25 chars): what the node should answer
2. **Intro** (2-3 sentences): a tutor-style opening (**no markdown headers / lists**)
3. **3 recommended questions**: specific, actionable, strictly scoped to this node, not crossing into siblings

**Goal**: in the first second of entering a node, the user shifts from "what should I ask" to "which one do I click"

**Generation timing**: prefetch when the node is created (avoid waiting after opening)

## 14. Tool Use Visible `[v1+]`

- When a node agent calls a tool, the UI shows an "agent is searching the web" indicator (streaming)
- Transparency; distinct from ChatGPT's black-box search

## 15. Entry Modes

| Version | Supported entry |
|---|---|
| `[v1]` | Top-down only (user gives a goal → system generates the mind map) |
| `[v2]` | + Bottom-up (user starts chatting freely from a node → concept recognition → structure emerges) |

**v2 bottom-up implementation path**:
- During node conversation the agent runs concept extraction in the background
- On recognizing a concept → the UI prompts "💡 detected: X, Y, Z", and the user can promote it to a new node with one click
- The agent proposes a mount location (child of the current node / sibling / new root), and the user decides
- At this point the `derived_from` edge is enabled (provenance)

**v2 default UX**: default to top-down, with "I just want to chat first" as an escape hatch

---

# Part IV — Roadmap

## 16. Agentification Roadmap

| Stage | Node form | Real agent? | Time horizon |
|---|---|---|---|
| **v0** | LLM call + system prompt | ❌ LLM wrapper | done |
| **v1** | LLM call + tool use + ReAct loop | ✅ minimal agent | 3-week sprint |
| **v2** | Specialist agent (topic-aware + multi-tool) | ✅ real specialist | next sprint after v1 ships |
| **v3** | Meta-agent picks specialist + library + Map agent + Global Q&A | ✅ multi-agent system | after v2 ships, decided by dogfooding |
| **v4+** | User-defined specialists + community marketplace | Agent ecosystem | long-term, ship v1-v3 first |

**Paths not taken**: ❌ Goal-driven fully automatic agent (user gives a goal, the agent runs through all nodes itself) — violates the "don't think for the user" philosophy

## 17. v0 → v1 Dogfood Insights → Must Ship `[v1]`

6 real problems hit in v0, **v1 must ship them**:

1. The root agent must ask clarifying questions (don't presume a blank slate)
2. Title is naturally generated by the LLM (not always a question) — **v1 does no classification**, only v2 does
3. Node opening = one-liner + intro + 3 starter questions
4. The leaf agent must be sibling-aware (inject sibling metadata into the prompt)
5. The user must be able to create a node manually (basic UX, not optional)
6. UI text color contrast is sufficient

## 18. 3-Week Sprint Plan (v1)

### Week 1: Single Agent CLI
- **Ship**: a CLI script. "Weather in Tokyo?" → web_search → ReAct → answer the user
- **Success**: can debug, can explain loop termination, knows token consumption

### Week 2: Root + Leaf CLI
- **Ship**: a CLI. goal → root agent 3-step flow → outline JSON → pick a node → leaf agent ReAct conversation
- **Success**: can explain the context difference between root and leaf, sibling awareness is shipped, Week 1 code serves as the leaf base
- **Not doing**: the "Tokyo trip planner + executors + synthesizer" kind of generic toy — that pattern is not used in v1; going straight to root+leaf is more direct
- 
### Week 3: Web App Integration
- **Ship**: a web app. root agent UI → React Flow mind map → leaf node conversation (tool use visible) → localStorage persistence
- **Success**: a friend within 5 minutes wants to ask "what's underneath this?", and you yourself use it to prepare a real AIPM mock

## 19. v2 Backlog

**After v1 ships, pick 1-2 based on dogfooding**:

- Full reactivity propagation + stale UX (the top v2 candidate, because this is the real substance of the portfolio's reactive memory propagation story)
- Specialist agent library + type-driven routing
- Bottom-up entry + concept extraction + promotion UI
- Reference edge UX (draggable)
- Title type classification ground truth check + enablement

## 20. v3+ Backlog (long-term)

- Specialist library + meta-agent picks specialist
- Long-term memory facts schema (cross-tree)
- Mid-term tree memory (tree-level goal / progress)
- Slot-based parent view + cross-child lazy synthesis
- Map agent (background anti-entropy)
- Global Q&A ("Ask the Map") + `summary_for_user`
- `derived_from` edge (paired with bottom-up promotion)
- Share / clone mind map
- Schema evolution: DAG / multi-parent (only when a real pain point is hit)

---

# Part V — Map-level Agent Design (v3+, for the record)

## 21. Map Agent (anti-entropy background agent) `[v3+]`

- Not on the user's conversation path
- Runs periodically in the background
- Work: detect duplicate nodes, orphan nodes, mergeable nodes
- Output goes to a dedicated review queue, not interrupting user flow
- Does not hold whole-graph context; retrieves via vector index

## 22. Global Q&A Agent ("Ask the Map") `[v3+]`

- Independent entry (not embedded in the root node) — avoids context pollution
- Toolset: `retrieve_relevant_nodes`, `get_node_summary`, `get_tree_progress`, `get_user_facts`, `compare_nodes`
- 4 question patterns: Progress / Connection / Gap / Synthesis

## 23. Slot-based Parent View `[v3+]`

- A parent node's memory of its child nodes is stored by slot: `parent_view = {child_A: summary_A, child_B: summary_B, ...}`
- CRUD is a slot operation (delete, replace, move + recontextualize)
- Cross-child synthesis uses a lazy view: the slot is the source of truth, the synthesis is a derived view, droppable and rebuildable

---

# Part VI — Guardrails

## 24. Hard Rules (non-negotiable during the v1 sprint) `[v1]`

1. **No new product ideas until Week 1 ships.** All ideation is paused.
2. **3-week time box.** Day 21 ship or retreat, no extension.
3. **15+ hours/week.**
4. **TypeScript only.** Don't learn Python.
5. **Tree only.** Don't touch DAG.
6. **Ship trumps polish.** A friend usable in 5 minutes > pretty but doesn't run.

**When v2+ kicks off, these rules are re-reviewed, not automatically carried over.**

## 25. Forbidden Anti-Patterns

- ❌ Redesigning the schema before building (already designed, no going back)
- ❌ Reading more frameworks in order to "pick the best framework"
- ❌ Adding a feature mid-way because a new idea came up
- ❌ "Did the v2 X while I was at it" — v2 things are **always deferred until v1 ships**
- ❌ Polishing the UI before the agent loop works
- ❌ Worrying about business model / PMF / growth
- ❌ Comparison anxiety against BranchCanvas / Heptabase / Roam
- ❌ Calling a node an "agent" in the v1 stage until it actually calls tools

## 26. Portfolio Story (locked)

> I built a minimal multi-agent harness where the mind map is the user-facing orchestration topology.
>
> The system has two layers of agents:
> - **Root agent (planner)**: breaks a learning goal into a mind map of subtopics through a 3-step conversation
> - **Leaf agent (specialists)**: handle each node's conversation, can call tools (web search, fetch) for real grounding
>
> Unlike most multi-agent systems whose orchestration is a black box — **mind map IS the orchestration graph** — editable, inspectable, persistent. The user can pause any agent, edit any node, redirect any subtask.
>
> v1 deliberately cut complexity like stale propagation and the specialist library. **Because I treat the trade-off of reactive memory propagation under LLM cost constraints as the core design problem** — building a propagation machine when the user has no pain point doubles cost unnecessarily. v2's reactivity system (§10.2) is the affirmative answer to this trade-off: summaries don't propagate in full, stale doesn't auto-refresh, keeping an N-node graph from turning into N² LLM calls.
>
> Thesis: as agent capability grows stronger, the bottleneck shifts from capability toward **steerability**. Topology-as-UI is one answer.

**Aligned themes**:
- Anthropic's interpretability / steerability themes
- Cognitive UX (linear chat is a UX bug)
- Transparent personalization
- System design under cost constraints

---

*Locked 2026-04-30 by Yvonne + Claude.*
*Reorganized 2026-05-11 (v1 critique fix + version tags throughout).*
*Next update: retro after v1 ships.*
