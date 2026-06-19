# Mind Map Chat — Eval Goals (Root Agent Test Set)

> **Version**: v1.0 (2026-05-26, initial lock candidate)
> **Status**: Draft — **lock at end of W0**, then frozen for entire v1 sprint
> **Companion**: `design-doc-v1.md` §14 (root eval metrics), §16 (test set), `eval-scenarios.md` (leaf)
> **Purpose**: This is the **answer key** for root agent coverage scoring. Without it, coverage is vibes.

---

## How to use this file

Each goal has:
- **Type** — concept / skill / comparison / project / vague (drives what "good" looks like)
- **Tests** — the specific thing this goal probes
- **Core subtopics (answer key)** — the 5–8 subtopics a good outline SHOULD surface. This is the coverage reference (§14: "refer to the expert checklist / wiki TOC").
- **Coverage scoring rule** — when scoring, what counts as "covered"

### Coverage scoring convention (lock this — it's your rubric)

A subtopic counts as **covered** if the outline has **a node whose title or one_liner clearly maps to it**. A subtopic only *mentioned in passing inside another node's one_liner* counts as **half** (0.5). Coverage % = covered subtopics / total answer-key subtopics, scored per goal, then averaged across all 10.

- **Target**: 80%+ average (capability metric — expect to start lower, climb via prompt iteration)
- **Don't** penalize an outline for *extra* nodes beyond the answer key — only measure what's missing. (Extra-node bloat is caught by the granularity regression metric, not coverage.)

### Capability vs Regression note

Root agent metrics split (per design-doc-v1 §14, type column):
- **Capability** (climb, track trend): Coverage, Personalization, Non-overlap
- **Regression** (should stay stable): Granularity (node count std/mean < 0.3)

---

## Goal 1 — Understand the core ideas behind RLHF

- **Type**: concept (concept-heavy)
- **Tests**: Whether it can break an abstract training paradigm into a coherent concept chain
- **Core subtopics (answer key)**:
  1. Why RLHF is needed — why pretraining / next-token prediction is not aligned enough
  2. Collecting human preference data (pairwise comparison / preference data)
  3. Reward model training
  4. RL fine-tuning stage (PPO or similar, pushing the policy toward high reward)
  5. KL penalty / preventing reward hacking / preventing drift too far from the base model
  6. Limitations and alternatives (DPO / RLAIF / Constitutional AI)
- **Coverage scoring rule**: 6 subtopics. 1-5 are core (missing any one is a heavy deduction), 6 is a bonus item (missing it is not a big problem, but a good outline will include a "limitations / alternatives" node).

---

## Goal 2 — How does the Transformer work

- **Type**: concept (multi-layer)
- **Tests**: A multi-layer structural concept; whether the outline has a reasonable surface-to-depth ordering
- **Core subtopics (answer key)**:
  1. Tokenization + embedding (how input is turned into vectors)
  2. Positional encoding (why it's needed + how it's done)
  3. Self-attention (Q/K/V mechanism)
  4. Multi-head attention
  5. Feed-forward layer + residual connections + layer norm
  6. Encoder vs decoder architecture variants
  7. Why it replaced RNNs (parallelization / long-range dependencies)
- **Coverage scoring rule**: 7 subtopics. 3-5 are absolutely core (attention is the soul of the Transformer; missing it scores low directly). 1, 2, 6, 7 are about structural completeness; missing 1-2 of them is acceptable.

---

## Goal 3 — Learn to use PostgreSQL

- **Type**: skill (skill-oriented)
- **Tests**: A skill-type goal — the answer key should lean toward "what you can do" rather than "what you understand"
- **Core subtopics (answer key)**:
  1. Installation / connection / basic psql operations
  2. Data types + creating tables / schema design
  3. CRUD (SELECT / INSERT / UPDATE / DELETE)
  4. JOIN + relational modeling
  5. Indexes + query performance basics
  6. Transactions / ACID
  7. (bonus) Backup / permission management
- **Coverage scoring rule**: 7 subtopics. 1-6 are core. Note that for skill-type goals, coverage also depends on whether node titles are imperative / actionable in style (§12.1: title style is decided by the LLM itself, but laying out a skill-type goal as pure noun concepts is a smell — note it manually, it does not go into the coverage score, it goes into personalization / quality observation).

---

## Goal 4 — How to do good user research

- **Type**: skill (soft topic)
- **Tests**: A soft skill — the answer key doesn't have a standard TOC like a technical topic, so the tolerance should be a bit higher
- **Core subtopics (answer key)**:
  1. Defining research goals / asking the right research question
  2. Choosing methods (qualitative vs quantitative; interviews / surveys / usability testing)
  3. Recruitment / sampling (finding the right people)
  4. Interviewing and questioning techniques (avoiding leading questions, probing follow-ups)
  5. Analysis / synthesis (raw data → insight, affinity mapping, etc.)
  6. Turning insights into actionable conclusions / influencing decisions
  7. (bonus) Common biases (confirmation bias, leading bias)
- **Coverage scoring rule**: 7 subtopics. A soft topic allows the outline to slice things differently — if the outline uses a different framework but substantively covers these points, count it as covered. What's judged is "substantive coverage" not "literal matching".

---

## Goal 5 — What to prepare when moving from SWE to AIPM  ✅ Calibrated

- **Type**: skill / planning (your own use case)
- **Tests**: The domain you understand best — the answer key has already been calibrated by you.
- **Core subtopics (answer key)**:
  - **Core (missing any one is a heavy deduction)**:
    2. Skills to build up (eval, prompt engineering, understanding agent systems, data intuition)
    3. Portfolio (how to prove your ability with projects)
    4. Interview prep (case, product sense, technical depth questions)
  - **Bonus items (missing them is not a big problem)**:
    1. The difference in responsibilities between AIPM and traditional PM / SWE (where exactly it differs)
    5. Leveraging your SWE background for a differentiated advantage
    6. Awareness of target companies / market (which kinds of companies are hiring, differences in requirements)
- **Coverage scoring rule**: 6 subtopics. 2/3/4 are absolutely core; missing any one scores low. 1/5/6 are bonus items. Coverage % is still computed over a total of 6 (standalone node = 1, passing mention = 0.5).

---

## Goal 6 — Write a PRD for my side project

- **Type**: project (project-based)
- **Tests**: A project-type goal — the content depends on the specific project, so **first check whether clarify asks what the project is**; coverage is judged on the completeness of the PRD skeleton, not the domain content
- **Core subtopics (answer key) — PRD structural dimensions**:
  1. Problem statement / background (why do it)
  2. Target users + core use cases
  3. Goals / success metrics
  4. Functional requirements / scope (MVP vs later)
  5. Non-functional requirements (performance / security / privacy, etc.)
  6. Out of scope (explicit out of scope)
  7. Milestones / timeline
- **Coverage scoring rule**: 7 subtopics. **Pre-check**: root should first clarify "what is your side project" before generating — if it skips clarify and directly lays out a generic PRD template, then even if coverage is full it should be deducted on the personalization dimension (it treated you as a blank slate, violating §11).

---

## Goal 7 — How to choose between RAG and fine-tuning

- **Type**: comparison
- **Tests**: A comparison-type goal — the answer key should emphasize **decision dimensions**, rather than degenerating into two concept nodes of "what is RAG + what is fine-tuning"
- **Core subtopics (answer key)**:
  1. Quick overview of both mechanisms (a brief summary is enough, it should not take up the bulk)
  2. Decision dimension: data freshness / dynamism
  3. Decision dimension: cost (training vs retrieval infra)
  4. Decision dimension: task type (knowledge injection vs behavior/style change)
  5. Decision dimension: data volume / quality threshold
  6. Hybrid approach (combining both)
  7. Practical decision framework / decision tree
- **Coverage scoring rule**: 7 subtopics. **Comparison-specific smell**: if half the outline's nodes talk about "RAG internal details" and half about "fine-tuning internal details", with no cross-cutting decision-dimension nodes — coverage scores low. The nodes of a good comparison outline are "dimensions", not "the two compared things each expanded separately".

---

## Goal 8 — I want to learn about AI  (vague goal)

- **Type**: vague — **coverage is scored differently**
- **Tests**: Whether clarify kicks in. This one **does not score subtopic coverage** (because it's not narrowed down at all; any fixed subtopic checklist would be wrong).
- **Answer key = clarify behavior, not subtopics**:
  - ✅ Expected: the root agent **does not directly generate a generic AI syllabus**, but first clarifies — asking "which aspect of AI do you want to learn / your background / your purpose (career? curiosity? specific problem?)"
  - ❌ Failure: directly laying out a generic outline of "AI history / machine learning / deep learning / applications", treating the user as a blank slate
- **Coverage scoring rule**: Binary judgment — **does clarify ask about scope/depth/purpose** (pass) or **skip clarify and directly generate a generic syllabus** (fail). Whether the narrowed-down outline matches the clarify answer is a second-layer observation (goes into personalization).

---

## Goal 9 — Learn machine learning  (too-big goal)

- **Type**: vague-ish / oversized — **tests how root handles an overly large scope**
- **Tests**: Granularity doesn't explode + the top-level structure is reasonable. Slightly more specific than #8, so root can choose to clarify **or** give a reasonably layered top-level structure (rather than laying out 30 detail nodes all at once)
- **Answer key — reasonable top-level structure (it should look like this even without clarify)**:
  1. Math / statistics foundations
  2. Supervised learning (regression / classification)
  3. Unsupervised learning
  4. Model evaluation / validation
  5. Feature engineering / data processing
  6. Practice / tools (scikit-learn, etc.)
  7. (extension entry point) Deep learning
- **Coverage scoring rule**: **Primarily tests granularity** (node count should not explode into 20+ detail nodes). Covering the 6-7 **top-level domains** above counts as a pass; if it directly lays out a pile of same-level detail nodes like "linear regression / logistic regression / SVM / KNN / decision tree ..." = top-level abstraction failure, scores low. **This goal is simultaneously a stress-test sample for the granularity regression metric**.

---

## Goal 10 — I've already built an LLM app, I want to understand agents  ✅ Calibrated

- **Type**: concept + **personalization test** (contrast with a blank-slate user)
- **Tests**: Whether the outline **skips the basics the user already knows** (what an LLM is, how to call an API) and goes straight into agent-specific content. This is the core sample for the personalization dimension — compare it with a hypothetical "blank-slate understanding agents".
- **Core subtopics (answer key)**:
  - **Core (1-6 all core, missing any one is a deduction)**:
    1. The difference between an agent and a single LLM call (loop / autonomy / ReAct)
    2. Tool use / function calling (the user may already know the basics → should lean deeper: error handling, parallel calls)
    3. Planning / multi-step reasoning
    4. Memory / state management
    5. Multi-agent orchestration
    6. Agent eval / reliability / failure modes
  - **Bonus item**:
    7. The capability gap from "can call an API" to "can orchestrate agents"
- **Coverage scoring rule**: 7 subtopics. 1-6 all core. **Personalization pre-check**: if the outline contains nodes like "what is an LLM", "what is an API", "what is a prompt" = personalization failure (it didn't leverage the "already built an LLM app" information), and even if technical coverage is high it scores low on personalization.

---

## Personalization test pairs (dedicated to the §14 personalization dimension)

Personalization requires "same goal, different clarify answers → substantively different outlines". Fixed test pairs:

| Test pair | Goal | Clarify answer A | Clarify answer B | Expected |
|---|---|---|---|---|
| P-1 | #5 "moving to AIPM" | "I'm a senior SWE, I've done backend" | "I'm a new grad, I can only write scripts" | Substantively different outlines (the senior one emphasizes differentiated advantage / portfolio, the new-grad one emphasizes building up the basics) |
| P-2 | #10 vs blank slate | "I've built an LLM app" (#10 original text) | "I don't understand AI at all, I want to learn about agents" | #10 skips the LLM basics, the blank-slate version must start from the basics |
| P-3 | #8 "learn about AI" | clarify answer "I'm a doctor, I want to use it in diagnosis" | clarify answer "I'm a student, I want to switch careers" | Completely different narrowing directions |
| P-4 | #10 theory-vs-example | "I want to understand agents from theory" | "I want to take apart a real agent (e.g. Claude Code) to learn" | **Covers the same 6 core concepts, but with clearly different framing**: A is abstract concept nodes; B wraps the same concepts into a concrete system ("how Claude Code does tool use / planning"). What's tested is framing adaptation, **the coverage answer key is unchanged** |

**Scoring**: Manual binary judgment of "whether the two outlines are clearly different". Target: clearly different (§14).

**P-4 note**: This one only tests "whether the agent chose to switch framing based on theory/example". Both sides' coverage is still computed by #10's 1-6 core — the example route wrapping concepts into Claude Code does not mean covering fewer concepts.
> **Related P1 prompt (not eval, revisit during W3 iteration)**: "theory vs example" is one optional way for the root agent to clarify, suitable for concept goals with a signature implementation like #1/#2/#10, **and is not written as a hard rule that every goal must ask** (soft topics like #4 have no canonical example). This change belongs in `prompts.md`, and is not touched during the W0 ground-truth lock phase.

---

## Lock statement

When wrapping up W0, this file (including all subtopic answer keys, coverage scoring rules, and personalization test pairs) is **locked**. During the sprint, nothing is changed, added, or removed. The calibration of Goal #5/#10 must be completed before the lock — changing the answer key after the lock = breaking the apples-to-apples comparison.

**To-do (before lock)**:
- [x] Calibrate Goal #5 answer key — 2/3/4 core, 1/5/6 bonus (2026-05-26)
- [x] Calibrate Goal #10 answer key — 1-6 core, 7 bonus; added P-4 personalization pair (2026-05-26)
- [x] Confirm coverage scoring rules (standalone node = 1, passing mention = 0.5)

**✅ All calibration complete — this file can be locked.**
