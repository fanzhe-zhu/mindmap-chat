# Mind Map Chat — Project Tracking

> **Last updated**: 2026-05-26 (W0 prep complete — P1-P4 + P8 test set all landed, W1 unblocked)
> **Sprint window**: 3 weeks for v1 (✅ ready to kick off W1)
> **Time commitment**: 15+ hr/week
> **Companions**:
>   - `design-doc-v1.md` — build spec for the sprint period (includes eval framework §13-19)
>   - `design-doc-full.md` — full vision, v2/v3 detailed design

---

## 📊 Overview Status

| Track | Status | Progress | Key blocker |
|---|---|---|---|
| **v1 Design** | ✅ Locked | 2026-05-11 v1-only + eval complete | — |
| **v1 Pre-impl Prep** | ✅ Done | 2026-05-26 complete | — |
| **v1 Week 1** (Single Agent CLI) | 🟢 Ready | prep cleared, ready to kick off | — |
| **v1 Week 2** (Root + Leaf CLI) | ⚪ Blocked | waiting on W1 | — |
| **v1 Week 3** (Web App) | ⚪ Blocked | waiting on W2 | — |
| **v1 Portfolio Packaging** | 🟡 Partial | story locked, artifacts TBD | parallel |
| **v2 Planning** | 🟡 Candidates listed | Blocked on v1 ship + 1 week dogfood | see v2 section |
| **v3 Roadmap** | 🟡 Held loosely | Blocked on v2 ship + dogfood | see v3 section |

**Status symbols**: ✅ done · 🟢 on track · 🟡 partial / risk · 🔴 blocked / off-track · ⚪ not started

---

## 🎯 The Most Important Thing Right Now

W0 prep is all complete (see P1-P4 + P8 below for details in each section). **Next step = kick off Week 1 Day 1.**

Kicking off W1 only requires:
1. **Confirm the prep artifacts are all in the code repo** — `prompts.md` + P2/P3/P4 docs + eval `.ts` (`eval-types.ts` / `goals.ts` / `scenarios.ts` are typed & passing typecheck; runners `eval-leaf.ts` / `eval-report.ts` to be wired in W1)
2. **Project init** (Next.js + Anthropic SDK) → implement `runReActLoop` per the P3 pseudocode → run 3 test queries → W1 ship

The loose ends only needed for W1 ship (not blocking kickoff): wiring the eval runner scripts onto the W1 agent code + verifying the trace shape.

---

# 📝 v1 Pre-Implementation Prep (Week 0)

> ✅ **DONE 2026-05-26.** v1 design locked → the work of translating it into code templates is complete.
> Status summary: P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ · P8 test set ✅ (typed + typecheck + 304 invariant assertions passing).
> P5/P6/P7 deferred by design (see each section). **Ready to enter Week 1.**

## P1: System Prompts (highest priority) — ✅ DONE

> Deliverable: `prompts.md` (v0.2, in the project). 4 prompts + schema-enforcing tool definitions + implementation notes.

- [x] **Root agent system prompt** — three-step flow (clarify → confirm → outline), phase 3 uses the `submit_outline` tool to enforce schema (the three phases split into separate LLM calls, state held in code)
- [x] **Leaf agent system prompt** — includes sibling awareness injection, tool use triggering, off-tree drift handling (instruction #9); after end_turn, call the summary generator separately (not inline)
- [x] **Summary generator prompt** — `submit_summary_for_parent` tool enforces `{topic, key_takeaways[], status, open_questions[]}`; `summary_for_user` deferred to v3
- [x] **Node intro generator prompt** — one-liner + tutor intro + 3 starter questions

**Prompts v1 does not need**:
- ~~Title type classifier~~ — v1 does not classify; titles are generated naturally by the LLM

**Location**: a standalone `prompts.md`, each prompt with a version number + modification date

## P2: Cost Model — ✅ DONE

> Result: **~$0.10/map (root startup) · ~$0.14/node (conversation + summary) · sprint total estimate $120-180**.
> Pricing reference (2026-05): Opus 4.7 $5/$25 per MTok (note the new tokenizer produces ~35% more tokens than 4.6); Haiku 4.5 $1/$5.
> Prompt caching enabled on the leaf system block from W1; a 30-node tree saves ~$0.85.

- [x] Token estimate for each operation (root startup / leaf single turn / summary / intro / one eval run) — leaf single-turn input floor ~1800 tokens
- [x] Weekly total cost estimate — dev period ~$103, medium ~$157, heavy ~$262 (including eval ~$25)
- [x] Budget cap approach decided (the leaf single-turn 1800-token floor is the main optimization lever)

## P3: Week 1 ReAct Loop Pseudocode — ✅ DONE

> Deliverable: `P3-react-loop-pseudocode.md` (complete `runReActLoop()` spec). W1 follows it directly.

- [x] Loop pseudocode complete — stop_reason branches (end_turn / tool_use / max_tokens / refusal / max_iterations_hit / error), tool dispatch, token accumulator, trace hooks
- [x] **Max iteration cap = 10** (eval target P95 < 8, leaving headroom)
- [x] Key conventions recorded: multiple tool_use → one user message with multiple tool_result; handler throwing an exception vs returning is_error handled separately; W1/W2 not streaming (streaming added in W3)

## P4: Tool & Infrastructure Selection — ✅ DONE

> Deliverable: `P4-tools-and-infra.md`. **API keys verified (Tavily + Anthropic).**

- [x] **Search tool = Tavily** (free tier, no credit card; writing dispatch ourselves nicely showcases the tool-use judgment from eval §15; if we hit a wall in W3, switching to Anthropic native is a one-day job)
- [x] **Logging** = one JSON trace file per run + a console one-liner per iteration
- [x] **Error handling** = exponential backoff for API errors (3 attempts); tool errors not retried, return `is_error: true` and let the model handle it; context overflow truncation strategy recorded
- [x] Prompt caching = leaf system block enabled from W1

> **P7 Failure Modes** has been merged into this section's error handling (rate limit / timeout / illegal tool call / refusal / overflow / tab close / localStorage quota). No longer listed separately.

## P5: User Scenario Walkthrough — ⏸ DEFERRED to W3 prep

> W1/W2 are CLI, with no click-level UX. This item is better moved to **Pre-Week-3 Decisions**. The original checklist is preserved below for W3.

Walk through to the click level, before code:

- [ ] **Scenario A: user's first onboarding** (root agent 3-step flow)
  - What does the user see after entering a goal?
  - How are the agent's clarifying questions presented? All at once or one by one?
  - In the "Confirm understanding" step, how does the user confirm / correct?
  - Is outline generation streaming or all at once?

- [ ] **Scenario B: user converses on a leaf node, agent invokes web search**
  - What does the "agent is searching the web" indicator look like?
  - How does the search-returned content stream?
  - How do you verify sibling awareness is working? (does the agent really not duplicate the sibling?)
  - When the conversation ends (`stop_reason==end_turn`), when is the summary generated?

- [ ] ~~Scenario C: user edits an upstream node, making downstream stale~~ — **v1 does not do a stale system, moved to v2**

## P6: localStorage Schema — ⏸ DEFERRED to end of W2

> localStorage is only used in W3. The schema will be fixed at the end of W2 (before entering W3). The shape draft is preserved below.

- [ ] **v1 JSON shape** (a single tree only):
  ```typescript
  type LocalStorageRoot_v1 = {
    version: number  // schema version
    tree: Tree | null  // v1 single tree
  }
  type Tree = {
    id: string
    goal: string
    created_at: timestamp
    nodes: { [node_id: string]: Node_v1 }
    edges: Edge_v1[]
  }
  ```
- [ ] **Decision: what to do when localStorage quota is full?** (5MB limit)
- [ ] **Decision: schema version migration strategy** (what to do when the v1 → v2 schema changes)

## P7: Failure Modes Table — ✅ Merged into P4

> Merged into P4's error handling strategy (high overlap). The case list below is kept as a coverage checklist for W1 implementation.

- [x] List the failure scenarios v1 will actually hit (already covered in P4):
  - Anthropic API rate limit
  - Anthropic API timeout
  - Web search timeout / no results
  - LLM returns an illegal tool call (wrong parameters)
  - LLM refuses to answer (refusal)
  - Context window overflow
  - User closes the tab mid-run (during an agent run)
  - localStorage write failure / quota exceeded
- [ ] ~~Stale propagation exception~~ — not in v1

## P8: Eval Framework Setup — 🟢 test set ✅ LOCKED+TYPED · runner pending W1

> See `design-doc-v1.md` Part V (§13-19). Principle: the first version takes 2-3 hours, not 2-3 days.
> **Test set is locked and typed** (2026-05-26): `eval-types.ts` (locked types) + `goals.ts` (10 goals + 4 personalization pairs) + `scenarios.ts` (S1-S20).
> Verification: `tsc --strict` passes + all 304 runtime invariant assertions pass (9/11 tool ratio, 6 sibling_awareness, 2 siblings each, unique ids, complete references, etc.).
> Markdown source of truth: `eval-goals.md` / `eval-scenarios.md` (both include a LOCKED statement).

- [x] **10-goal root goal test set** — `eval-goals.md` + `goals.ts` (includes coverageMode: subtopic/clarify/granularity + answer key)
- [x] **20-scenario leaf scenario test set** — `eval-scenarios.md` + `scenarios.ts` (parent context, 2 siblings, user message, needsTool, expectedBehavior, primaryMetric)
- [ ] **`eval-root.ts` skeleton** — pending W2 (imports `runRootAgent`, which exists only in W2)
- [ ] **`eval-leaf.ts` skeleton** — pending W1 (imports `runReActLoop`, which exists only in W1); test data is ready, just need to wire the runner
- [ ] **`eval-report.ts` skeleton** — pending W1 (reads the latest run and computes automatic metrics)
- [ ] **Manual scoring template** — `human-scoring-template.md`, to be done before W1 ship

**Eval locking principle**: once the test set is written, **do not change, add, or remove anything for the entire v1 sprint**. This is the only way prompt changes can be compared apples-to-apples.

---

# 📦 v1 Week 1: Single Agent CLI

> **Target ship**: Week 1 Day 7
> **Status**: 🟢 Ready to start (prep unblocked 2026-05-26)

## Goal
CLI script, "Weather in Tokyo?" → agent calls web_search → multi-step ReAct reasoning → answers the user

## Success Criteria
- [ ] Able to debug a failed tool call without panicking
- [ ] Able to explain the loop termination conditions in plain language
- [ ] After running a task, know how many tokens / dollars it consumed

## Tasks
- [ ] Project init (Next.js project + Anthropic SDK installed, even though W1 only uses CLI)
- [ ] Web search tool implementation (after selecting Brave/Tavily/Anthropic native)
- [ ] ReAct loop implementation (per the P3 pseudocode)
- [ ] Logging: print every LLM call + tool call + JSON trace
- [ ] Token counter: print total consumption when the loop ends
- [ ] Error handling covering the cases listed in P4
- [ ] Run 3 test queries:
  - "Weather in Tokyo?" (simple)
  - "What's the latest Anthropic paper about?" (requires multiple steps)
  - a query designed to fail (tests error handling)

## W1 Eval (leaf agent baseline)
- [ ] Run `eval-leaf.ts` on the 20-scenario test set
- [ ] **Record baseline numbers** (into `eval-runs/W1-baseline/`):
  - Tool use call rate _____ %
  - Tool parameter valid rate _____ %
  - ReAct iteration mean _____ / P95 _____
  - Token cost per scenario avg _____
- [ ] Fill in manually:
  - Hallucination on failed tool: _____ instances
  - Overall leaf agent quality 1-5 scale: _____

## Portfolio Output
- [ ] Demo video (2-3 min, record the terminal running the ReAct loop trace)
- [ ] A commit-message-style progress log
- [ ] W1 eval baseline numbers → into the portfolio

---

# 📦 v1 Week 2: Root + Leaf CLI

> **Target ship**: Week 2 Day 14
> **Status**: ⚪ Not started

## Goal
CLI script, full v1 flow (no UI): user enters goal → root agent 3-step flow → outline JSON → user selects a node from the CLI → leaf agent ReAct conversation → summary regen

## Success Criteria
- [ ] Able to explain the context difference between root and leaf
- [ ] **Sibling awareness implemented** (verified by eval manual spot-check)
- [ ] Week 1 code directly reused as the leaf agent base

## Pre-Week-2 Decisions (fix before Week 1 Day 7)
- [ ] **Root agent outline output format** — Structured JSON or natural language then parse? **Recommend structured output + JSON mode**
- [ ] **How the CLI presents the mind map** — Indented text list / ASCII tree / numbered list?
- [ ] **How the sibling list is injected into the leaf prompt** — placeholder or prefix?
- [ ] **Week 1 → Week 2 code reuse** — **Recommend extracting a `runReActLoop()` function**, shared by W1 and W2

## Tasks
- [ ] Root agent system prompt + 3-step state machine
- [ ] Outline structured output parsing (JSON mode)
- [ ] In-memory Tree data structure
- [ ] CLI interaction: input goal → clarify Q&A → confirm → display outline → node selection → leaf agent
- [ ] Leaf agent system prompt (with sibling awareness injection)
- [ ] `summary_for_parent` regeneration logic
- [ ] Serialize the Tree to a JSON file for easy manual inspection

## W2 Eval (root + leaf joint baseline)
- [ ] Run `eval-root.ts` on the 10-goal test set (each goal × 3 times)
- [ ] Re-run `eval-leaf.ts` (since sibling awareness is now injected, results may change)
- [ ] **Record baseline numbers** (into `eval-runs/W2-baseline/`):
  - Automatic metrics: Node count std/mean, tool use rate, ReAct iter mean/P95, token cost
  - **Summary schema completeness**: _____ % (all 4 fields filled and correctly typed)
- [ ] Fill in manually:
  - Coverage avg across 10 goals: _____ %
  - Is personalization obvious (goal #10 vs blank-slate goal #5): yes / no
  - Sibling overlap, average over 5 sampled pairs: _____ %
  - Hallucination: _____ instances
  - **Summary status accuracy** (sample 10 conversations): _____ % self-assessment agrees with manual

## Portfolio Output
- [ ] Demo video: record the full CLI run
- [ ] A reflection: the root vs leaf context difference, how sibling awareness is verified
- [ ] W2 eval baseline numbers

---

# 📦 v1 Week 3: Web App Integration

> **Target ship**: Week 3 Day 21
> **Status**: ⚪ Not started

## Goal
Web app. User enters goal → root agent UI 3-step conversation → React Flow mind map → click a node → leaf agent conversation (tool use visible) → localStorage persistence

## Success Criteria
- [ ] A friend using it for 5 minutes asks "what's underneath this?"
- [ ] At least 3 friends try it, each producing 1 piece of feedback
- [ ] You use it yourself to prepare for a real AIPM mock interview
- [ ] **W3 full eval complete, numbers into the portfolio**

## Pre-Week-3 Decisions (fix before Week 2 Day 14)
- [ ] **When are the node's intro + 3 starter questions generated?** Prefetch or lazy?
- [ ] **Streaming implementation** — get the Anthropic SDK streaming API working with a toy first
- [ ] **React Flow node component design** — title + truncated one_liner + status badge. **Do not fiddle with CSS**

## Tasks (trimmed version)
- [ ] Next.js project setup (already init'd in W1)
- [ ] React Flow integration + custom node component (use default styling)
- [ ] Root agent startup flow UI (3-step conversation)
- [ ] Outline → mind map conversion
- [ ] Leaf node conversation UI
- [ ] Tool use indicator (streaming)
- [ ] localStorage persistence (per the P6 v1 schema)
- [ ] Node opening experience (one-liner + intro + 3 questions)
- [ ] Sibling awareness injection (reused from W2)
- [ ] All 6 v0 dogfood insights landed

## Week 3 Not Doing (already deferred to v2)
- ❌ Stale tag UI system
- ❌ Title type 5-way classification + behavior branching
- ❌ Reference edge UI
- ❌ Bottom-up entry
- ❌ Multi-tree support
- ❌ `summary_for_user` generation

## W3 Eval (re-run on every prompt change + full eval after ship)
- [ ] **On every prompt revision** → run automatic metrics (`eval-report.ts`) and compare against baseline, watch for regression
- [ ] **Every weekend** → run manual metrics once
- [ ] **Full eval after W3 ship** (into `eval-runs/W3-final/`):
  - All 4 dimensions of root metric + 4 dimensions of leaf metric
  - Trend chart compared against W1/W2 baselines
  - These numbers → directly into the blog post + portfolio + interview pitch

## Portfolio Output
- [ ] Deploy to Vercel
- [ ] Demo video (3-5 min)
- [ ] Public version of the design doc (redacted)
- [ ] Blog post: "Building a multi-agent thinking environment in 3 weeks" + eval numbers + lessons learned
- [ ] **Eval results page** (companion to the blog post, listing the numbers + methodology on a separate page → reference directly in AIPM interviews)

---

# 🔄 Cross-Cutting (parallel throughout the v1 sprint)

## Cost Dashboard
- [ ] Record token consumption on every run starting from Week 1
- [ ] Summarize every weekend: how many tokens / dollars burned this week (including eval consumption)
- [ ] Have numbers to talk about in AIPM interviews

## Eval Cadence (new)

> See `design-doc-v1.md` §17. This is one of the cross-cutting items most easily skipped but with the highest ROI during the v1 sprint.

- [ ] **Automatic metrics** (run after every prompt change) — `eval-report.ts` takes 5-10 minutes per run
  - Tool use rate / parameter valid rate
  - ReAct iter mean/P95
  - Token cost
  - Node count std/mean (only needed when the root agent changes on Mondays)
  - **Summary schema completeness** (must run after changing the summary generator prompt)
- [ ] **Manual metrics** (run once every Sunday, 30-60 minutes)
  - Coverage scoring on 10 goals
  - Whether personalization is obvious
  - Sibling overlap sampling
  - Hallucination count
  - **Summary status self-assessment accuracy** (sample 5-10 conversations)
- [ ] **Eval log**: an `eval-runs/` directory, recording numbers for each baseline / after each change
  - Watch prompt adjustments → direction of metric changes
  - This is itself an AIPM portfolio asset ("I did X prompt iterations, coverage went from 60% to 85%")

## Feedback Collection
- [ ] **Before the Week 3 ship**, prepare 3 fixed questions to ask every friend who tries it:
  1. What was the most confusing moment?
  2. What was the most useful moment?
  3. Would you be willing to use it again every week? Why / why not?
- [ ] Screen recording (with consent) — see where users get stuck
- [ ] Find 3-5 beta users (friends transitioning to PM / AIPM are ideal)

**Note**: feedback collection is a **qualitative** signal, complementary to eval's **quantitative** signal. Both are needed, and they are not interchangeable.

## Portfolio Artifact Cadence
- [ ] **Every weekend** produce a piece of portfolio material:
  - Week 1: terminal trace demo + reflection + W1 eval baseline
  - Week 2: full CLI run demo + multi-agent design reflection + W2 eval baseline
  - Week 3: full demo + blog post + W3 eval final + eval methodology page
- [ ] **Final package**:
  - 3-5 min main demo video
  - 30-second pitch video (must be able to say the numbers)
  - Blog post (with eval numbers)
  - Eval results page (standalone, methodology + numbers + limitations)
  - GitHub repo
  - Two interview versions, 30 seconds and 5 minutes, well rehearsed. **The 5-minute version must be able to cover eval methodology + one or two specific results**

## Meta-Narrative
- [ ] Record the experience of "using AI to build this AI tool":
  - Which tasks were done with AI, and what the workflow was
  - Which tasks AI actively hindered, and how you noticed
  - The productivity gap between AI-assisted vs traditional development (token count, time)

---

# 🚀 v2 Planning (during the v1 sprint, look but don't touch)

> **Status**: Blocked on v1 ship + 1 week dogfood
> **Kick-off conditions**:
>   1. v1 has shipped and run stably for 1+ weeks
>   2. v1 retro complete
>   3. At least 5 hours of real v1 dogfood (not demos, actually using it)
>   4. At least 3 beta user feedback collected
>   5. **W3 full eval complete, knowing which dimension v1 is weakest on**

## v2 Candidate Features (sorted by combined portfolio + pain-point value)

See the corresponding section in `design-doc-full.md` for design details. **After v1 ships, pick 1-2, not all of them**.

| Feature | From | Time est | Portfolio value | Condition for picking it |
|---|---|---|---|---|
| **Full reactivity propagation + stale UX** | full §10.2-10.3 | 2-3 weeks | ⭐⭐⭐⭐⭐ — directly answers the reactive memory propagation story | v1 dogfood + eval hits the "edit upstream, don't know downstream is stale" pain point |
| **Specialist agent library + type routing** | full §12.2, §8.2 | 3-4 weeks | ⭐⭐⭐⭐ — truly showcases "multi-agent" | v1 eval shows the generic leaf has significantly lower metrics on a certain type of node |
| **Bottom-up entry + concept extraction** | full §15 | 2-3 weeks | ⭐⭐⭐ — a new UX dimension | v1 dogfood reveals users often want to "start from an idea rather than a goal" |
| **Reference edge UX** (drag / create) | full §8.2 | 1-2 weeks | ⭐⭐ — small but useful | v1 dogfood reveals frequent need for cross-branch links |
| **LLM-as-judge eval automation** | v2 eval upgrade | 1-2 weeks | ⭐⭐⭐ — data-driven improvement that scales | v1 eval's manual portion is too slow, blocking fast iteration |
| **Title type ground truth verification + enablement** | full §12.2 | 1 week | ⭐ — preparatory work | prerequisite for enabling specialists |

## v2 Sprint Kick-off Checklist

After the v1 retro is complete:

- [ ] Select the v2 theme (1-2 candidates) — **decision basis = v1 eval weakest dimension + dogfood pain points**
- [ ] Write the v2 design doc (a trimmed version like the v1-only one)
- [ ] Estimate the time box (3-4 weeks? based on availability at the time)
- [ ] List v2 scope cuts (like v1's "Out of Scope" table)
- [ ] Redo the cost model (v2 has new LLM call patterns)
- [ ] **Extend the eval framework** (add metrics for new v2 dimensions, keep tracking the old dimensions)
- [ ] Decide whether v1 needs a schema migration (localStorage migration)

## v1 Decisions to Re-examine During v2

The v1 design is based on v0 dogfood. When v2 kicks off, **v1 dogfood + eval will surely overturn some v1 decisions**. Known candidates (pending verification with real data):

- Is tree-only enough? Do we need multi-parent?
- Is `ancestors_summary_chain` really enough context? Or do we need sibling summary on-demand?
- Is injecting sibling awareness via the prompt really sufficient? Do the eval numbers meet the bar?
- Is localStorage really enough for v1? Or should we have moved to a DB long ago?
- Is the 10-goal root goal test set still enough? Are there uncovered outliers?

---

# 🛰️ v3 Roadmap Holding (loosely held)

> **Status**: Blocked on v2 ship + dogfood
> **Note**: v3 **may never happen**. v1 + v2 might be the final form of the portfolio.

## v3 Candidate Features (very rough)

See `design-doc-full.md` Part IV §20 + Part V §21-23 for design details:

- **Specialist library + meta-agent selecting specialists**
- **Long-term memory facts schema** (cross-tree user profile)
- **Mid-term tree memory** (tree-level goal / progress)
- **Map agent** (background anti-entropy, detecting duplicates / orphans / mergeables)
- **Global Q&A** ("Ask the Map" + `summary_for_user`)
- **Slot-based parent view + cross-child lazy synthesis**
- **`derived_from` edge** (paired with bottom-up promotion provenance)
- **Schema evolution**: DAG / multi-parent
- **Share / clone mind map**
- **A/B eval framework**

## v3 Prerequisites

- v1 + v2 both shipped and stable
- Accumulated at least 50+ hours of dogfood
- At least 10 real users (not demo viewers)
- The v1+v2 portfolio story has been told once through (interviewed with several AIPMs)
- **Still want to do it** (motivation is a real question, not sunk cost)

## v3 Routes Not Taken (confirmed)

- ❌ **Goal-driven fully-automatic agent** — violates the "don't think for the user" philosophy, **never doing it**
- ❌ **Any "user-defined specialist" / "marketplace"** — only consider in v4+

---

# 🛡️ Guardrails Reminder (during the v1 sprint)

1. **No new product ideas until Week 1 ships.** All ideation paused.
2. **3-week time box.** Day 21 ship or retreat, no extensions.
3. **15+ hours/week.**
4. **TypeScript only.**
5. **Tree only.** v1 does not touch DAG / multi-parent.
6. **Ship trumps polish.**
7. **The first version of the eval framework is written in 2-3 hours, not 2-3 days** (see design-doc-v1 §18)

**Anti-pattern alerts**:

- Am I designing the schema again before building?
- Reading more frameworks to "pick the best framework"?
- Adding a feature mid-way because I thought of a new idea?
- **Did I casually do v2's X?** (most dangerous)
- Polishing the UI before the agent loop works?
- **Over-building the eval framework?** (2-3 hours → 2-3 days)
- **Skipping manual eval metrics because they're a hassle?** (this is exactly the part AIPM interviewers want to hear about)

Urge to do a v2 feature → flip to `design-doc-v1.md` Part VII "Out of Scope" table → kill the urge → back to v1.

---

# 📅 v1 Sprint Retro Template (mandatory after the Day 21 ship)

> Whether the ship succeeds or you retreat, **a retro is mandatory**:

- How many hours were actually invested? vs the planned 45 hours
- Which estimates were wrong? Why?
- Which v1 design decisions were overturned by reality after launch? (directly tied to v2 candidates)
- Which v0 dogfood insights did v1 still not solve?
- The 3 things with the most friction for users (including yourself) → v2 candidates
- **Which eval dimension is weakest? Why? → v2 candidates**
- How to tell the AIPM story with the most leverage?
- Which v2 to pick? Or just strengthen the portfolio and skip v2?

**After the retro is complete**:
- Update this tracking doc (archive the v1 sprint section, upgrade v2 planning to v2 sprint)
- Update `design-doc-full.md` (write in what was learned from v1 dogfood)
- Decide whether to proceed to v2

---

*Created 2026-05-11 by Yvonne + Claude.*
*Update cadence: update the status once every Sunday evening.*
*Major overhaul once after v1 ships.*
