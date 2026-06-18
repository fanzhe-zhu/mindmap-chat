/**
 * End-to-end smoke test for runReActLoop with Tavily tool.
 * One query. Verifies the loop completes with end_turn and reports cost.
 * (Step 6 will run the three formal test queries from P3.)
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { runReActLoop } from "../src/agents/react-loop"
import { tavilySearchTool, tavilyHandler } from "../src/tools/tavily"

async function main() {
  const SYSTEM = `You are a helpful assistant. Use the web_search tool when you need current information. Answer concisely.`

  const result = await runReActLoop({
    systemPrompt: SYSTEM,
    initialMessages: [
      { role: "user", content: "What's the weather in Tokyo right now? One sentence." },
    ],
    tools: [tavilySearchTool as any],
    toolHandlers: { web_search: tavilyHandler },
    model: "claude-opus-4-8",
    maxIterations: 10,
    cacheSystem: true,
    runId: "smoke-1",
    agentType: "leaf",
  })

  console.log("\n=== Final messages ===")
  for (const msg of result.finalMessages) {
    const c = typeof msg.content === "string"
      ? msg.content
      : (Array.isArray(msg.content)
          ? msg.content.map((b: any) => b.type === "text" ? b.text : `[${b.type}]`).join(" ")
          : String(msg.content))
    console.log(`${msg.role}: ${c.slice(0, 200)}${c.length > 200 ? "…" : ""}`)
  }

  console.log("\n=== Summary ===")
  console.log(`Stop reason:        ${result.finalStopReason}`)
  console.log(`Iterations run:     ${result.iterationsRun}`)
  console.log(`Tool calls:         ${result.toolCallsExecuted}`)
  console.log(`Input tokens:       ${result.tokens.input}`)
  console.log(`Output tokens:      ${result.tokens.output}`)
  console.log(`Cache read tokens:  ${result.tokens.cacheRead}`)
  console.log(`Cache write tokens: ${result.tokens.cacheWrite}`)
  console.log(`Estimated cost:     $${result.estimatedCostUsd.toFixed(4)}`)
  if (result.error) console.log(`Error: ${JSON.stringify(result.error)}`)
}

main().catch(err => {
  console.error("FATAL:", err)
  process.exit(1)
})
