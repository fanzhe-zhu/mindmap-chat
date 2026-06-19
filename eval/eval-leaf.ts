/**
 * eval-leaf.ts — Run leaf agent on the 20 fixed scenarios.
 *
 * Usage:
 *   tsx eval-leaf.ts
 *
 * Output:
 *   eval-runs/<ISO_timestamp>/leaf/scenario_<id>.json — full trace per scenario
 *   eval-runs/<ISO_timestamp>/leaf/summary.json       — aggregated auto-metrics
 *
 * Status: SKELETON. Wire up to actual leaf agent (W1) + summary generator (W2).
 *
 * Test set source of truth: scenarios.ts (LOCKED 2026-05-26).
 * Do NOT inline scenario data here — import it. Schema changes go through
 * eval-types.ts + scenarios.ts + scenarios.md together.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

import { runReActLoop } from "../src/agents/react-loop.js"        // ← W1 produces this
// runSummaryGenerator is W2's deliverable (src/agents/summary.ts) — not yet
// built, so it is NOT imported here. W1 baseline records summary_result: null.
import { LEAF_SYSTEM_PROMPT } from "../src/prompts/leaf.js"
import { tavilySearchTool, tavilyHandler } from "../src/tools/tavily.js"

import { scenarios } from "./scenarios.js"
import type { Scenario, NodeRef } from "./eval-types.js"

// =============================================================================
// Placeholder filling — matches prompts.md §"Variable injection: empty-state handling"
// =============================================================================

/**
 * All 20 scenarios are top-level nodes directly under root, so the ancestors
 * chain is always the empty-state literal specified in prompts.md L670.
 * The leaf prompt's empty-state rule is "render the literal string, not blank".
 */
const ANCESTORS_TOP_LEVEL = "(This node is at the top level of the tree. No ancestors.)"

function formatSiblings(siblings: NodeRef[]): string {
  if (siblings.length === 0) return "(No siblings.)"
  return siblings.map(s => `- "${s.title}": ${s.oneLiner}`).join("\n")
}

function buildSystemPrompt(s: Scenario): string {
  return LEAF_SYSTEM_PROMPT
    .replace("{{ node_title }}",              s.node.title)
    .replace("{{ node_one_liner }}",          s.node.oneLiner)
    .replace("{{ user_goal }}",               s.rootGoal)
    .replace("{{ ancestors_summary_chain }}", ANCESTORS_TOP_LEVEL)
    .replace("{{ siblings_metadata }}",       formatSiblings(s.siblings))
    .replace("{{ user_notes_block }}",        "")
}

/**
 * "S1" → "S01" for sortable filenames. "S10"+ stay 2 digits.
 * Important so directory listing orders S01..S20 not S1, S10, S11... S2, S20, S3.
 */
function paddedId(id: string): string {
  const m = /^S(\d+)$/.exec(id)
  if (!m) return id
  return "S" + m[1].padStart(2, "0")
}

// =============================================================================
// Main
// =============================================================================

type ScenarioResult = {
  // Test-set metadata (denormalized into trace so eval-report can filter
  // without re-loading scenarios.ts; LOCKED schema => stable field names)
  scenario_id: string                  // "S1" .. "S20"
  scenario_goal_id: number
  scenario_tree: string                // "A" | "B" | "C" | "D"
  scenario_category: Scenario["category"]
  scenario_needs_tool: boolean
  scenario_primary_metric: string
  scenario_user_message: string

  // Agent outputs (shapes from P3/P4 — verify against real trace after W1)
  leaf_result: Awaited<ReturnType<typeof runReActLoop>> | null
  summary_result: unknown // W2: Awaited<ReturnType<typeof runSummaryGenerator>> | null
  error?: string
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outDir = join("eval-runs", timestamp, "leaf")
  await mkdir(outDir, { recursive: true })

  const allResults: ScenarioResult[] = []

  for (const scenario of scenarios) {
    console.log(`\n=== Scenario ${scenario.id} (${scenario.category}): ${scenario.node.title} ===`)
    console.log(`Root: ${scenario.rootGoal}`)
    console.log(`User: ${scenario.userMessage}`)

    const base: Omit<ScenarioResult, "leaf_result" | "summary_result"> = {
      scenario_id:             scenario.id,
      scenario_goal_id:        scenario.goalId,
      scenario_tree:           scenario.tree,
      scenario_category:       scenario.category,
      scenario_needs_tool:     scenario.needsTool,
      scenario_primary_metric: scenario.primaryMetric,
      scenario_user_message:   scenario.userMessage,
    }

    try {
      const leafResult = await runReActLoop({
        systemPrompt: buildSystemPrompt(scenario),
        initialMessages: [{ role: "user", content: scenario.userMessage }],
        tools: [tavilySearchTool as any],   // propose_new_node intentionally excluded from eval
        toolHandlers: { web_search: tavilyHandler },
        model: "claude-opus-4-8",
        maxIterations: 10,
        cacheSystem: true,
        runId: `eval-leaf-${scenario.id}`,
        agentType: "leaf",
        // W1 baseline pinned to Opus 4.8 (consistent with hello/test scripts +
        // cost.ts default). Keep fixed across the v1 sprint for apples-to-apples.
      })

      // W1 baseline: summary generator is W2's deliverable. Leave null here so
      // every scenario records leaf_result; eval-report's summary metrics will
      // report 0% schema valid until W2 wires runSummaryGenerator. That's
      // expected — the leaf-quality metrics (tool use, iter, cost) are what
      // W1 baseline measures.
      const summaryResult: ScenarioResult["summary_result"] = null

      const full: ScenarioResult = { ...base, leaf_result: leafResult, summary_result: summaryResult }

      const filename = `scenario_${paddedId(scenario.id)}.json`
      await writeFile(join(outDir, filename), JSON.stringify(full, null, 2))
      allResults.push(full)

      console.log(`  Iterations: ${leafResult.iterationsRun}`)
      console.log(`  Stop reason: ${leafResult.finalStopReason}`)
      console.log(`  Tool calls: ${leafResult.toolCallsExecuted}`)
      console.log(`  Cost: $${leafResult.estimatedCostUsd.toFixed(4)}`)
      console.log(`  Summary status: (no summary — W2)`)
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`)
      allResults.push({ ...base, leaf_result: null, summary_result: null, error: err.message })
    }
  }

  // Aggregate
  const successful = allResults.filter(
    r => !r.error && r.leaf_result?.finalStopReason === "end_turn"
  )

  const iterations    = successful.map(r => r.leaf_result!.iterationsRun)
  const toolCallTotal = successful.reduce((s, r) => s + r.leaf_result!.toolCallsExecuted, 0)

  const summary = {
    timestamp,
    total_scenarios: scenarios.length,
    successful_completions: successful.length,
    failed: allResults.length - successful.length,
    iterations: {
      mean: avg(iterations),
      p95:  percentile(iterations, 95),
      max:  iterations.length === 0 ? 0 : Math.max(...iterations),
    },
    tool_calls: {
      total: toolCallTotal,
      calls_per_scenario: avg(successful.map(r => r.leaf_result!.toolCallsExecuted)),
    },
    summaries: {
      schema_valid:   successful.filter(r => r.summary_result && isValidSummary(r.summary_result)).length,
      schema_invalid: successful.filter(r => r.summary_result && !isValidSummary(r.summary_result)).length,
      missing:        successful.filter(r => !r.summary_result).length,
    },
    cost: {
      total_usd:        allResults.reduce((s, r) => s + (r.leaf_result?.estimatedCostUsd ?? 0), 0),
      avg_per_scenario: avg(successful.map(r => r.leaf_result!.estimatedCostUsd)),
    },
  }

  await writeFile(join(outDir, "summary.json"), JSON.stringify(summary, null, 2))

  console.log(`\n=== Done ===`)
  console.log(`Output: ${outDir}`)
  console.log(JSON.stringify(summary, null, 2))
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function isValidSummary(s: any): boolean {
  return (
    typeof s?.topic === "string" &&
    Array.isArray(s?.key_takeaways) && s.key_takeaways.length >= 1 &&
    ["mastered", "partial", "confused"].includes(s?.status) &&
    Array.isArray(s?.open_questions)
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
