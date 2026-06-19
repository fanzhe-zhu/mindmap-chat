/**
 * eval-root.ts — Run the root agent on the 10 LOCKED goals, 3 runs each.
 *
 * Each run: phase 1 (clarify) → AUTO-ANSWER → phase 2 (confirm) → AUTO-CONFIRM
 * → phase 3 (outline). The headline metric is granularity stability: node-count
 * std/mean per goal (target < 0.3). Coverage/personalization are human-scored
 * and left as stub fields (mirrors how eval-leaf keeps human metrics out of the
 * auto summary).
 *
 * Auto-answer policy (documented): for multi_choice, pick the first SUBSTANTIVE
 * option (skip the trailing "Other"); for free_text, a fixed neutral string.
 *
 * Output:
 *   eval-runs/<ts>/root/goal_<id>_run<n>.json — per-run result
 *   eval-runs/<ts>/root/summary.json          — aggregated auto-metrics
 *
 * Test set source of truth: goals.ts (LOCKED 2026-05-26). Do NOT inline.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"

import {
  runRootPhase1Clarify,
  runRootPhase2Confirm,
  runRootPhase3Outline,
} from "../src/agents/root.js"
import type { ClarifyOutput, OutlineOutput } from "../src/prompts/root.js"
import { goals } from "./goals.js"
import type { Goal } from "./eval-types.js"

const RUNS_PER_GOAL = 3
const FREE_TEXT_ANSWER = "I want a solid working understanding; no strong constraints beyond that."

// ---------- auto-answer (documented policy) ----------

function autoAnswerExchange(clarify: ClarifyOutput): string {
  return clarify.questions
    .map((q) => {
      if (q.answer_format === "multi_choice" && q.options.length > 0) {
        const substantive = q.options.find((o) => !/other/i.test(o)) ?? q.options[0]
        return `Q: ${q.question}\nA: ${substantive}`
      }
      return `Q: ${q.question}\nA: ${FREE_TEXT_ANSWER}`
    })
    .join("\n\n")
}

// Root agent functions return only their data (per spec). Cost is read back
// from the per-phase trace files written by structured-call / runTextCall.
async function traceCost(agentType: string, runId: string): Promise<number> {
  const date = new Date().toISOString().slice(0, 10)
  let total = 0
  for (const rid of [runId, `${runId}-retry`]) {
    try {
      const t = JSON.parse(await readFile(join("traces", date, agentType, `${rid}.json`), "utf8"))
      total += t.estimated_cost_usd ?? 0
    } catch {
      // trace missing (no retry, or date rollover) — contributes 0
    }
  }
  return total
}

// ---------- per-run result ----------

type RootRunResult = {
  goal_id: number
  goal_text: string
  goal_type: string
  coverage_mode: string
  run_index: number
  node_count: number
  outline: OutlineOutput | null
  cost_usd: number
  error?: string
  // Human-scored dimensions — filled in by hand later (coverage %,
  // personalization clarity). Left null in the auto run, like eval-leaf.
  human: { coverage_pct: number | null; personalization_clear: boolean | null; notes: string }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

async function runOneGoal(goal: Goal, runIndex: number, outDir: string): Promise<RootRunResult> {
  const base = {
    goal_id: goal.id,
    goal_text: goal.goal,
    goal_type: goal.type,
    coverage_mode: goal.coverageMode,
    run_index: runIndex,
    human: { coverage_pct: null, personalization_clear: null, notes: "" },
  }
  const tag = `eval-root-g${pad2(goal.id)}-r${runIndex}`
  try {
    const clarify = await runRootPhase1Clarify({ userGoal: goal.goal, runId: `${tag}-p1` })
    const exchange = autoAnswerExchange(clarify)
    const confirm = await runRootPhase2Confirm({
      userGoal: goal.goal,
      clarifyExchange: exchange,
      runId: `${tag}-p2`,
    })
    const outline = await runRootPhase3Outline({
      userGoal: goal.goal,
      clarifyExchange: exchange,
      confirmedUnderstanding: confirm.text,
      runId: `${tag}-p3`,
    })
    const cost =
      (await traceCost("root_phase1", `${tag}-p1`)) +
      (await traceCost("root_phase2", `${tag}-p2`)) +
      (await traceCost("root_phase3", `${tag}-p3`))

    const result: RootRunResult = { ...base, node_count: outline.nodes.length, outline, cost_usd: cost }
    await writeFile(join(outDir, `goal_${pad2(goal.id)}_run${runIndex}.json`), JSON.stringify(result, null, 2))
    console.log(`  goal ${goal.id} run ${runIndex}: ${outline.nodes.length} nodes, $${cost.toFixed(4)}`)
    return result
  } catch (err: any) {
    console.error(`  goal ${goal.id} run ${runIndex} FAILED: ${err.message}`)
    const result: RootRunResult = { ...base, node_count: 0, outline: null, cost_usd: 0, error: err.message }
    await writeFile(join(outDir, `goal_${pad2(goal.id)}_run${runIndex}.json`), JSON.stringify(result, null, 2))
    return result
  }
}

// ---------- stats helpers ----------

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}
function std(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) // population std
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outDir = join("eval-runs", timestamp, "root")
  await mkdir(outDir, { recursive: true })

  const all: RootRunResult[] = []
  for (const goal of goals) {
    console.log(`\n=== Goal ${goal.id} (${goal.type}): ${goal.goal} ===`)
    for (let r = 1; r <= RUNS_PER_GOAL; r++) {
      all.push(await runOneGoal(goal, r, outDir))
    }
  }

  // Per-goal granularity stability (the headline metric).
  const perGoal = goals.map((goal) => {
    const runs = all.filter((r) => r.goal_id === goal.id && !r.error)
    const counts = runs.map((r) => r.node_count)
    const m = mean(counts)
    const s = std(counts)
    return {
      goal_id: goal.id,
      goal_text: goal.goal,
      coverage_mode: goal.coverageMode,
      runs: runs.length,
      node_counts: counts,
      node_count_mean: m,
      node_count_std: s,
      std_over_mean: m > 0 ? s / m : 0,
      cost_usd: runs.reduce((a, r) => a + r.cost_usd, 0),
    }
  })

  const okRuns = all.filter((r) => !r.error)
  const allCounts = okRuns.map((r) => r.node_count)
  const distribution: Record<number, number> = {}
  for (const c of allCounts) distribution[c] = (distribution[c] ?? 0) + 1

  const perGoalStdOverMean = mean(perGoal.map((g) => g.std_over_mean))

  const summary = {
    timestamp,
    goals: goals.length,
    runs_per_goal: RUNS_PER_GOAL,
    total_runs: all.length,
    failed_runs: all.filter((r) => r.error).length,
    granularity: {
      // Headline: node-count std/mean per goal, averaged. Target < 0.3.
      per_goal_std_over_mean_mean: perGoalStdOverMean,
      target_met: perGoalStdOverMean < 0.3,
      overall_node_count_mean: mean(allCounts),
      overall_node_count_std: std(allCounts),
    },
    node_count_distribution: distribution,
    cost: {
      total_usd: all.reduce((a, r) => a + r.cost_usd, 0),
      avg_per_run: mean(okRuns.map((r) => r.cost_usd)),
      per_goal: perGoal.map((g) => ({ goal_id: g.goal_id, cost_usd: g.cost_usd })),
    },
    per_goal: perGoal,
    // Coverage % and personalization clarity are human-scored — see the per-run
    // `human` stub fields. Not computed here (mirrors eval-leaf).
    human_metrics: "human-scored: coverage %, personalization clarity (see per-run human fields)",
  }

  await writeFile(join(outDir, "summary.json"), JSON.stringify(summary, null, 2))

  console.log(`\n=== Done ===`)
  console.log(`Output: ${outDir}`)
  console.log(
    `granularity std/mean (avg over goals): ${perGoalStdOverMean.toFixed(3)}  target <0.3  ${summary.granularity.target_met ? "✓" : "✗"}`,
  )
  console.log(`overall node count: mean ${summary.granularity.overall_node_count_mean.toFixed(2)}`)
  console.log(`total cost: $${summary.cost.total_usd.toFixed(4)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
