/**
 * JSON trace persistence for agent runs. See P4 §2 (trace file shape).
 *
 * One JSON file per runReActLoop invocation, written to
 *   traces/<YYYY-MM-DD>/<agent_type>/<run_id>.json
 *
 * The trace is the input format for eval-leaf.ts and any replay tooling.
 * Storage uses `unknown` for SDK request/response — these shapes vary by
 * SDK version, and at consumption time the eval/replay code type-narrows.
 */

import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import type { TokenAccumulator } from "./cost"

// ============================================================================
// Types — P4 §2
// ============================================================================

export type AgentType =
  | "root_phase1"
  | "root_phase2"
  | "root_phase3"
  | "leaf"
  | "summary_generator"
  | "node_intro"

export type TraceToolCall = {
  tool_name: string
  tool_input: unknown
  tool_result: unknown | null
  is_error: boolean
  error_message: string | null
  latency_ms: number
}

export type TraceIteration = {
  iteration_idx: number
  llm_call: {
    request: unknown
    response: unknown
    latency_ms: number
  }
  tool_calls: TraceToolCall[]
}

export type AgentTrace = {
  run_id: string
  agent_type: AgentType
  started_at: string
  ended_at: string | null
  model: string

  system_prompt: string
  initial_messages: unknown[]
  tools_offered: unknown[]

  iterations: TraceIteration[]

  final_stop_reason:
    | "end_turn"
    | "tool_use"
    | "max_tokens"
    | "refusal"
    | "max_iterations_hit"
    | "error"
    | null
  final_messages: unknown[]
  error: { type: string; message: string } | null

  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  total_tool_calls: number
  estimated_cost_usd: number
}

// ============================================================================
// Factory + mutators
// ============================================================================

export function createTrace(args: {
  runId: string
  agentType: AgentType
  model: string
  systemPrompt: string
  initialMessages: unknown[]
  toolsOffered: unknown[]
}): AgentTrace {
  return {
    run_id: args.runId,
    agent_type: args.agentType,
    started_at: new Date().toISOString(),
    ended_at: null,
    model: args.model,
    system_prompt: args.systemPrompt,
    initial_messages: args.initialMessages,
    tools_offered: args.toolsOffered,
    iterations: [],
    final_stop_reason: null,
    final_messages: [],
    error: null,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cache_read_tokens: 0,
    total_cache_write_tokens: 0,
    total_tool_calls: 0,
    estimated_cost_usd: 0,
  }
}

export function recordIteration(
  trace: AgentTrace,
  iterationIdx: number,
  request: unknown,
  response: unknown,
  latencyMs: number,
): TraceIteration {
  const iter: TraceIteration = {
    iteration_idx: iterationIdx,
    llm_call: { request, response, latency_ms: latencyMs },
    tool_calls: [],
  }
  trace.iterations.push(iter)
  return iter
}

export function recordToolCall(
  trace: AgentTrace,
  iterationIdx: number,
  call: TraceToolCall,
): void {
  const iter = trace.iterations.find((i) => i.iteration_idx === iterationIdx)
  if (!iter) {
    // Defensive — recordIteration should always run before recordToolCall
    throw new Error(`recordToolCall: no iteration with idx ${iterationIdx}`)
  }
  iter.tool_calls.push(call)
}

export function finalizeTrace(
  trace: AgentTrace,
  outcome: {
    finalStopReason: AgentTrace["final_stop_reason"]
    finalMessages: unknown[]
    tokens: TokenAccumulator
    totalToolCalls: number
    estimatedCostUsd: number
    error: AgentTrace["error"]
  },
): void {
  trace.ended_at = new Date().toISOString()
  trace.final_stop_reason = outcome.finalStopReason
  trace.final_messages = outcome.finalMessages
  trace.total_input_tokens = outcome.tokens.input
  trace.total_output_tokens = outcome.tokens.output
  trace.total_cache_read_tokens = outcome.tokens.cacheRead
  trace.total_cache_write_tokens = outcome.tokens.cacheWrite
  trace.total_tool_calls = outcome.totalToolCalls
  trace.estimated_cost_usd = outcome.estimatedCostUsd
  trace.error = outcome.error
}

// ============================================================================
// Persistence
// ============================================================================

export async function writeTrace(
  trace: AgentTrace,
  baseDir = "traces",
): Promise<string> {
  // Path per P4 §2: traces/<YYYY-MM-DD>/<agent_type>/<run_id>.json
  const date = (trace.started_at ?? new Date().toISOString()).slice(0, 10)
  const dir = join(baseDir, date, trace.agent_type)
  await mkdir(dir, { recursive: true })

  const path = join(dir, `${trace.run_id}.json`)
  await writeFile(path, JSON.stringify(trace, null, 2))
  return path
}
