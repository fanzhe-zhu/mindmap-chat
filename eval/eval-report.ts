/**
 * eval-report.ts — Compute automated metrics over the latest eval run.
 *
 * Usage:
 *   tsx eval-report.ts                    # uses latest run in eval-runs/
 *   tsx eval-report.ts <run-timestamp>    # specific run
 *   tsx eval-report.ts --compare <a> <b>  # diff two runs
 *
 * Output:
 *   Console table of metrics + JSON file at eval-runs/<run>/auto-metrics.json
 *
 * What this DOES:
 *   - Granularity (node count std/mean per goal across 3 runs)
 *   - Tool use rate (% of needs-tool scenarios that triggered web_search)
 *   - Tool params valid rate (% of tool calls with no validation error)
 *   - ReAct iteration distribution
 *   - Summary schema validity
 *   - Cost / token aggregates
 *
 * What this does NOT do (human eval required, see human-scoring-template.md):
 *   - Coverage (manual: did outline cover the expected anchors?)
 *   - Personalization (manual: are default vs alt outlines materially different?)
 *   - Sibling overlap (manual: pairwise overlap %)
 *   - Hallucination (manual: did agent fabricate?)
 *   - Sibling awareness (manual: did agent redirect appropriately?)
 *   - Summary status accuracy (manual: do mastered/partial/confused match reality?)
 *
 * Trace shape expectations (from P3 + P4):
 *   - r.leaf_result.iterationsRun
 *   - r.leaf_result.toolCallsExecuted
 *   - r.leaf_result.estimatedCostUsd
 *   - r.leaf_result.finalStopReason
 *   - r.leaf_result.iterations[].tool_calls[].is_error
 *   - r.leaf_result.iterations[].tool_calls[].error_message
 *   - r.scenario_needs_tool         ← was r.scenario_category === "needs_search" before
 *                                     LOCKED scenarios.ts uses scenario.needsTool: boolean
 *                                     eval-leaf.ts denormalizes it into each trace.
 *   - r.summary_result.{topic,key_takeaways,status,open_questions}
 */

import { readdir, readFile, writeFile } from "fs/promises"
import { join } from "path"

// =============================================================================
// CLI parsing
// =============================================================================

const args = process.argv.slice(2)
const compareMode = args[0] === "--compare"
const runArg = compareMode ? null : args[0]

// =============================================================================
// Locate runs
// =============================================================================

async function findLatestRun(): Promise<string> {
  const runs = await readdir("eval-runs")
  if (runs.length === 0) throw new Error("no eval-runs/ subdirectories found")
  return runs.sort().reverse()[0]
}

async function loadRun(timestamp: string): Promise<{ root: any[]; leaf: any[] }> {
  const rootDir = join("eval-runs", timestamp, "root")
  const leafDir = join("eval-runs", timestamp, "leaf")

  const root = await loadJsonFiles(rootDir).catch(() => [])
  const leaf = await loadJsonFiles(leafDir).catch(() => [])

  return { root, leaf }
}

async function loadJsonFiles(dir: string): Promise<any[]> {
  const files = await readdir(dir)
  const results = []
  for (const f of files) {
    if (!f.endsWith(".json") || f === "summary.json" || f === "auto-metrics.json") continue
    const content = await readFile(join(dir, f), "utf-8")
    results.push(JSON.parse(content))
  }
  return results
}

// =============================================================================
// Root metrics
// =============================================================================

function computeRootMetrics(rootRuns: any[]) {
  // Group by goal_id, keeping only "default" variant runs (skip alt for granularity)
  const byGoal: Record<number, any[]> = {}
  for (const run of rootRuns) {
    if (run.variant !== "default" || run.error) continue
    byGoal[run.goal_id] = byGoal[run.goal_id] || []
    byGoal[run.goal_id].push(run)
  }

  const goalStats = Object.entries(byGoal).map(([goalId, runs]) => {
    const nodeCounts = runs.map(r => r.outline?.nodes?.length || 0)
    const mean = nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length
    const variance = nodeCounts.reduce((s, n) => s + (n - mean) ** 2, 0) / nodeCounts.length
    const std = Math.sqrt(variance)
    return {
      goal_id: Number(goalId),
      run_count: runs.length,
      node_counts: nodeCounts,
      mean,
      std,
      std_over_mean: mean > 0 ? std / mean : 0,
    }
  })

  const avgStdOverMean = goalStats.length === 0
    ? 0
    : goalStats.reduce((s, g) => s + g.std_over_mean, 0) / goalStats.length

  return {
    runs_analyzed:           rootRuns.length,
    goals_with_3plus_runs:   goalStats.filter(g => g.run_count >= 3).length,
    avg_std_over_mean:       avgStdOverMean,
    granularity_target_met:  avgStdOverMean < 0.3,
    per_goal:                goalStats,
  }
}

// =============================================================================
// Leaf metrics
// =============================================================================

function computeLeafMetrics(leafRuns: any[]) {
  const valid = leafRuns.filter(r => !r.error)

  // Tool use rate (needs-tool scenarios only)
  // Source of truth: scenario.needsTool from scenarios.ts (LOCKED).
  // eval-leaf.ts denormalizes it into each trace as r.scenario_needs_tool.
  const needsToolScenarios = valid.filter(r => r.scenario_needs_tool === true)
  const calledTool = needsToolScenarios.filter(r => (r.leaf_result?.toolCallsExecuted ?? 0) > 0)
  const toolUseRate = needsToolScenarios.length === 0
    ? 0
    : calledTool.length / needsToolScenarios.length

  // Tool params valid rate — from trace, count is_error: true tool results due to validation
  // (For W0 prep: trace shape from P3 doesn't yet expose validation errors directly.
  //  Reading from trace.iterations[].tool_calls[].is_error + error_message contains "validation"
  //  is the strategy. Refine after W1 ships and real trace shape is observable.)
  let totalToolCalls = 0
  let validToolCalls = 0
  for (const r of valid) {
    for (const iter of r.leaf_result?.iterations || []) {
      for (const tc of iter.tool_calls || []) {
        totalToolCalls++
        if (!tc.is_error || !(tc.error_message ?? "").toLowerCase().includes("invalid")) {
          validToolCalls++
        }
      }
    }
  }
  const toolParamsValidRate = totalToolCalls === 0 ? 1.0 : validToolCalls / totalToolCalls

  // ReAct iteration distribution
  const iterations = valid.map(r => r.leaf_result?.iterationsRun || 0).filter(n => n > 0)
  const meanIter = iterations.length === 0 ? 0 : iterations.reduce((a, b) => a + b, 0) / iterations.length
  const p95Iter = percentile(iterations, 95)

  // Summary schema validity
  const withSummary = valid.filter(r => r.summary_result)
  const schemaValid = withSummary.filter(r => isValidSummary(r.summary_result))

  // Cost / tokens
  const totalCost = valid.reduce((s, r) => s + (r.leaf_result?.estimatedCostUsd || 0), 0)

  // Category breakdown — informational, no target. New 8-category schema:
  // normal | sibling_awareness | off_topic | prompt_injection | refusal | clarify | tool_failure | multi_step
  const categoryCounts: Record<string, number> = {}
  for (const r of valid) {
    const c = r.scenario_category || "(unknown)"
    categoryCounts[c] = (categoryCounts[c] || 0) + 1
  }

  return {
    scenarios_analyzed:           valid.length,
    needs_tool_scenarios:         needsToolScenarios.length,
    tool_use_rate:                toolUseRate,
    tool_use_target_met:          toolUseRate >= 0.80,
    tool_params_valid_rate:       toolParamsValidRate,
    tool_params_target_met:       toolParamsValidRate >= 0.90,
    react_iter_mean:              meanIter,
    react_iter_p95:               p95Iter,
    react_iter_target_met:        meanIter >= 2 && meanIter <= 5 && p95Iter < 8,
    summary_schema_valid_pct:     withSummary.length === 0 ? 0 : schemaValid.length / withSummary.length,
    summary_schema_target_met:    withSummary.length > 0 && schemaValid.length === withSummary.length,
    total_cost_usd:               totalCost,
    category_breakdown:           categoryCounts,
  }
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

// =============================================================================
// Reporting
// =============================================================================

function printReport(runTimestamp: string, root: any, leaf: any) {
  console.log(`\n=== Eval Auto-Metrics Report ===`)
  console.log(`Run: ${runTimestamp}\n`)

  console.log(`--- Root Agent ---`)
  console.log(`Runs analyzed:              ${root.runs_analyzed}`)
  console.log(`Avg std/mean (granularity): ${root.avg_std_over_mean.toFixed(3)}   ${root.granularity_target_met ? "✅" : "❌"} target <0.3`)
  console.log(`Goals with 3+ runs:         ${root.goals_with_3plus_runs}`)

  console.log(`\n--- Leaf Agent ---`)
  console.log(`Scenarios analyzed:         ${leaf.scenarios_analyzed}`)
  console.log(`Needs-tool scenarios:       ${leaf.needs_tool_scenarios}`)
  console.log(`Tool use rate:              ${(leaf.tool_use_rate * 100).toFixed(1)}%   ${leaf.tool_use_target_met ? "✅" : "❌"} target ≥80%`)
  console.log(`Tool params valid rate:     ${(leaf.tool_params_valid_rate * 100).toFixed(1)}%   ${leaf.tool_params_target_met ? "✅" : "❌"} target ≥90%`)
  console.log(`ReAct iter mean:            ${leaf.react_iter_mean.toFixed(2)}        target 2-5`)
  console.log(`ReAct iter p95:             ${leaf.react_iter_p95}            ${leaf.react_iter_target_met ? "✅" : "❌"} target <8`)
  console.log(`Summary schema valid:       ${(leaf.summary_schema_valid_pct * 100).toFixed(1)}%   ${leaf.summary_schema_target_met ? "✅" : "❌"} target 100%`)
  console.log(`Total cost:                 $${leaf.total_cost_usd.toFixed(4)}`)
  console.log(`Category breakdown:         ${JSON.stringify(leaf.category_breakdown)}`)
}

function printCompare(a: { ts: string; root: any; leaf: any }, b: { ts: string; root: any; leaf: any }) {
  console.log(`\n=== Eval Diff ===`)
  console.log(`A: ${a.ts}`)
  console.log(`B: ${b.ts}\n`)

  const diff = (label: string, av: number, bv: number, fmt: (n: number) => string = n => n.toFixed(3)) => {
    const delta = bv - av
    const sign = delta > 0 ? "+" : ""
    console.log(`${label.padEnd(35)} ${fmt(av).padStart(10)} → ${fmt(bv).padStart(10)}  (${sign}${fmt(delta)})`)
  }

  console.log(`--- Root ---`)
  diff("Avg std/mean",                 a.root.avg_std_over_mean, b.root.avg_std_over_mean)

  console.log(`\n--- Leaf ---`)
  diff("Tool use rate",                a.leaf.tool_use_rate,           b.leaf.tool_use_rate,           n => (n * 100).toFixed(1) + "%")
  diff("Tool params valid rate",       a.leaf.tool_params_valid_rate,  b.leaf.tool_params_valid_rate,  n => (n * 100).toFixed(1) + "%")
  diff("ReAct iter mean",              a.leaf.react_iter_mean,         b.leaf.react_iter_mean,         n => n.toFixed(2))
  diff("ReAct iter p95",               a.leaf.react_iter_p95,          b.leaf.react_iter_p95,         n => String(n))
  diff("Summary schema valid",         a.leaf.summary_schema_valid_pct, b.leaf.summary_schema_valid_pct, n => (n * 100).toFixed(1) + "%")
  diff("Total cost USD",               a.leaf.total_cost_usd,          b.leaf.total_cost_usd,          n => "$" + n.toFixed(4))
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  if (compareMode) {
    const tsA = args[1]
    const tsB = args[2]
    if (!tsA || !tsB) throw new Error("--compare requires two run timestamps")
    const [a, b] = await Promise.all([loadRun(tsA), loadRun(tsB)])
    printCompare(
      { ts: tsA, root: computeRootMetrics(a.root), leaf: computeLeafMetrics(a.leaf) },
      { ts: tsB, root: computeRootMetrics(b.root), leaf: computeLeafMetrics(b.leaf) }
    )
    return
  }

  const timestamp = runArg || (await findLatestRun())
  const { root, leaf } = await loadRun(timestamp)

  const rootMetrics = computeRootMetrics(root)
  const leafMetrics = computeLeafMetrics(leaf)

  printReport(timestamp, rootMetrics, leafMetrics)

  await writeFile(
    join("eval-runs", timestamp, "auto-metrics.json"),
    JSON.stringify({ timestamp, root: rootMetrics, leaf: leafMetrics }, null, 2)
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
