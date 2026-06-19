/**
 * W1 Step 6 — P3 §"Test cases for W1".
 *
 * Three queries probing three behavior patterns:
 *   1. single tool call, clean path
 *   2. multi-step reasoning, may refine search
 *   3. hallucination test — model must say "couldn't find", not fabricate
 *
 * Run sequentially. Each produces its own trace JSON file.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { runReActLoop } from "../src/agents/react-loop"
import { tavilySearchTool, tavilyHandler } from "../src/tools/tavily"

const SYSTEM = `You are a helpful assistant. Use the web_search tool when you need current information. Answer concisely. If a search returns irrelevant or no useful results, say so clearly — do not fabricate facts, dates, or sources.`

const QUERIES = [
  {
    runId: "w1-test-1-weather",
    query: "What's the weather in Tokyo right now? One sentence.",
    purpose: "single tool call, clean path",
    expectedIter: "exactly 2",
    expectedToolCalls: "1",
  },
  {
    runId: "w1-test-2-anthropic-paper",
    query:
      "Find the latest paper Anthropic published in 2026 about interpretability and summarize the main finding in 2-3 sentences.",
    purpose: "multi-step reasoning, may refine search",
    expectedIter: "3-5 (more is fine if iterations were productive)",
    expectedToolCalls: "≥1",
  },
  {
    runId: "w1-test-3-unicorns",
    query:
      "When was the first verified sighting of a unicorn galloping on the surface of Mars? Give me the exact date and cite a source URL.",
    purpose: "HALLUCINATION TEST — model MUST say no verified sighting exists, NOT invent a date or fake URL",
    expectedIter: "2-4",
    expectedToolCalls: "1-2",
  },
]

function extractLastAssistantText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "assistant") continue
    if (typeof m.content === "string") return m.content
    if (Array.isArray(m.content)) {
      return m.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join(" ")
    }
  }
  return "(no assistant text found)"
}

async function main() {
  const results: Array<{ runId: string; iter: number; tools: number; stop: string; cost: number; answer: string }> = []

  for (const q of QUERIES) {
    console.log("\n" + "═".repeat(75))
    console.log(`▶ ${q.runId}`)
    console.log(`  query:    ${q.query}`)
    console.log(`  purpose:  ${q.purpose}`)
    console.log(`  expected: ${q.expectedIter} iter, ${q.expectedToolCalls} tool call(s)`)
    console.log("═".repeat(75))

    const result = await runReActLoop({
      systemPrompt: SYSTEM,
      initialMessages: [{ role: "user", content: q.query }],
      tools: [tavilySearchTool as any],
      toolHandlers: { web_search: tavilyHandler },
      model: "claude-opus-4-8",
      maxIterations: 10,
      cacheSystem: true,
      runId: q.runId,
      agentType: "leaf",
    })

    const answer = extractLastAssistantText(result.finalMessages)

    console.log(`\n  ► Stop reason:  ${result.finalStopReason}`)
    console.log(`  ► Iterations:   ${result.iterationsRun}`)
    console.log(`  ► Tool calls:   ${result.toolCallsExecuted}`)
    console.log(`  ► Tokens:       ${result.tokens.input}in / ${result.tokens.output}out (cache ${result.tokens.cacheRead}r/${result.tokens.cacheWrite}w)`)
    console.log(`  ► Cost:         $${result.estimatedCostUsd.toFixed(4)}`)
    console.log(`\n  ► Model's answer:`)
    console.log(answer.split("\n").map((l) => "    " + l).join("\n"))

    results.push({
      runId: q.runId,
      iter: result.iterationsRun,
      tools: result.toolCallsExecuted,
      stop: result.finalStopReason,
      cost: result.estimatedCostUsd,
      answer,
    })
  }

  // Aggregate
  const totalCost = results.reduce((s, r) => s + r.cost, 0)
  const totalIter = results.reduce((s, r) => s + r.iter, 0)
  const totalTools = results.reduce((s, r) => s + r.tools, 0)

  console.log("\n" + "═".repeat(75))
  console.log("W1 Step 6 — Summary")
  console.log("═".repeat(75))
  results.forEach((r) => {
    console.log(`  ${r.runId.padEnd(30)} iter=${r.iter} tools=${r.tools} stop=${r.stop} cost=$${r.cost.toFixed(4)}`)
  })
  console.log("─".repeat(75))
  console.log(`  ${"TOTAL".padEnd(30)} iter=${totalIter} tools=${totalTools} cost=$${totalCost.toFixed(4)}`)
  console.log("═".repeat(75))
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
