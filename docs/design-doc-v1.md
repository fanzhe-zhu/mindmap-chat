# Mind Map Chat — v1 Build Spec

> **Status**: Locked for 3-week sprint
> **Version**: 2026-05-11 (v1-only + eval framework added)
> **Companion**: `design-doc-full.md` (full v1/v2/v3 vision) — this file only covers v1
> **Usage**: This is the build spec to open during the sprint. For any "what about v2 / v3" question, flip to the full doc; **don't touch them during the v1 sprint**.

---

## TL;DR

**What v1 is**: Minimal multi-agent harness. User enters a goal → root agent generates a mind map through conversation (clarify → confirm → outline) → user clicks a node → leaf agent converses (with web search, tool use visible) → localStorage persistence. **Mind map = orchestration topology** (user-visible, editable).

**What v1 does NOT do (all deferred to v2/v3+)**:
- ❌ Reactivity auto-propagation + stale tag system
- ❌ Specialist agent library + meta-agent
- ❌ Bottom-up entry mode
- ❌ Cross-tree memory + long-term facts
- ❌ Reference edge / derived_from edge
- ❌ Second summary (`summary_for_user`)
- ❌ Title type behavior branching
- ❌ Aggregation query ("Ask the Map")
- ❌ Map agent (background anti-entropy)

**v1 is the foundation for v2/v3, not throw-away**:
- v1 leaf agent = substrate for v2 specialist
- v1 tree = operation target for v3 Map agent
- v1 `summary_for_parent` = v3 cross-node memory primitive

**Tech**: Next.js 14 + TypeScript + React Flow + Anthropic SDK (`claude-opus-4-7`) + Brave/Tavily web search + localStorage + Vercel
**Time**: 3 weeks × 15 hr/week = 45 hours total

---

# Part I — Foundation

## 1. v1 Thesis

> A minimal multi-agent harness where mind map IS the orchestration graph—editable, inspectable, persistent.

**Two-layer thesis**:
- Surface layer (UX): Linear chat is a UX bug. Human thinking is tree-shaped.
- Underlying layer (architecture): A mind map is not a visualization of the chat; it is the **user-facing orchestration topology of a multi-agent system**.

## 2. Core Philosophy: Node Boundary

**Node boundary = the dividing line between the right to think and the right to plan**:

| Where | Who does it | What they do |
|---|---|---|
| **Between** nodes | System | Generate the outline, lay out nodes, organize structure |
| **Within** a node | User | Ask questions, think, follow up, close |

This differs from Deep Research / Manus — they do everything for the user, **stripping away cognitive work**. This is the soul of the product, and **all v1 design decisions are checked against it**.

## 3. v1 Design Principles

1. **Systematized between nodes, manual within nodes** — Cognitive load goes outside, cognitive work stays inside
2. **System proposes, user decides** — All CRUD can only propose; the user keeps the final say
3. **Personalization is shown explicitly** — The agent must summarize its understanding of the user and wait for confirmation
4. **Brute-force first** — v1 does not pre-architect for v2/v3. The v1 phase does not need fields, rules, or mechanisms that only v2 uses
5. **Honest naming** — v1 nodes are called "leaf agent" (because they have tool use + a ReAct loop), not "specialist" (that's v2)

---

# Part II — v1 System Design

## 4. Agent Architecture

### 4.1 An agent is a stateless function
- Each run reassembles the context; there is no agent instance object
- Reason: the Anthropic SDK is natively stateless; v1 does not need an actor model

### 4.2 State lives on the Node
- All agent state (the messages array) lives as a Node field
- The Node is the single source of truth

### 4.3 Agent permission boundary (v1)

| Operation | Allowed |
|---|---|
| Write its own node's messages | ✅ every conversation turn |
| Write its own node's `summary_for_parent` | ✅ triggered on `stop_reason==end_turn` |
| Propose a new node (tool call: `propose_new_node`) | ✅ executes only after user confirms |
| Directly create a child node | ❌ |
| Change another node's content | ❌ |
| Archive / delete another node | ❌ only the user can ever do this |

**Permissions v1 does not need**: propose reference edge (because there is no reference edge type)

### 4.4 Trigger: manual only
- The user clicks a node / sends a message to trigger an agent run
- **Does not do** upstream-auto trigger (that's v2, which needs reactivity propagation rules; v1 does not do it)

### 4.5 "Done"
- **Turn-level**: the ReAct loop terminates when `stop_reason === "end_turn"`
- **Node-level**: the user decides. The agent does not decide on its own "I've done enough"

## 5. v1 Schema (streamlined)

```typescript
type Node = {
  // Identity
  id: string
  parent_id: string | null
  created_at: timestamp
  updated_at: timestamp
  
  // Content
  title: string          // free-form, LLM generated, style varies with context
  one_liner: string      // ≤25 chars, what the node should answer
  
  // Agent runtime
  system_prompt: string  // base + injected sibling awareness
  messages: Message[]    // Anthropic SDK messages array
  tool_config: ToolConfig
  
  // Summary (v1 has only one, structured)
  summary_for_parent: SummaryForParent | null  // regenerated on stop_reason==end_turn
  
  // Lifecycle (simplified)
  status: 'active' | 'archived'  // v1 does not do the stale status
  
  // Metadata
  tags: string[]
  user_notes: string | null
}

type SummaryForParent = {
  topic: string               // what this node discusses (1 sentence)
  key_takeaways: string[]     // core points (3-5 items)
  status: 'mastered' | 'partial' | 'confused'  // LLM self-assessment (eval measures accuracy, see §15)
  open_questions: string[]    // unresolved questions (0-N items)
}

type Edge = {
  type: 'parent'         // v1 has only one edge type: parent
  from: NodeId
  to: NodeId
}
```

**On the decision to make `summary_for_parent` structured**:

- Don't store free-form text; store a 4-field structured JSON. This keeps the format stable when prefixing the ancestors chain, and lets the leaf agent receive a structured context
- **`status` is an LLM self-assessment**; v1 accepts imperfection (eval framework §15 specifically tests this accuracy)
- **`status` does not include `'untouched'`**—untouched = `summary_for_parent === null`, no need for an extra enum value
- **`open_questions`** is the core basis for the Gap-type questions in v3 Global Q&A (see doc-full §22); v1 just stores it, with zero cross-version migration
- **Does not store** the "quantified user mastery score" mentioned in the v3 vision—v1 makes do with a 3-tier discrete status; quantitative metrics wait for LLM-as-judge eval, added in v2

**Fields v1 cut from the full vision** (all deferred to v2/v3):
- `title_type` (v1 has no specialist; type drives no behavior)
- `summary_for_user` (v1 has no Global Q&A, no consumer)
- `freshness_version` (v1 has no stale system)
- `status: 'stale'` (same as above)

**Edge types v1 cut from the full vision**:
- `reference` (v1 has no cross-branch link UX)
- `derived_from` (v1 has no bottom-up promotion)

## 6. Context Propagation (v1 simplified)

What an agent sees when it runs:

```
1. node.system_prompt (includes base + sibling awareness injection)
2. node.messages (its own conversation history)
3. ancestors_summary_chain
   = [root.summary_for_parent, ..., parent.summary_for_parent]
4. siblings_metadata: [{title, one_liner}, ...]
   (injected into system_prompt, telling it "the following directions are already covered by siblings, don't repeat")
```

**Context retrieval v1 does not do**:
- Full sibling summary (only metadata)
- Reference edge target (no reference edge)
- Other subtree content
- Global facts memory (no long-term memory)

**Core principle**: the vertical chain is loaded by default (short and necessary), the horizontal is metadata only.

## 7. Reactivity (v1 minimal)

**When the user edits a node's messages**:

```
1. node.updated_at += now
2. On the next agent run's end_turn, regenerate node.summary_for_parent
   (1 LLM call)
3. DONE.
```

**v1 does not do**:
- ❌ Mark downstream as stale
- ❌ Transitive propagation
- ❌ Parent auto-mark
- ❌ Reference edge effects (no reference edge)
- ❌ Stale UX (visual ring / banner)
- ❌ Aggregation query reading the stale flag

**If the user wants to re-run a downstream node**: **click it manually**. It's that simple.

**Why this way**: in the first three weeks, v1 users most likely won't repeatedly edit upstream nodes. Installing a stale system is a cost (code + maintenance + user cognition), but v1 gets almost no benefit. Build it when v2 actually hits the pain point.

---

## 8. v0 → v1 Dogfood Requirements (6 must-land items)

These 6 are things v0 dogfood taught us but the design lacked; **v1 must implement them**:

1. **Root agent must ask clarifying questions** (don't assume a blank slate) — §9
2. **Title style decided by the LLM** (natural-language generation, don't force a question format) — no enum needed
3. **Node opening = one-liner + 2-3 sentence intro + 3 starter questions** — §10
4. **Leaf agent must be sibling-aware** (system prompt injects sibling metadata) — §6
5. **The user must be able to manually create nodes** (basic UX, not optional)
6. **UI text contrast must be sufficient** (no gray)

---

# Part III — v1 UX

## 9. Root Agent Startup Flow (3-step conversation)

| Step | Behavior | Purpose |
|---|---|---|
| 1 | **Clarify** — the agent asks 1-2 of the most critical questions ("what do you already know / how deep are you / what do you want to avoid") | Don't treat the user as a blank slate |
| 2 | **Confirm** — the agent explicitly summarizes its understanding of the user ("I'm assuming you X, right?") | Transparency |
| 3 | **Generate outline** — after confirmation, generate the mind map (N nodes, each with title + one_liner) | Personalization prerequisite |

## 10. Node Opening Experience

The first time each node is opened, the top of the UI shows:

1. **One-liner** (≤25 chars): what the node should answer
2. **Intro** (2-3 sentences): tutor-style opening, **no markdown headers / lists**
3. **3 recommended questions**: specific, actionable, strictly scoped to this node, not crossing into siblings

**Goal**: in the first second the user enters a node, shift from "what should I ask" to "which one do I click".

**Generation timing**: prefetch when the node is first created (so the user doesn't open it and wait for the LLM). These tokens are counted into the cost model up front.

## 11. Tool Use Visible

- When the node agent calls a tool, the UI shows an "agent is searching the web" indicator (streaming)
- The user can see what the agent is doing → builds trust
- Differs from ChatGPT's black-box search

## 12. Entry Mode

**v1 is top-down only**: the user gives a goal → the system generates a mind map. **Does not do** bottom-up (that's v2).

---

# Part IV — 3-Week Sprint Plan

## Week 1: Single Agent CLI

**Ship**: a CLI script. "Weather in Tokyo?" → agent calls web_search → ReAct loop → answers the user.

**Success**:
- Can debug a failed tool call without panicking
- Can explain the loop's termination condition in plain language
- After running, you know how many tokens / dollars it consumed
- **Leaf eval baseline numbers written down** (§14)

**Banned**: LangGraph / CrewAI / AutoGen; hand-write the orchestrator.

## Week 2: Root + Leaf CLI

**Ship**: a CLI script. User enters a goal → root agent runs the 3-step flow (clarify → confirm → outline, generating JSON for 5-7 nodes) → user selects a node from the CLI → leaf agent runs the ReAct conversation.

**Success**:
- Can explain the context difference between the root agent and the leaf agent
- Sibling awareness lands (the leaf doesn't repeat siblings)
- Week 1 code is reused directly as the base for the leaf agent
- **Root + Leaf joint eval baseline numbers written down** (§13-15)

**Why not the "Tokyo trip" multi-agent toy**: that pattern (planner + executors + synthesizer) is not used by the v1 product. Going straight to root + leaf moves v1 forward in a straight line.

## Week 3: Web App Integration

**Ship**: a web app. User enters a goal → root agent 3-step flow (UI conversation) → outline → React Flow mind map → click a node → leaf agent conversation (tool use streaming visible) → localStorage persistence.

**Success**:
- A friend uses it for 5 minutes and asks "what's underneath this?"
- You use it yourself to prep a real AIPM mock interview
- **After W3 ships, full eval, numbers go into the portfolio**

**What Week 3 is doing** (specific):
- React Flow + custom node component
- Root agent conversation UI (3 steps)
- Outline → node + parent edges conversion
- Leaf node conversation UI (streaming + tool use indicator)
- localStorage persistence (single tree)
- Sibling awareness injection (§6)
- Node opening experience (§10)
- All 6 v0 dogfood insights land (§8)

**What Week 3 does NOT do** (explicitly deferred):
- ❌ Stale tag system (visual / banner)
- ❌ Title type classification (only generate the title)
- ❌ Reference edge UI
- ❌ Bottom-up entry
- ❌ Multi-tree support (a single tree is enough)
- ❌ Redesigning React Flow's default styling (use the default, good enough is fine)

---

# Part V — v1 Eval Framework

> **Why eval matters from day 1**: no eval = every prompt revision is a vibe judge, you can't move it and you can't explain why. It also means the portfolio story has no numbers behind it. v1 eval should not be over-engineered, but **W0 prep must set it up**.

## 13. What v1 evals (explicit scope)

v1 has two agents, each evaluated separately:
- **Root agent**: outline generation quality
- **Leaf agent**: node conversation + tool use quality

**What v1 does NOT eval** (all v2/v3 matters):
- ❌ Stale propagation accuracy (v1 doesn't have this feature)
- ❌ Specialist routing correctness (v1 has no specialist)
- ❌ Cross-tree memory recall (v1 has no long-term memory)
- ❌ Aggregation query quality (v1 has no Global Q&A)

## 14. Root Agent Eval (outline generation)

The most high-stakes — if the outline is wrong, all the downstream leaves are wrong.

| Dimension | How to measure | Target | Type |
|---|---|---|---|
| **Coverage** | Run 10 fixed goals, manually judge whether the outline covers that goal's core subtopics (against an expert checklist / wiki TOC) | 80%+ coverage | Manual |
| **Granularity** | Run the same goal 5 times, the variance of the node count. Too scattered (5/30/12 each time) = unstable | std/mean < 0.3 | Automatic |
| **Non-overlap** | LLM self-assessment + manual spot check: conceptual overlap between siblings | <20% pair-wise | Semi-automatic |
| **Personalization** | The same goal with two different clarifying answers (e.g. "I'm a SWE" vs "I'm a designer"), the outline is substantively different | Manual: clearly different | Manual |

## 15. Leaf Agent Eval (node conversation)

| Dimension | How to measure | Target | Type |
|---|---|---|---|
| **Tool use success rate** | 20 queries that should trigger web search, count (a) the proportion where the agent decides to call the tool (b) the proportion where the tool call parameters are reasonable (c) the proportion where the tool result is reasonably integrated into the answer | (a) >80% (b) >90% (c) >70% | Automatic (a/b) + Manual (c) |
| **Sibling awareness** | Click different leaves on the same tree and ask similar questions, look at answer overlap | <30% content overlap | Manual |
| **ReAct loop termination reasonableness** | 20 conversations, the iteration distribution. An average of 2-4 turns is reasonable; >10 turns is stuck; 1 turn may mean the tool wasn't used | mean 2-5, P95 < 8 | Automatic |
| **Refusal / hallucination** | When a tool fails, does the agent say "couldn't find it" or fabricate content? | 0 hallucination on failed tool | Manual |
| **Summary schema completeness** | Whether the `summary_for_parent` generated on end_turn has all 4 fields filled and the types correct | 100% schema valid | Automatic |
| **Summary status accuracy** | Sample 10 leaf conversations, manually judge whether the status self-assessment (mastered/partial/confused) matches the actual conversation content | ≥80% agreement with manual | Manual |

## 16. Test Set (W0 must prep)

**10 root goals** (covering type / difficulty / edge cases):

| # | Goal | What it tests |
|---|---|---|
| 1 | Understand the core ideas of RLHF | Concept-heavy outline |
| 2 | How a Transformer works | Concept-heavy, multiple layers involved |
| 3 | Learn to use PostgreSQL | Skill-oriented |
| 4 | How to do good user research | Skill, soft topic |
| 5 | What to prepare for switching from SWE to AIPM | Your own use case |
| 6 | Write a PRD for my side project | Project-based |
| 7 | How to choose between RAG and fine-tuning | Comparison |
| 8 | I want to learn about AI | Vague goal, see if clarifying kicks in |
| 9 | Learn machine learning | Too-big goal, see how root handles it |
| 10 | I've built an LLM app before, I want to understand agents | Personalization test (vs a blank-slate user) |

**20 leaf scenarios** (each with parent context + 2 sibling contexts + user message):

Design principles:
- Half need web search, half are pure reasoning
- Half deliberately ask what a sibling already covers (tests sibling awareness)
- A few users "want to try the boundary": ask off-topic, try prompt injection
- A few that clearly need refusal / clarify

The specific 20 scenarios are in `eval-scenarios.md` (prepared in W0 prep).

## 17. Eval Cadence

| Time point | What to run |
|---|---|
| **W0 prep** | Write the eval framework + test set + scoring script skeleton |
| **After W1 ships** | Leaf-only eval baseline, write the numbers down |
| **After W2 ships** | Root + leaf joint eval baseline |
| **During W3** | Each prompt revision → rerun automatic metrics. Manual metrics run on the weekend |
| **After W3 ships** | Full eval, numbers go into portfolio / blog |

## 18. Eval Anti-Patterns

- ❌ **Building eval takes longer than building the product** — the first version of v1 eval is written in 2-3 hours, not 2-3 days
- ❌ **Skipping manual metrics because they're a hassle** — when an AIPM interviewer asks "what did you eval by", the soul of the answer is in the manual metrics. "I ran 10 goals and scored them manually" is more compelling to an interviewer than "I ran 1000 automatic tests"
- ❌ **Changing the test set midway** — once locked in W0, no adding / removing; only this way can prompt changes be compared apples-to-apples
- ❌ **Chasing a 100% pass** — the Target is set to a reasonable threshold, not perfection. "60% coverage" is a data point, not a failure

## 19. What v1 Eval Does NOT Do (all deferred)

- ❌ LLM-as-judge automating manual metrics — added in v2
- ❌ A/B test framework — only meaningful in v2
- ❌ User-side eval (true user feedback) — done after Week 3 ships, but as a qualitative interview, not a quant metric
- ❌ Regression test automation in CI — not needed for a solo project

---

# Part VI — Guardrails

## 20. Hard Rules (non-negotiable during the v1 sprint)

1. **No new product ideas until Week 1 ships.** All ideation is paused.
2. **3-week time box.** Day 21 ship or retreat, no extension. Don't ship → fall back to the LLM wrapper story + portfolio.
3. **15+ hours/week.** Below this, immediately cut scope.
4. **TypeScript only.** Don't learn Python.
5. **Tree only.** Don't touch a DAG.
6. **Ship trumps polish.** A friend usable in 5 minutes > pretty but doesn't run.

## 21. Forbidden Anti-Patterns

- ❌ Adding a feature midway because a new idea occurred to you
- ❌ "Conveniently did v2's X" — v2 things are **always deferred until after v1 ships**
- ❌ Polishing the UI before the agent loop works
- ❌ Worrying about business model / PMF / growth
- ❌ Comparison anxiety with BranchCanvas / Heptabase / Roam
- ❌ Reading more frameworks in order to "pick the best framework"
- ❌ **Eval framework over-build** (see §18)

**Every time you add a task / think of a new idea, ask yourself**: "Is this necessary for the v1 sprint?" If the answer is "not necessary" or "I don't know" → defer.

---

# Part VII — Explicit Out of Scope (v2/v3 backlog index)

The following are **all not in v1**; when you feel the urge to do one → glance at this list → kill the urge. The specific designs are in `design-doc-full.md`.

| Thing to do | Belongs to | Why it's not in v1 |
|---|---|---|
| Stale tag + propagation | v2 | v1 users edit infrequently; installing it is a cost with no benefit |
| `summary_for_user` second summary | v3 | v1 has no consumer (Global Q&A is v3) |
| Title type 5-class behavior driving | v2 | v1 has no specialist; type drives nothing |
| Reference edge + UX | v2 | v1 simplification: tree-only, add in the future when needed |
| `derived_from` edge | v2 | v1 has no bottom-up promotion |
| Specialist agent library | v2 | v1 has only one general leaf agent |
| Meta-agent selecting a specialist | v3 | with no library there's nothing to select |
| Long-term memory facts (cross-tree) | v3 | v1 is single-tree |
| Slot-based parent view | v3 | the whole-tree JSON is enough for v1 |
| Cross-child lazy synthesis | v3 | same as above |
| Map agent (background anti-entropy) | v3 | needs the graph big enough for entropy to accumulate; v1 won't be |
| Global Q&A (Ask the Map) | v3 | needs the graph big enough to be worth querying; v1 won't be |
| Bottom-up entry | v2 | validate top-down first |
| LLM-as-judge / A/B eval | v2 | v1 eval's manual scoring is enough |
| User-defined specialists | v4+ | talk about it after v3 is done |
| Community marketplace | v4+ | same as above |

---

## 22. Portfolio Story (use after v1 ships)

> I built a minimal multi-agent harness where the mind map is the user-facing orchestration topology.
>
> The system has two layers of agents:
> - **Root agent (planner)**: breaks a learning goal down into a mind map of subtopics through a 3-step conversation (clarify → confirm → outline)
> - **Leaf agent (specialists)**: handles the conversation for each node, able to call tools (web search, fetch) for real grounding
>
> Unlike most multi-agent systems whose orchestration is a black box — **mind map IS the orchestration graph** — editable, inspectable, persistent. The user can pause any agent, edit any node, redirect any subtask.
>
> v1 deliberately cut complexity like stale propagation and the specialist library, **because I treated the trade-off of reactive memory propagation under LLM cost constraints as the core design problem** — installing a propagation machine when users have no pain point would unnecessarily double the cost. This was the most important design discipline during the v1 sprint.
>
> For eval I ran 10 fixed goals + 20 fixed leaf scenarios, coverage [X]% / sibling overlap [Y]% / tool use success rate [Z]% / average ReAct iteration [N] turns / leaf agent self-assessed status agreement with manual [W]%. This is the baseline; v2 will focus improvements on [the weakest dimension].
>
> Thesis: as agent capability grows stronger, the bottleneck shifts from capability to **steerability**. Topology-as-UI is one answer.

**Aligned themes**: Anthropic's interpretability / steerability themes, Cognitive UX, Transparent personalization, System design under cost constraints, Eval-driven iteration

---

*Locked 2026-05-11 by Yvonne + Claude.*
*Next update: the retro after Week 3 ships.*
*Any v2/v3 urge during the sprint: flip to `design-doc-full.md`, close it after reading, return to v1.*
