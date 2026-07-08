# Human Scoring Sheet — v1 Manual Eval Metrics

> Companion to the automatic metrics in `eval-runs/<run>/auto-metrics.json`.
> Metric definitions: `design-doc-v1.md` §14–15. Carried as TODO since W1; fill
> against **`eval-runs/W3-final/`** (post prompts-v0.3 run).
>
> Budget ~30–60 min total (tracking.md "Eval Cadence"). Score against what's
> written, not what you remember intending.

## 1. Root coverage — target ≥ 80% avg

For each goal: open `eval-runs/W3-final/root/goal_<id>_run1.json`, list the
outline's node titles next to an expert checklist (wiki TOC / syllabus for
that topic — write down which reference you used). Coverage % = core subtopics
present ÷ core subtopics on the checklist.

| Goal | Reference checklist used | Core subtopics | Covered | % |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

**Coverage avg: ____ %** · Weakest goal: ____ (feeds the v2-theme decision)

## 2. Personalization — target: clearly different

Compare goal #10 (experienced-user variant pair) against its alt-variant run
(`variant` field in the goal JSONs), and goal #5 (blank-slate). Are the two
outlines substantively different (different nodes / depth / framing), not just
reworded?

- Verdict (yes / no): ____
- Evidence (2–3 node titles that only make sense for one variant): ____

## 3. Sibling overlap — target < 20% pair-wise

Sample 5 sibling pairs across different W3-final outlines. For each pair, read
both `one_liner`s + (if conversed) both conversations; estimate conceptual
overlap %.

| Pair (tree / node A / node B) | Overlap % | Notes |
|---|---|---|
| | | |
| | | |
| | | |
| | | |
| | | |

**Avg overlap: ____ %**

## 4. Hallucination on failed tool — target 0 instances

Check every leaf scenario whose trace contains `is_error: true` tool results
(S16 tool_failure category + any incidental failures). Did the assistant admit
the failure or fabricate specifics?

- Instances found: ____
- Scenario IDs + quote if any: ____

## 5. Summary status accuracy — target ≥ 80% agreement

Sample 10 scenarios from `eval-runs/W3-final/leaf/`. Read the conversation,
assign your own `mastered/partial/confused`, then compare with
`summary_result.status`.

| Scenario | Your status | Model status | Agree? |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |

**Agreement: ____ / 10**

## 6. Tool-result integration (leaf metric c) — target > 70%

For scenarios that actually searched: was the tool result reasonably
integrated into the answer (scoped to the node, not dumped verbatim)?

- Searched scenarios reviewed: ____ · Integrated well: ____ · % : ____

---

*Scored by: ____ · Date: ____ · Run: `eval-runs/W3-final/`*
