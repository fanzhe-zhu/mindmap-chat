/**
 * Root agent — 3-phase outline generation (prompts.md §1).
 *
 * Each phase is one LLM call; the state machine lives in the caller (CLI /
 * eval-root). Phases 1 and 3 force a structured tool call; phase 2 returns
 * plain text the user reads and replies to.
 *
 * Prompt strings + tool schemas live in src/prompts/root.ts (verbatim from
 * prompts.md). This module only does injection + dispatch.
 */

import {
  ROOT_PHASE1_CLARIFY_PROMPT,
  ROOT_PHASE2_CONFIRM_PROMPT,
  ROOT_PHASE3_OUTLINE_PROMPT,
  submitClarifyingQuestionsTool,
  submitOutlineTool,
  type ClarifyOutput,
  type OutlineOutput,
} from "../prompts/root"
import { runStructuredCall, runTextCall } from "../lib/structured-call"

// W2 baseline model — pinned to Opus 4.8 for every root call (hard constraint;
// Haiku cost-optimization for summary/intro is a W2-eval experiment only).
const MODEL = "claude-opus-4-8"

/** Phase 1: ask 1–2 clarifying questions (forced submit_clarifying_questions). */
export async function runRootPhase1Clarify(args: {
  userGoal: string
  runId: string
}): Promise<ClarifyOutput> {
  const systemPrompt = ROOT_PHASE1_CLARIFY_PROMPT.replace("{{ user_goal }}", args.userGoal)
  const { data } = await runStructuredCall<ClarifyOutput>({
    systemPrompt,
    messages: [{ role: "user", content: args.userGoal }],
    tool: submitClarifyingQuestionsTool,
    toolName: "submit_clarifying_questions",
    model: MODEL,
    agentType: "root_phase1",
    runId: args.runId,
    // strict mode can't enforce the 1–2 count — validate client-side + retry.
    validate: (d) =>
      Array.isArray(d.questions) && d.questions.length >= 1 && d.questions.length <= 2
        ? null
        : `expected 1–2 questions, got ${d.questions?.length}`,
  })
  return data
}

/**
 * Phase 2: state working understanding + ask for confirmation (plain text).
 * `clarifyExchange` is the formatted "Q: ... / A: ..." block built by the
 * caller; on a user correction, the caller re-runs this with the correction
 * folded in and loops until the user confirms (prompts.md §1.2).
 */
export async function runRootPhase2Confirm(args: {
  userGoal: string
  clarifyExchange: string
  runId: string
}): Promise<{ text: string }> {
  const systemPrompt = ROOT_PHASE2_CONFIRM_PROMPT
    .replace("{{ user_goal }}", args.userGoal)
    .replace("{{ clarify_exchange }}", args.clarifyExchange)
  const { text } = await runTextCall({
    systemPrompt,
    messages: [{ role: "user", content: args.userGoal }],
    model: MODEL,
    agentType: "root_phase2",
    runId: args.runId,
  })
  return { text }
}

/** Phase 3: generate the 5–9 node outline (forced submit_outline). */
export async function runRootPhase3Outline(args: {
  userGoal: string
  clarifyExchange: string
  confirmedUnderstanding: string
  runId: string
}): Promise<OutlineOutput> {
  const systemPrompt = ROOT_PHASE3_OUTLINE_PROMPT
    .replace("{{ user_goal }}", args.userGoal)
    .replace("{{ clarify_exchange }}", args.clarifyExchange)
    .replace("{{ confirmed_understanding }}", args.confirmedUnderstanding)
  const { data } = await runStructuredCall<OutlineOutput>({
    systemPrompt,
    messages: [{ role: "user", content: args.userGoal }],
    tool: submitOutlineTool,
    toolName: "submit_outline",
    model: MODEL,
    agentType: "root_phase3",
    runId: args.runId,
    // strict mode can't enforce the 5–9 count — validate client-side + retry.
    validate: (d) =>
      Array.isArray(d.nodes) && d.nodes.length >= 5 && d.nodes.length <= 9
        ? null
        : `expected 5–9 nodes, got ${d.nodes?.length}`,
  })
  return data
}
