/**
 * ReAct loop — the single function used by every tool-using agent in this
 * project. Used by leaf agent in W1, and in W2+ by every leaf invocation.
 *
 * Spec: docs/P3-react-loop-pseudocode.md
 *
 * STATUS: skeleton (W1 Step 4). Each TODO points to the relevant P3 section
 * for implementation. Trace operations are deferred to Step 5 (P4 §2);
 * this skeleton emits a console one-liner per iteration, that's it.
 */

import Anthropic from "@anthropic-ai/sdk"

import { withRetry } from "../lib/retry"
import { estimateCost, type TokenAccumulator } from "../lib/cost"

// maxRetries: 0 — withRetry (lib/retry) is the single retry layer; the SDK's
// default (2) would otherwise stack on top, compounding attempts and backoff.
//
// Lazily constructed: the SDK reads ANTHROPIC_API_KEY when the client is built,
// so building at import time breaks any consumer that loads dotenv *after*
// importing this module — and ESM hoists imports above top-level statements, so
// `config()` in a script almost always runs too late. Defer to first call.
let client: Anthropic | null = null
function getClient(): Anthropic {
  return (client ??= new Anthropic({ maxRetries: 0 }))
}

// SDK type aliases. If your @anthropic-ai/sdk version exposes them differently,
// fall back to `import type { MessageParam, Tool, Message } from "@anthropic-ai/sdk/resources/messages"`.
type MessageParam = Anthropic.Messages.MessageParam
type Tool = Anthropic.Messages.Tool
type Message = Anthropic.Messages.Message

// ============================================================================
// Types — see P3 §"Inputs / outputs" (L10-40)
// ============================================================================

export type StopReason =
  | "end_turn"
  | "tool_use"
  | "max_tokens"
  | "refusal"
  | "max_iterations_hit"
  | "error"

export type ToolHandler = (input: unknown) => Promise<{
  is_error: boolean
  content: string
}>

export type ReActInput = {
  systemPrompt: string
  initialMessages: MessageParam[]
  tools: Tool[]
  toolHandlers: Record<string, ToolHandler>
  model: string
  maxIterations: number
  cacheSystem: boolean
  runId: string
}

export type ReActOutput = {
  finalMessages: MessageParam[]
  finalStopReason: StopReason
  iterationsRun: number
  tokens: TokenAccumulator
  toolCallsExecuted: number
  estimatedCostUsd: number
  error: { type: string; message: string } | null
}

// ============================================================================
// One-liner logging — full JSON trace lives in Step 5 (P4 §2)
// ============================================================================

function logOneLiner(runId: string, iteration: number, msg: string): void {
  const hms = new Date().toISOString().slice(11, 19)
  console.log(`[${hms}] ${runId} iter=${iteration} ${msg}`)
}

// ============================================================================
// The loop — see P3 §"The loop" (L44-220)
// ============================================================================

export async function runReActLoop(input: ReActInput): Promise<ReActOutput> {
  const messages: MessageParam[] = [...input.initialMessages]
  const tokens: TokenAccumulator = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let toolCallsExecuted = 0
  let error: { type: string; message: string } | null = null

  function buildOutput(stopReason: StopReason, iterCount: number): ReActOutput {
    return {
      finalMessages: messages,
      finalStopReason: stopReason,
      iterationsRun: iterCount,
      tokens,
      toolCallsExecuted,
      estimatedCostUsd: estimateCost(tokens, input.model),
      error,
    }
  }

  for (let iteration = 0; iteration < input.maxIterations; iteration++) {
    logOneLiner(input.runId, iteration, "calling LLM")

    // ─── Step 1: Call Anthropic API with retry ─────────────────────────
    // See P3 §"The loop" Step 1 (L63-80) + P4 §3 (error handling table)
    let response: Message
    try {
      response = await withRetry(
        () => getClient().messages.create({
          model: input.model,
          max_tokens: 4096,
          system: input.cacheSystem
            ? [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }]
            : input.systemPrompt,
          messages,
          tools: input.tools,
        }),
        {
          maxAttempts: 3,
          backoffMs: [1000, 2000, 4000],
          // Retriable per P4 §3 / P3 L77-79: transient failures only.
          //   429 (rate limit), 5xx (Anthropic-side), and network-layer
          //   failures with no HTTP status (ETIMEDOUT, ECONNRESET, …).
          // NOT retriable: other 4xx (400/401/403/404/413 — deterministic
          //   request problems), refusals, validation errors. Those return
          //   `false` here and surface immediately.
          isRetriable: (err: unknown) => {
            const status = (err as { status?: number })?.status
            if (typeof status === "number") {
              return status === 429 || status >= 500
            }
            // No HTTP status → the request never got a response. The SDK wraps
            // these as APIConnectionError; raw network errors carry a string code.
            if (err instanceof Anthropic.APIConnectionError) return true
            const code = (err as { code?: string })?.code
            return (
              code === "ETIMEDOUT" ||
              code === "ECONNRESET" ||
              code === "ECONNREFUSED" ||
              code === "ENOTFOUND"
            )
          },
        }
      )
    } catch (apiError: any) {
      error = { type: "api_error", message: apiError?.message ?? String(apiError) }
      logOneLiner(input.runId, iteration, "FAILED: " + error.message)
      return buildOutput("error", iteration)
    }

    // ─── Step 2: Update token accumulators ─────────────────────────────
    // P3 §"The loop" Step 2 (L96-100). The API splits input usage three ways:
    // `input_tokens` is the UNCACHED remainder only; cache reads and writes are
    // reported separately (total input = input_tokens + cacheRead + cacheWrite).
    // `tokens.input` is kept as that grand total so cost.ts can subtract the
    // cache slices back out and price each at its own rate. Cache fields are
    // absent on responses without caching, so coalesce to 0.
    const cacheRead = response.usage.cache_read_input_tokens ?? 0
    const cacheWrite = response.usage.cache_creation_input_tokens ?? 0
    tokens.input += response.usage.input_tokens + cacheRead + cacheWrite
    tokens.output += response.usage.output_tokens
    tokens.cacheRead += cacheRead
    tokens.cacheWrite += cacheWrite

    // ─── Step 3: Append assistant message to history ───────────────────
    // P3 §"The loop" Step 3 (L102-104). Push the full content block array
    // (text + any tool_use blocks) so the next turn sees the assistant turn.
    messages.push({ role: "assistant", content: response.content })

    // ─── Step 4: Dispatch on stop_reason ───────────────────────────────
    const stopReason = response.stop_reason

    logOneLiner(
      input.runId,
      iteration,
      `stop=${stopReason} tokens=${response.usage.input_tokens}in/${response.usage.output_tokens}out`
    )

    switch (stopReason) {
      case "end_turn": {
        // P3 L112-116: natural completion.
        return buildOutput("end_turn", iteration + 1)
      }

      case "max_tokens": {
        // P3 L118-124 + Design §1: 4096-token cap hit mid-response. Surface as
        // a soft stop; the response is what it is, so don't retry.
        logOneLiner(input.runId, iteration, "WARNING: max_tokens hit — response truncated")
        return buildOutput("max_tokens", iteration + 1)
      }

      case "refusal": {
        // P3 L126-131 + design-doc P7: model declined. Refusals are
        // intentional — never retry.
        logOneLiner(input.runId, iteration, "WARNING: model refused")
        return buildOutput("refusal", iteration + 1)
      }

      case "tool_use": {
        // P3 L133-190 + Design §3 (parallel calls → ONE user message) +
        // Design §4 (handler exception vs is_error). A single response can
        // carry multiple tool_use blocks; gather every result into one
        // user-role message.
        const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== "tool_use") continue

          const handler = input.toolHandlers[block.name]
          if (!handler) {
            // Model called a tool we never offered. Treat as a failed call so
            // it can recover, rather than crashing the loop.
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: block.id,
              is_error: true,
              content: `Tool '${block.name}' is not available.`,
            })
            continue
          }

          try {
            const result = await handler(block.input)
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: block.id,
              is_error: result.is_error,
              content: result.content,
            })
            toolCallsExecuted++
          } catch (handlerErr: any) {
            // Distinct from is_error: true — an exception here means OUR code
            // is broken, not that the tool failed gracefully. Wrap it so the
            // loop survives, but it reads as a developer-side bug (Design §4).
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: block.id,
              is_error: true,
              content: `Internal error executing tool: ${handlerErr?.message ?? String(handlerErr)}`,
            })
          }
        }

        // Anthropic convention: all tool_result blocks for one assistant turn
        // live in a single user message. Then fall through to the next iteration.
        messages.push({ role: "user", content: toolResultBlocks })
        break
      }

      default: {
        // Unrecognized stop_reason — Anthropic added a new one.
        logOneLiner(input.runId, iteration, `WARNING: unexpected stop_reason=${stopReason}`)
        error = { type: "unknown_stop_reason", message: `stop_reason=${stopReason}` }
        return buildOutput("error", iteration + 1)
      }
    }
  }

  // ─── Hit maxIterations without end_turn ──────────────────────────────
  // See P3 §"Design decisions" §1 (L226-232)
  logOneLiner(
    input.runId,
    input.maxIterations,
    `WARNING: max_iterations (${input.maxIterations}) hit without end_turn`
  )
  return buildOutput("max_iterations_hit", input.maxIterations)
}
