# P3 — ReAct Loop Pseudocode

> **Status**: Spec for Week 1 implementation
> **Date**: 2026-05-19
> **Companion**: `prompts.md`, `P4-tools-and-infra.md`
> **Implementation target**: `runReActLoop()` — single function used by leaf agent (and by extension, all future agents that need tool use)

---

## Inputs / outputs

```typescript
type ReActInput = {
  systemPrompt: string
  initialMessages: Message[]        // user's most recent message, plus any history if continuing a conversation
  tools: ToolDefinition[]            // Anthropic SDK tool definitions
  toolHandlers: Record<string, ToolHandler>   // tool name → dispatch function
  model: string                      // "claude-opus-4-7" by default
  maxIterations: number              // hard cap
  cacheSystem: boolean               // whether to add cache_control to system block
  runId: string                      // for tracing
}

type ToolHandler = (input: unknown) => Promise<{
  is_error: boolean
  content: string                    // result content for the model (or error message)
}>

type ReActOutput = {
  finalMessages: Message[]           // messages array including all assistant turns and tool_result blocks
  finalStopReason: StopReason
  iterationsRun: number
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number }
  toolCallsExecuted: number
  estimatedCostUsd: number
  error: { type: string; message: string } | null
}

type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "max_iterations_hit" | "error"
```

---

## The loop

```
function runReActLoop(input: ReActInput): ReActOutput {

  messages = copy(input.initialMessages)
  tokensAccumulator = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  toolCallsExecuted = 0
  
  // === Trace setup ===
  trace = startTrace(input.runId, agent_type, input.model)
  trace.systemPrompt = input.systemPrompt
  trace.initialMessages = input.initialMessages
  trace.toolsOffered = input.tools

  for iteration in 0..input.maxIterations {

    logOneLiner(input.runId, iteration, "calling LLM")

    // === Step 1: Call Anthropic API ===
    try {
      response = withRetry(
        fn:        () => anthropic.messages.create({
                          model: input.model,
                          system: input.cacheSystem
                                  ? [{type:"text", text:input.systemPrompt, cache_control:{type:"ephemeral"}}]
                                  : input.systemPrompt,
                          messages: messages,
                          tools: input.tools,
                          max_tokens: 4096
                        }),
        maxAttempts: 3,
        backoffMs:   [1000, 2000, 4000],
        isRetriable: err => err.status === 429
                            OR err.status >= 500
                            OR err.code === "ETIMEDOUT"
      )
    } catch (apiError) {
      // Retries exhausted or non-retriable error
      trace.error = { type: "api_error", message: apiError.message }
      logOneLiner(input.runId, iteration, "FAILED: " + apiError.message)
      return {
        finalMessages: messages,
        finalStopReason: "error",
        iterationsRun: iteration,
        tokens: tokensAccumulator,
        toolCallsExecuted,
        estimatedCostUsd: estimateCost(tokensAccumulator, input.model),
        error: trace.error
      }
    }

    // === Step 2: Update accumulators ===
    tokensAccumulator.input       += response.usage.input_tokens
    tokensAccumulator.output      += response.usage.output_tokens
    tokensAccumulator.cacheRead   += response.usage.cache_read_input_tokens ?? 0
    tokensAccumulator.cacheWrite  += response.usage.cache_creation_input_tokens ?? 0

    // === Step 3: Append assistant message to history ===
    // response.content is an array of blocks: text, tool_use, etc.
    messages.push({ role: "assistant", content: response.content })

    // === Step 4: Dispatch on stop_reason ===
    stopReason = response.stop_reason

    logOneLiner(input.runId, iteration, "stop=" + stopReason +
                " tokens=" + response.usage.input_tokens + "in/" + response.usage.output_tokens + "out")

    if stopReason === "end_turn" {
      // Conversation reached natural pause. Done.
      trace.finalStopReason = "end_turn"
      return buildOutput("end_turn", iteration + 1)
    }

    if stopReason === "max_tokens" {
      // Model hit max_tokens limit mid-response. Conversation incomplete.
      // For v1: surface as soft error. User can continue if they want.
      logWarning("max_tokens hit — response truncated")
      trace.finalStopReason = "max_tokens"
      return buildOutput("max_tokens", iteration + 1)
    }

    if stopReason === "refusal" {
      // Model declined to respond. Don't retry.
      logWarning("model refused")
      trace.finalStopReason = "refusal"
      return buildOutput("refusal", iteration + 1)
    }

    if stopReason === "tool_use" {
      // Process every tool_use block in the response.
      // (A single response can contain multiple tool_use blocks if model wants parallel calls.)
      toolResultBlocks = []

      for block in response.content where block.type === "tool_use" {
        toolName  = block.name
        toolInput = block.input
        toolUseId = block.id

        handler = input.toolHandlers[toolName]

        if handler is undefined {
          // Model called a tool we didn't offer. Bug somewhere; treat as failed tool call.
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: toolUseId,
            is_error: true,
            content: "Tool '" + toolName + "' is not available."
          })
          continue
        }

        try {
          startTime = now()
          result = await handler(toolInput)
          latencyMs = now() - startTime

          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: toolUseId,
            is_error: result.is_error,
            content: result.content
          })

          trace.recordToolCall(iteration, toolName, toolInput, result, latencyMs)
          toolCallsExecuted += 1

        } catch (handlerError) {
          // Handler threw an unexpected exception (not the same as is_error=true).
          // This means our code is broken, not that the tool failed gracefully.
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: toolUseId,
            is_error: true,
            content: "Internal error executing tool: " + handlerError.message
          })
          trace.recordToolCall(iteration, toolName, toolInput, null, 0, handlerError)
        }
      }

      // Append all tool_results as ONE user message
      // (Anthropic SDK convention: tool_result blocks live in a user-role message)
      messages.push({ role: "user", content: toolResultBlocks })

      // Continue to next iteration — model will see tool results and decide what's next
      continue
    }

    // Unrecognized stop_reason
    logWarning("unexpected stop_reason: " + stopReason)
    trace.finalStopReason = "error"
    trace.error = { type: "unknown_stop_reason", message: "stop_reason=" + stopReason }
    return buildOutput("error", iteration + 1)
  }

  // === Hit max iterations ===
  logWarning("max iterations (" + input.maxIterations + ") hit without end_turn")
  trace.finalStopReason = "max_iterations_hit"
  return buildOutput("max_iterations_hit", input.maxIterations)


  // Local helper
  function buildOutput(stopReason, iterCount): ReActOutput {
    output = {
      finalMessages: messages,
      finalStopReason: stopReason,
      iterationsRun: iterCount,
      tokens: tokensAccumulator,
      toolCallsExecuted: toolCallsExecuted,
      estimatedCostUsd: estimateCost(tokensAccumulator, input.model),
      error: trace.error
    }
    finalizeTrace(trace, output)
    return output
  }
}
```

---

## Design decisions

### 1. `maxIterations = 10` by default

Design-doc-v1 §15 leaf eval target: mean 2–5, P95 < 8. Setting 10 gives headroom without letting runaway loops cost real money.

**Sanity-check math**: if every iteration costs ~$0.02 (1800 input + ~500 output tokens at Opus 4.7), 10 iterations = $0.20 max per single agent run before the loop force-terminates. Acceptable upper bound for v1 dogfood.

If eval shows P95 starts exceeding 8 frequently, the diagnosis is "prompt is letting loops run too long" (leaf prompt instruction #7) — fix the prompt, don't raise the cap.

### 2. Retry on API errors, NOT on tool errors

API errors (`429`, `5xx`, network) are transient → retry helps.

Tool errors (search returned empty, invalid JSON, etc.) are deterministic for this call → retry won't help. Return them as `is_error: true` tool_result and let the model react. This matches leaf prompt instruction #3.

### 3. Multiple tool_use blocks in one response → process all, then ONE user message with all results

Anthropic SDK convention: if model emits 3 `tool_use` blocks in a single response (parallel tool calls), you respond with ONE user message containing 3 `tool_result` blocks. NOT 3 separate user messages.

For v1, the leaf agent prompt doesn't actively encourage parallel tool calls, but the model might do it anyway. Handle it correctly.

### 4. Handler errors vs `is_error: true` results

Two different failure modes:
- **`is_error: true` returned by handler**: graceful tool failure (search returned nothing, API timed out, etc.). Expected. Model handles via prompt instructions.
- **Handler throws exception**: unexpected bug in your code. Caught and wrapped into `is_error: true` so the loop doesn't crash, but logged loudly as a developer-side issue.

### 5. `cache_control` only on system prompt

For W1 (CLI single agent), system prompt is short and reused → cache it.

For leaf agent later (W2/W3), the system prompt includes ancestors + siblings + user_notes, which is mostly stable across turns of one node conversation → big cache win.

Don't try to cache the messages array itself — it changes every turn.

### 6. Why no streaming in this pseudocode

W1 and W2 are CLI — streaming adds complexity with no UX benefit (just terminal output).

W3 web UI needs streaming for the "agent is searching the web" indicator. Add streaming in W3 by switching `anthropic.messages.create(...)` to `anthropic.messages.stream(...)`. The loop logic is identical; the difference is how you consume the response.

**Pre-W3 prep task**: try streaming in a throwaway script during W2 — verify the API shape, esp. how tool_use events stream (they arrive as separate `content_block_start` + `content_block_delta` events).

---

## Test cases for W1

Before declaring W1 done, run these three queries through the loop:

| Query | Expected behavior |
|---|---|
| `"What's the weather in Tokyo right now?"` | Single tool call → end_turn. Iter count = 2. |
| `"Find the latest paper Anthropic published in 2026 about interpretability and summarize the main finding."` | Multi-step: search → maybe re-search with refined query → end_turn. Iter count = 3-5. |
| `"Search for unicorns galloping on Mars"` (no real results) | One tool call → empty results → model says it couldn't find, no fabrication → end_turn. Iter count = 2. |

For each: verify trace file is well-formed, console one-liner output is readable, cost estimate matches manual calc.

---

## Token cost estimator helper

```typescript
function estimateCost(tokens: TokenAccumulator, model: string): number {
  const PRICES = {
    "claude-opus-4-7": { in: 5.00, out: 25.00, cacheWrite: 6.25, cacheRead: 0.50 },  // per MTok
    "claude-sonnet-4-6": { in: 3.00, out: 15.00, cacheWrite: 3.75, cacheRead: 0.30 },
    "claude-haiku-4-5": { in: 1.00, out: 5.00, cacheWrite: 1.25, cacheRead: 0.10 }
  }
  const p = PRICES[model] ?? PRICES["claude-opus-4-7"]
  return (
    (tokens.input - tokens.cacheRead - tokens.cacheWrite) * p.in / 1_000_000 +
    tokens.cacheWrite * p.cacheWrite / 1_000_000 +
    tokens.cacheRead * p.cacheRead / 1_000_000 +
    tokens.output * p.out / 1_000_000
  )
}
```

Verify these numbers against current Anthropic pricing before W1 ship. Pricing changes; the constants don't.

---

## What this does NOT cover (defer to actual implementation)

- **Logging implementation** (P4 §2 specifies shape; this pseudocode just calls `logOneLiner` / `recordToolCall` etc. as if they exist)
- **`withRetry` implementation** (standard exponential backoff; many examples online)
- **Anthropic SDK Type imports** (use `@anthropic-ai/sdk` types directly: `MessageParam`, `Tool`, `MessageCreateParams`, etc.)
- **Streaming variant** (W3 task)
- **Multi-agent orchestration** (W2 — but this single-agent loop is the substrate; W2 just calls `runReActLoop` for each leaf invocation)

---

## Ready-check before W1 starts

- [ ] You can explain in your own words what happens for each `stop_reason` value
- [ ] You understand why tool errors don't retry but API errors do
- [ ] You know what gets cached (system block) and why it matters (cost)
- [ ] You can articulate why `maxIterations = 10` and what raising it would mean
- [ ] Tavily API key works (test query succeeds)
- [ ] Anthropic API key works (single non-tool call succeeds)
