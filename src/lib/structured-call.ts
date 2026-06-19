/**
 * runStructuredCall — a single forced-tool-call LLM request.
 *
 * Used by every structured-output call in the system: root phase 1 (clarify),
 * root phase 3 (outline), the summary generator, and the node-intro generator.
 * These are NOT ReAct loops — runReActLoop (agents/react-loop) is for
 * tool_choice:"auto" multi-turn. This helper does ONE messages.create with
 * tool_choice:{type:"tool",name}, extracts the single tool_use block's `.input`,
 * and returns it typed.
 *
 * STRICT TOOL USE: every call forces `strict: true` on the tool. On Opus 4.8,
 * plain forced tool_choice on a multi-field schema (notably a long free-text
 * field before an array, e.g. submit_outline's rationale→nodes) reliably
 * mangles the output — the model crams everything into the first string field
 * and drops the rest. strict mode constrains generation to the schema, which
 * fixes it. Caveat: strict drops minItems/maxItems, so count bounds (5–9 nodes,
 * 1–2 questions, …) are enforced via the optional `validate` callback + 1 retry.
 * Schemas passed in MUST set additionalProperties:false on every object.
 *
 * Reuses lib/retry (withRetry), lib/cost (estimateCost), lib/trace. Mirrors
 * react-loop.ts: lazy client (maxRetries:0), the same transient-only isRetriable
 * policy, grand-total token accounting (`tokens.input` includes cache read+write).
 */

import Anthropic from "@anthropic-ai/sdk"

import { withRetry } from "./retry"
import { estimateCost, type TokenAccumulator } from "./cost"
import {
  createTrace,
  recordIteration,
  finalizeTrace,
  writeTrace,
  type AgentType,
} from "./trace"

type MessageParam = Anthropic.Messages.MessageParam
type Tool = Anthropic.Messages.Tool
type Message = Anthropic.Messages.Message

// Lazily constructed, maxRetries:0 — withRetry is the single retry layer. Same
// reasoning as react-loop.ts (defer env read past dotenv; no double-stacking).
let client: Anthropic | null = null
function getClient(): Anthropic {
  return (client ??= new Anthropic({ maxRetries: 0 }))
}

// Same transient-only retry policy as react-loop.ts (P4 §3): retry 429/5xx and
// network failures with no HTTP status; never deterministic 4xx / validation.
function isRetriable(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (typeof status === "number") return status === 429 || status >= 500
  if (err instanceof Anthropic.APIConnectionError) return true
  const code = (err as { code?: string })?.code
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  )
}

export type StructuredCallInput<T = unknown> = {
  systemPrompt: string
  messages: MessageParam[]
  tool: Tool
  toolName: string
  model: string
  agentType: AgentType
  runId: string
  cacheSystem?: boolean
  /**
   * Optional payload validator. Return an error string if the structured output
   * is invalid (e.g. wrong node count — strict mode can't enforce min/maxItems),
   * or null if OK. On failure the call is retried once before throwing.
   */
  validate?: (data: T) => string | null
}

export type StructuredCallResult<T> = {
  data: T
  tokens: TokenAccumulator
  estimatedCostUsd: number
}

export async function runStructuredCall<T>(
  input: StructuredCallInput<T>,
): Promise<StructuredCallResult<T>> {
  // Tokens accumulate across attempts so cost reflects any retry.
  const total: TokenAccumulator = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  const maxAttempts = input.validate ? 2 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const runId = attempt === 1 ? input.runId : `${input.runId}-retry`
    const tokens: TokenAccumulator = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

    const trace = createTrace({
      runId,
      agentType: input.agentType,
      model: input.model,
      systemPrompt: input.systemPrompt,
      initialMessages: input.messages,
      toolsOffered: [input.tool],
    })

    const requestParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
      model: input.model,
      max_tokens: 4096,
      system: input.cacheSystem
        ? [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }]
        : input.systemPrompt,
      messages: input.messages,
      // Force strict to guarantee schema-valid tool input (see file header).
      tools: [{ ...input.tool, strict: true } as Tool],
      tool_choice: { type: "tool", name: input.toolName },
    }

    const t0 = Date.now()
    let response: Message
    try {
      response = await withRetry(
        () => getClient().messages.create(requestParams),
        { maxAttempts: 3, backoffMs: [1000, 2000, 4000], isRetriable },
      )
    } catch (apiError: any) {
      recordIteration(trace, 0, requestParams, null, Date.now() - t0)
      finalizeTrace(trace, {
        finalStopReason: "error",
        finalMessages: input.messages,
        tokens,
        totalToolCalls: 0,
        estimatedCostUsd: estimateCost(tokens, input.model),
        error: { type: "api_error", message: apiError?.message ?? String(apiError) },
      })
      await writeTrace(trace).catch(() => {})
      throw apiError
    }
    recordIteration(trace, 0, requestParams, response, Date.now() - t0)

    // Grand-total token accounting (input includes cache read+write; cost.ts
    // subtracts the cache slices). Matches react-loop.ts Step 2.
    const cacheRead = response.usage.cache_read_input_tokens ?? 0
    const cacheWrite = response.usage.cache_creation_input_tokens ?? 0
    tokens.input += response.usage.input_tokens + cacheRead + cacheWrite
    tokens.output += response.usage.output_tokens
    tokens.cacheRead += cacheRead
    tokens.cacheWrite += cacheWrite
    total.input += tokens.input
    total.output += tokens.output
    total.cacheRead += tokens.cacheRead
    total.cacheWrite += tokens.cacheWrite

    // Extract the single forced tool_use block. strict + tool_choice guarantee
    // one well-formed block, but guard the invariant.
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === input.toolName,
    )
    const structError =
      toolUseBlocks.length === 1
        ? null
        : {
            type: "structured_output_error",
            message: `runStructuredCall(${input.runId}): expected exactly one '${input.toolName}' tool_use block, got ${toolUseBlocks.length} (stop_reason=${response.stop_reason}).`,
          }

    finalizeTrace(trace, {
      finalStopReason: structError ? "error" : "tool_use",
      finalMessages: [...input.messages, { role: "assistant", content: response.content }],
      tokens,
      totalToolCalls: toolUseBlocks.length,
      estimatedCostUsd: estimateCost(tokens, input.model),
      error: structError,
    })
    try {
      await writeTrace(trace)
    } catch {
      // Trace write failure must not crash the call (mirrors react-loop).
    }

    if (structError) throw new Error(structError.message)

    const data = toolUseBlocks[0].input as T

    // Client-side payload validation (count bounds strict mode can't enforce).
    if (input.validate) {
      const validationError = input.validate(data)
      if (validationError) {
        if (attempt < maxAttempts) continue // retry once
        throw new Error(
          `runStructuredCall(${input.runId}): output failed validation after ${maxAttempts} attempts: ${validationError}`,
        )
      }
    }

    return { data, tokens: total, estimatedCostUsd: estimateCost(total, input.model) }
  }

  // Unreachable: the loop returns or throws on the final attempt.
  throw new Error(`runStructuredCall(${input.runId}): exhausted attempts`)
}

// ============================================================================
// runTextCall — single plain-text LLM call (no tools).
//
// Root phase 2 (confirm) is the only call in the system that returns prose the
// user reads directly (prompts.md "Implementation Notes"). Same machinery as
// runStructuredCall minus tools/tool_choice; returns the joined text.
// ============================================================================

export type TextCallResult = {
  text: string
  tokens: TokenAccumulator
  estimatedCostUsd: number
}

export async function runTextCall(input: {
  systemPrompt: string
  messages: MessageParam[]
  model: string
  agentType: AgentType
  runId: string
  cacheSystem?: boolean
}): Promise<TextCallResult> {
  const tokens: TokenAccumulator = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

  const trace = createTrace({
    runId: input.runId,
    agentType: input.agentType,
    model: input.model,
    systemPrompt: input.systemPrompt,
    initialMessages: input.messages,
    toolsOffered: [],
  })

  const requestParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: input.model,
    max_tokens: 4096,
    system: input.cacheSystem
      ? [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }]
      : input.systemPrompt,
    messages: input.messages,
  }

  const t0 = Date.now()
  let response: Message
  try {
    response = await withRetry(
      () => getClient().messages.create(requestParams),
      { maxAttempts: 3, backoffMs: [1000, 2000, 4000], isRetriable },
    )
  } catch (apiError: any) {
    recordIteration(trace, 0, requestParams, null, Date.now() - t0)
    finalizeTrace(trace, {
      finalStopReason: "error",
      finalMessages: input.messages,
      tokens,
      totalToolCalls: 0,
      estimatedCostUsd: estimateCost(tokens, input.model),
      error: { type: "api_error", message: apiError?.message ?? String(apiError) },
    })
    await writeTrace(trace).catch(() => {})
    throw apiError
  }
  recordIteration(trace, 0, requestParams, response, Date.now() - t0)

  const cacheRead = response.usage.cache_read_input_tokens ?? 0
  const cacheWrite = response.usage.cache_creation_input_tokens ?? 0
  tokens.input += response.usage.input_tokens + cacheRead + cacheWrite
  tokens.output += response.usage.output_tokens
  tokens.cacheRead += cacheRead
  tokens.cacheWrite += cacheWrite

  const estimatedCostUsd = estimateCost(tokens, input.model)

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")

  const finalStopReason =
    response.stop_reason === "end_turn"
      ? "end_turn"
      : response.stop_reason === "max_tokens"
        ? "max_tokens"
        : response.stop_reason === "refusal"
          ? "refusal"
          : "error"

  finalizeTrace(trace, {
    finalStopReason,
    finalMessages: [...input.messages, { role: "assistant", content: response.content }],
    tokens,
    totalToolCalls: 0,
    estimatedCostUsd,
    error: null,
  })
  try {
    await writeTrace(trace)
  } catch {
    // Trace write failure must not crash the call.
  }

  return { text, tokens, estimatedCostUsd }
}
