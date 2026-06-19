# Progress log

## W1 — Leaf agent + ReAct loop + baseline eval

**Status:** Shipped — 2026-06-18

### What this week built

- **`runReActLoop`** (`src/agents/react-loop.ts`) — the single function used by every tool-using agent in this project. Handles all 6 stop reasons (`end_turn`, `max_tokens`, `refusal`, `tool_use`, `max_iterations_hit`, `error`), parallel `tool_use` blocks per Anthropic spec, handler-exception vs `is_error: true` distinction, and system-prompt prompt caching when enabled. Implementation traces `docs/P3-react-loop-pseudocode.md`.
- **`withRetry`** (`src/lib/retry.ts`) — exponential backoff for Anthropic API calls. Retriable on 429, 5xx, `ETIMEDOUT`/`ECONNRESET`/`ECONNREFUSED`/`ENOTFOUND`, and `Anthropic.APIConnectionError` instances. Non-retriable on other 4xx (validation), refusal, and unknown errors. Backoff schedule 1s → 2s → 4s, max 3 attempts. The Anthropic client is constructed with `maxRetries: 0` so this is the single retry layer (no double-stacking with the SDK's built-in retries).
- **`estimateCost`** (`src/lib/cost.ts`) — token-pricing helper across `opus-4-8`, `opus-4-7`, `sonnet-4-6`, `haiku-4-5` with separate cache-read and cache-write columns. `tokens.input` is kept as the grand total (uncached + cache-read + cache-write) so cost subtracts the cache slices back out and prices each at its own rate. Cross-checked against `anthropic.com/pricing` on 2026-06-18.
- **Tavily tool wrap** (`src/tools/tavily.ts`) — Anthropic Messages API tool definition + dispatch handler. Validates input shape before dispatch; surfaces empty results and exceptions as `is_error: true` so the model recovers via leaf prompt instruction #3.
- **JSON trace persistence** (`src/lib/trace.ts`) — one file per agent run at `traces/<YYYY-MM-DD>/<agent_type>/<run_id>.json`. Records request, response, latency, tool calls, and token accumulators per iteration. Failed trace write logs a warning but does not crash the run.
- **Eval harness wired** (`eval/eval-leaf.ts`, `eval/eval-report.ts`) — connected the LOCKED 20-scenario test set (`eval/scenarios.ts`) to the real leaf agent. Report computes tool-use rate, params validity rate, ReAct iter mean/P95, summary schema validity, and total cost.

### Baseline metrics — `eval-runs/W1-baseline/`

20 scenarios × leaf agent (`claude-opus-4-8`) + Tavily basic search.

| Metric | Result | Target | Status |
|---|---|---|---|
| Scenarios completed | 20 / 20 | 20 / 20 | ✓ |
| Tool use rate (needs-tool subset) | 66.7 % (6 / 9) | ≥ 80 % | ✗ (see diagnosis) |
| Tool params valid rate | 100 % | ≥ 90 % | ✓ |
| ReAct iter mean | 1.30 | 2 – 5 | ✗ (same root cause) |
| ReAct iter P95 | 2 | < 8 | ✓ |
| Summary schema validity | 0 % | — | n/a — generator deferred to W2 |
| Fabrication on S19 (PG18 lookup) | 0 | 0 | ✓ |
| Total cost | $0.596 | < $1.00 | ✓ |
| Max iterations hit | 0 | 0 | ✓ |

### Diagnosis of the "below-target" rows

Tool use rate 66.7 % and mean iter 1.30 share one root cause: the model exercised judgment under leaf prompt instruction #2 ("Do NOT search for things you already know well") and decided that 3 of the 9 needs-tool scenarios did not require search.

Manual review of all 3 misses:

- **S4** — *"Are mainstream large models basically all decoder-only now? Why has this trend formed?"* — Decoder-only dominance is a stable trend since 2022. The model gave a well-structured 3-factor explanation (task unification, training efficiency, in-context learning emergence) plus an architectural clarification often missed: decoder-only ≠ no input attention; the real difference is causal masking. No search would have added value.
- **S8** — *"Are there examples of real companies using RAG + fine-tuning together?"* — The model named known patterns (Copilot, customer-support bots), then **explicitly offered to search if the user wanted specifics**: *"I'd rather search than give you a half-remembered detail. If there's a specific company you're curious about, name it and I'll look it up."* This is anti-fabrication behavior more advanced than blind search calling — surfacing the uncertainty boundary rather than committing to a search the user may not need.
- **S9** — *"What kinds of questions do AIPM interviews ask now? How are they different from regular PM?"* — The model gave a structured 5-category framework (technical depth, product sense under uncertainty, eval framing, data/feedback loops, AI judgment) and asked the user to narrow scope by company type before going deeper. The categories are stable AIPM framework knowledge from 2023 onward.

All 3 misses register as **(a) judgment correct**, not (b) prompt failure. The cross-language re-run (Chinese baseline before the project was translated to English) confirms this is real model behavior, not a tokenization artifact: tool-use rate was identical (66.7 %) in both languages, and S4 / S9 missed in both runs.

The gap is in `scenarios.ts` labeling: `needsTool: true` was assigned based on rhetorical recency signals ("now", "examples of real") rather than actual freshness requirements.

**S19 (PG18) is the genuine "must search" case** — the model correctly searched, found real release info, and did not fabricate. One honest caveat for the record: S19 was *authored* (2026-05-26) as a "failed search / hallucination floor" test on the assumption that PostgreSQL 18 was unreleased. PG18 actually shipped 2025-09-25, so the search now succeeds — the scenario no longer tests what it was designed to and should be re-anchored to a genuinely-unreleased version in W2. The "0 fabrications" result holds; the test's *premise* has expired.

### Highlight traces (portfolio exhibits)

Two leaf runs that exemplify designed behavior:

- **`eval-runs/W1-baseline/leaf/scenario_S19.json`** — searched, found real PG18 info (reported as released 2025-09-25), synthesized to the node's scope ("Indexes and query performance"): picked out skip scan and async I/O, explicitly set aside UUIDv7 / OAuth as out-of-scope for this node. `iter = 2, tool = 1, end_turn`.
- **`eval-runs/W1-baseline/leaf/scenario_S20.json`** — issued **2 parallel `tool_use` blocks in a single iteration** (OpenAI JD + Anthropic JD), then synthesized both *through the interview-prep lens*: Anthropic's listings gate on an explicit engineering background (a tailwind for an SWE-to-AIPM move), while OpenAI's weight multi-stakeholder / safety judgment. Closed by proposing a child node on interview-loop structure. `iter = 2, tool = 2, end_turn`. This is `design-doc-v1.md` §"Design Decision 3" (parallel `tool_use`) demonstrated in production.

### Actionable for W2

1. **`scenarios.ts` schema refinement** — split `needsTool: boolean` into `requiresFreshData: boolean` (genuine recency, like S19) vs the broader "could search" category. Re-target tool-use rate per stratum (probably 100 % on `requiresFreshData`, lower bar on the rest). Re-anchor S19 to a genuinely-unreleased version.
2. **Leaf prompt instruction #2** — consider adding an explicit "when the user names a specific company/version/date, prefer search confirmation over prior knowledge" clause. But S8's behavior (offering to search) is arguably better than what a stricter rule would produce — needs careful prompt-engineering design.
3. **Summary generator** (`src/agents/summary.ts`) — currently not built. Will fill the 0 % summary-schema row and wire end-of-conversation summarization per `docs/prompts.md` §3.

### Intentionally out of scope for W1

- `propose_new_node` tool — defined in leaf prompt but not wired in W1 eval. The handler-missing branch in `runReActLoop` catches any model attempts gracefully (returns `is_error: true`; model recovers). UI to accept proposals lives in W3.
- Streaming responses — deferred per `docs/P3-react-loop-pseudocode.md` §"Why no streaming" (CLI doesn't need it; W3 UI will reconsider).
- Root agent (phase 1 / 2 / 3 outline generation) — W2.

### Time and cost

- Calendar time: design / prep complete 2026-05-26, W1 build 2026-06-17 → 2026-06-18 (single sprint, ~7 hours active work after a 20-day gap between prep and build).
- W1 eval cost: $0.596 (20 scenarios, Opus 4.8, Tavily basic).
- Total spent on this project to date (Anthropic + Tavily, prep + W1): well under the $120-180 sprint budget from `docs/P2-cost-model.md`.

### What's verifiable in this commit

- `src/agents/react-loop.ts`, `src/lib/retry.ts`, `src/lib/cost.ts`, `src/lib/trace.ts`, `src/tools/tavily.ts` — production code.
- `eval/` — typed test set + harness + report. `tsc --noEmit` passes with zero errors.
- `eval-runs/W1-baseline/` — 20 trace JSON files + aggregated `summary.json` + `auto-metrics.json`.
- `scripts/hello-anthropic.ts`, `scripts/hello-tavily.ts`, `scripts/hello-react-loop.ts`, `scripts/w1-test-queries.ts` — incremental verification scripts written across Step 2-6.
- `traces/` is **not** committed — raw per-run `runReActLoop` traces are written there (`traces/<date>/<agent_type>/<run_id>.json`) but are gitignored as run artifacts. The committed eval traces live in `eval-runs/W1-baseline/`.

---

## W2 — Root agent + Leaf CLI + summary generator

**Status:** Shipped — 2026-06-18

### What this week built

- **`runStructuredCall` + `runTextCall`** (`src/lib/structured-call.ts`) — single forced-tool-call and plain-text LLM helpers for every non-ReAct call. Reuses retry/cost/trace; lazy client; grand-total token accounting. Forces **strict tool use** (see deviations below) with an optional client-side `validate` callback + 1 retry.
- **Root agent, 3 phases** (`src/agents/root.ts` + `src/prompts/root.ts`, verbatim from prompts.md §1) — `runRootPhase1Clarify` (1–2 questions, multi-choice or free-text), `runRootPhase2Confirm` (the one plain-text call — states understanding, loops until the user confirms), `runRootPhase3Outline` (5–9 node structured outline). Opus 4.8.
- **Summary generator** (`src/agents/summary.ts` + `src/prompts/summary.ts`, prompts.md §3) — turns a leaf conversation into the 4-field `summary_for_parent` (`topic` / `key_takeaways` / `status` / `open_questions`).
- **In-memory Tree** (`src/lib/tree.ts`) — single flat level under root (P6 shape); create / get / set messages / set summary / serialize / write.
- **`npm run w2`** (`scripts/w2-cli.ts`) — the full v1 flow in the terminal: goal → clarify → confirm → numbered outline → pick a node → **leaf agent reused from W1 (`runReActLoop`) with sibling metadata injected** → multi-turn conversation → summary on exit → serialize Tree to `tree-runs/`. Buffered line input (robust to piped stdin + EOF).
- **Eval** — `eval/eval-root.ts` (`npm run eval:root`: 10 goals × 3, granularity metric); wired the real summary generator into `eval/eval-leaf.ts` (fills the W1 0% summary row); fixed `eval-report.ts`'s latest-run picker (named baselines were sorting ahead of timestamps).

### Baseline metrics — `eval-runs/W2-baseline/`

**Root agent** (`claude-opus-4-8`, 10 goals × 3 runs = 30):

| Metric | Result | Target | Status |
|---|---|---|---|
| Runs completed | 30 / 30 | 30 / 30 | ✓ |
| **Granularity std/mean** (per-goal node-count, averaged) | **0.040** | < 0.30 | ✓ (very stable) |
| Node count | mean 7.93, dist {7:5, 8:22, 9:3} | 5–9 each | ✓ |
| Total cost | $1.61 | — | ✓ |

Goal #9 ("learn machine learning" — the too-large-scope granularity stress test) stayed at 8–9 nodes instead of exploding into 20+ — the granularity guard holds.

**Leaf re-run** (`claude-opus-4-8`, same 20 LOCKED scenarios, now with summary generation):

| Metric | W1 baseline | W2 re-run | Note |
|---|---|---|---|
| Completions | 20 / 20 | 20 / 20 | |
| Tool-use rate (needs-tool) | 66.7 % | 77.8 % | within run-to-run noise (leaf tool decision is non-deterministic — see W1 §S6/S8) |
| Tool params valid | 100 % | 100 % | |
| ReAct iter mean / P95 | 1.30 / 2 | 1.35 / 2 | unchanged |
| **Summary schema valid** | **0 %** | **100 %** (20/20) | the W1 0% row, now filled |
| Cost | $0.596 | $0.657 | +20 summary calls |

Leaf metrics held steady — injecting 6 siblings into every leaf prompt did **not** degrade tool use or iteration behavior (the headline sibling-awareness feature is "free" on the quantitative axes; its quality is human-scored).

### Schema deviations from "verbatim" (forced by Opus 4.8; documented in prompts.md)

`tool_choice` alone is **not** sufficient on Opus 4.8 for multi-field schemas. `submit_outline` (long `rationale` field before the `nodes` array) reliably failed — the model crammed everything into `rationale` and dropped `nodes` (~50–100%). Two mechanical fixes (field names/types/descriptions unchanged):

1. **Strict tool use** — `strict: true` + `additionalProperties: false`; count bounds (5–9 nodes, etc.) moved to client-side validate + retry (strict drops `minItems`/`maxItems`).
2. **Structured-array-first field order** — `nodes` before `rationale`. Strict alone still left `nodes` empty ~50% of runs; reordering fixed it 6/6 and also cleaned up the rationale text.

### Deferred to W2-end (test-set refinements, done after the baseline to keep apples-to-apples)

Carried from W1, plus confirmed this week — **not** done mid-week:
1. Split `scenarios.ts` `needsTool` into `requiresFreshData` vs "could search"; re-anchor the rotted S19 (PG18) premise.
2. Root coverage / personalization are **human-scored** and still TODO (the auto baseline covers granularity + cost only). Per-run `human` stub fields are written in each `eval-runs/W2-baseline/root/goal_*.json`.

### Honest observations

- **Node count clusters hard at 8** (22 of 30 runs). Granularity is extremely *stable* (std/mean 0.040), but the tight clustering may reflect the model anchoring near 8 rather than truly varying granularity per goal. Whether that's good adaptation is a coverage / human-eval question, not visible in the auto metrics.
- The 77.8% vs 66.7% tool-use is **not** evidence that sibling awareness helped tool use — it's the same non-determinism documented in W1. Don't over-read it.

### Intentionally out of scope for W2 (→ W3)

Web app / React Flow, streaming, localStorage, the `propose_new_node` accept-UI (the leaf prompt still offers it; the CLI logs nothing and `runReActLoop`'s handler-missing branch absorbs any call), node-intro generator wiring (prompt exists at prompts.md §4; not used in the W2 CLI/eval).
