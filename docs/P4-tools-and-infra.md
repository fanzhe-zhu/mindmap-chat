# P4 — Tool & Infrastructure Choices

> **Status**: Decision doc for W0 prep
> **Date**: 2026-05-19
> **Companion**: `prompts.md`, `pseudocode-react-loop.md`

---

## 1. Search tool decision

### The three candidates

| | **Anthropic native** | **Brave Search API** | **Tavily** |
|---|---|---|---|
| **Price** | $10/1k searches + token cost for results in context | $5/1k searches (Search plan), $5/mo free credit (~1k queries free) | $8/1k basic queries ($0.008/credit), 1k free credits/month |
| **Free tier** | None (token-based billing only, but no separate free quota) | $5 monthly credit (~1k queries) | 1,000 credits/month permanent, no credit card required |
| **Setup** | Zero — same Anthropic API key, just add `tool: {"type": "web_search_20260209", "name": "web_search"}` | New account, credit card, separate API key | New account, **no credit card** for free tier, separate API key |
| **Content extraction** | Returns snippets + auto-citations | Returns LLM-shaped snippets (`/llm/context` endpoint) | Returns extracted page content (basic) or full extraction (advanced, 2 credits) |
| **Tool dispatch** | Server-side — Anthropic decides when to search; YOU don't write dispatch code | Client-side — you decide & call | Client-side — you decide & call |
| **TypeScript SDK** | Native (you already use `@anthropic-ai/sdk`) | REST API, easy to wrap | Official `@tavily/core` package |
| **Quality (subjective, common consensus)** | Good general-purpose, citations are clean | Good general-purpose, independent index | Best per-search "useful content" for AI agents, but more expensive at scale |

Sources: Anthropic docs (May 2026), Brave docs (Feb 2026 plan refresh), Tavily docs.

### My recommendation: **Tavily**

Three reasons:

**1. No credit card for the free tier.** 1,000 credits/month covers your W1 dev + W2 dev + most of one eval baseline run. You can start today without giving anyone a card. If you blow through 1k credits, $8/1k pay-as-you-go is cheap enough for 3-week sprint scale.

**2. You write the tool dispatch yourself, which is the portfolio story.** Design-doc §1 explicitly says "禁用 LangGraph / CrewAI / AutoGen — 抽象掉的恰恰是 portfolio 要展示的判断力." Anthropic's native `web_search` is the same kind of abstraction at a smaller scope — Anthropic's server decides when to search, you don't see it. With Tavily, YOU write:
- "Did the model decide to call the tool?"
- "Were the parameters valid?"
- "How did I integrate the result?"

These are exactly the three things eval §15 measures (tool use success rate (a)/(b)/(c)). With Anthropic native, two of those metrics don't even exist — they're abstracted away.

**3. Easy to swap later.** If W3 dogfood reveals search quality is the bottleneck, Tavily → Anthropic native is a one-day change (tool definition + result parsing). Tavily → Brave is similar. You're not locked in.

### Why not the other two

**Anthropic native** is fine and the easiest setup, but you give up:
- The portfolio narrative (above)
- Visibility into when/why the model searched
- Control over query construction
- If you ever want to swap providers, you've coupled search to Claude itself

**Brave** is solid but adds a credit card friction with no real upside over Tavily for your scale. If you ever go production at higher volume, Brave's $5/1k vs Tavily's $8/1k matters — but that's a v2/v3 problem, not v1.

### Setup checklist for Tavily

- [ ] Sign up at https://tavily.com (no credit card needed for free tier)
- [ ] Get API key from dashboard
- [ ] Add `TAVILY_API_KEY` to `.env.local` (Next.js convention)
- [ ] Add `.env.local` to `.gitignore` (verify before any commit)
- [ ] Install: `npm install @tavily/core` (or use plain fetch — package is thin)
- [ ] Test query in a throwaway script before W1 starts:
  ```ts
  import { tavily } from "@tavily/core";
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const result = await client.search("anthropic claude opus 4.7 release", { searchDepth: "basic" });
  console.log(result);
  ```
- [ ] Note: `searchDepth: "basic"` = 1 credit; `"advanced"` = 2 credits. **Default to basic for v1.** Eval can compare them later.

---

## 2. Logging strategy

**Decision**: JSON traces per agent run, written to disk. Console output for live debugging.

### Why both

- **Console logs** during development = fast feedback loop when debugging the ReAct loop, error handling, prompt drift
- **JSON traces on disk** = inputs for eval framework (P8). Without persistent traces, you can't replay a failed run, can't diff two prompt versions, and your eval script has nothing to read.

### Trace file shape

One JSON file per agent run, named by timestamp + agent type + ID. Stored under `traces/<YYYY-MM-DD>/<agent_type>/<run_id>.json`.

```typescript
type AgentTrace = {
  run_id: string                  // UUID
  agent_type: "root_phase1" | "root_phase2" | "root_phase3" | "leaf" | "summary_generator" | "node_intro"
  started_at: string              // ISO timestamp
  ended_at: string                // ISO timestamp
  model: string                   // e.g. "claude-opus-4-7"
  
  // Inputs
  system_prompt: string
  initial_messages: Message[]
  tools_offered: ToolDefinition[]
  
  // Trajectory
  iterations: TraceIteration[]
  
  // Outcome
  final_stop_reason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "max_iterations_hit" | "error"
  final_messages: Message[]
  error: { type: string, message: string } | null
  
  // Cost
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  total_tool_calls: number
  estimated_cost_usd: number
}

type TraceIteration = {
  iteration_idx: number           // 0-indexed
  llm_call: {
    request: AnthropicRequest
    response: AnthropicResponse
    latency_ms: number
  }
  tool_calls: TraceToolCall[]     // empty if stop_reason !== "tool_use"
}

type TraceToolCall = {
  tool_name: string
  tool_input: any
  tool_result: any | null         // null if call failed
  is_error: boolean
  error_message: string | null
  latency_ms: number
}
```

### Console output during dev

Per iteration print a one-line summary:

```
[14:32:01] leaf/run_abc123 iter=0 stop=tool_use tool=web_search tokens=1842in/234out
[14:32:03] leaf/run_abc123 iter=1 stop=end_turn tokens=2104in/512out total_cost=$0.018
```

Keep it scan-able. Verbose details go to the JSON trace.

---

## 3. Error handling strategy

Per design-doc-v1 P7 (failure modes table), the cases:

| Failure | Strategy |
|---|---|
| **Anthropic API rate limit** (429) | Retry with exponential backoff: 1s, 2s, 4s, max 3 attempts. After 3 fails: surface to user with "model is busy, try again in a minute" message. |
| **Anthropic API timeout** (>60s) | Single retry. If second attempt times out, return error to user — don't keep retrying, costs add up. |
| **Anthropic API 5xx** | Retry once with 2s delay. Then surface error. |
| **Web search timeout / no results** | Return `{ is_error: true, error_message: "Search returned no results" }` as the tool_result. Model handles via leaf prompt instruction #3 ("when a tool fails or returns nothing useful, say so. Do not fabricate"). |
| **Web search rate limit** (Tavily) | Same as Anthropic 429 — exponential backoff with 3 attempts, then surface. |
| **LLM returns invalid tool call** (param missing/wrong type) | Return tool_result with `is_error: true` and the validation error message. Model retries naturally on next iteration. Counts toward max_iterations cap. |
| **LLM refusal** (`stop_reason: refusal`) | Log, return graceful error to user. Don't retry — refusal is intentional. |
| **Context window overflow** (input + output > model limit) | For v1: surface error to user, ask them to start fresh node or clear notes. Don't auto-truncate — silent truncation breaks trust. v2 can add structured truncation. |
| **User closes tab mid-run** | Browser-side: nothing to do; agent run completes on server (Next.js API route), result gets written but never read. Trace is still useful. For v1 with localStorage, the messages get written by client only when client gets the response — if tab closes, partial state is lost. **Accept this for v1.** |
| **localStorage write failed / quota exceeded** | Surface clear error "your local storage is full — export your tree or clear old data." Provide an export-to-JSON button on the mind map. **Defer the export button to W3 task list — not blocking for now.** |

### Implementation pattern

Wrap all external calls in a typed retry helper:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; backoffMs: number[]; isRetriable: (err: unknown) => boolean }
): Promise<T>
```

Use it for Anthropic API calls and Tavily search calls. Never for tool dispatch logic itself (those errors are deterministic — retrying won't help).

---

## 4. Model selection

Per `prompts.md` implementation notes:

| Prompt | Model | Reason |
|---|---|---|
| Root phase 1 (clarify) | `claude-opus-4-7` | High-stakes — bad clarifying questions cascade into bad outline |
| Root phase 2 (confirm) | `claude-opus-4-7` | Personalization is the whole point |
| Root phase 3 (outline) | `claude-opus-4-7` | Highest-stakes — outline is the foundation of the whole tree |
| Leaf agent | `claude-opus-4-7` | Tutor quality matters; eval coverage targets are aggressive |
| Summary generator | `claude-opus-4-7` for now | **Optimization candidate**: test Haiku-4.5 in W2 eval |
| Intro generator | `claude-opus-4-7` for now | **Optimization candidate**: test Haiku-4.5 in W3 |

**v1 default: Opus 4.7 everywhere.** Optimize down to Haiku only with eval data showing minimal quality loss.

**Pricing reference** (as of May 2026):
- Opus 4.7: $5/MTok input, $25/MTok output
- Sonnet 4.6: $3/MTok input, $15/MTok output
- Haiku 4.5: $1/MTok input, $5/MTok output

Note: Opus 4.7 uses a new tokenizer that can produce up to 35% more tokens for the same text vs Opus 4.6. This matters for cost model (P2) — benchmark actual token usage on your prompts before locking estimates.

---

## 5. Prompt caching strategy

**Enable prompt caching from W1.** Massive cost win at near-zero implementation cost.

Where to put `cache_control` breakpoints:

| Call | Cache breakpoint | Why |
|---|---|---|
| Root phase 1 | None | Each goal is unique; no reuse |
| Root phase 2 | None | Same |
| Root phase 3 | None | Same |
| **Leaf agent** | After system prompt (which includes ancestors_summary_chain + siblings_metadata + tools) | The system prompt + tool definitions are reused across every turn in the same node conversation. Cache hit on input from turn 2 onward = 90% off input cost for that block. |
| Summary generator | None (single call per node-end) | No reuse |
| Intro generator | None (single call per node creation) | No reuse |

**Concretely**: in leaf agent API call, mark the system block with `cache_control: { type: "ephemeral" }`. From turn 2 onward of that node's conversation, the system prompt reads from cache. With ~1800-token system floor (estimated in `prompts.md` token-cost watchpoints), this saves ~$0.007 per turn after turn 1. Over a node averaging 5 turns, that's ~$0.028 savings per node, or ~$0.85 over a 30-node tree just on leaf turns. Real money at sprint scale.

5-minute TTL is fine for v1 (matches expected user behavior — sustained engagement with one node). If users leave a node for >5 min and come back, cache miss = back to standard pricing for that one turn, then re-cache.

---

## 6. Decisions deferred

- **PostgreSQL vs sticking with localStorage**: localStorage for v1, per design-doc. Reconsider for v2 when multi-tree support is needed.
- **Streaming SDK setup**: needed for W3 (tool use indicator). W2 CLI doesn't need it. Decide W2 → W3 transition prep.
- **Sentry / error monitoring**: skip for v1 sprint. Console + JSON traces are enough for solo dev at this scale.
- **Vercel deployment env vars**: W3 task — set `TAVILY_API_KEY` and `ANTHROPIC_API_KEY` in Vercel dashboard before deploy.

---

## Summary

1. **Search tool**: Tavily, free tier, no credit card. Setup checklist above.
2. **Logging**: JSON trace file per run + console one-liner per iteration.
3. **Error handling**: exponential backoff for retriable API errors; tool failures returned as `is_error: true` tool_result so model handles gracefully.
4. **Model**: Opus 4.7 everywhere for v1; benchmark Haiku for summary/intro in W2/W3.
5. **Prompt caching**: enable on leaf agent system prompt from W1.
