/**
 * Smoke test for runStructuredCall — forces one trivial tool call and prints
 * the parsed, typed output. Verifies the structured-call helper end to end
 * before the root agent / summary generator are built on top of it.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { runStructuredCall } from "../src/lib/structured-call"

const echoTool = {
  name: "submit_classification",
  description: "Submit the classification of the user's message.",
  input_schema: {
    type: "object",
    properties: {
      sentiment: {
        type: "string",
        enum: ["positive", "neutral", "negative"],
        description: "Overall sentiment.",
      },
      summary: { type: "string", description: "One-sentence summary." },
    },
    required: ["sentiment", "summary"],
  },
} as const

type Classification = { sentiment: string; summary: string }

async function main() {
  const result = await runStructuredCall<Classification>({
    systemPrompt: "You classify and summarize the user's message. Submit via the tool only.",
    messages: [
      {
        role: "user",
        content: "I just shipped Week 1 of my project and the eval baseline looks great!",
      },
    ],
    tool: echoTool as any, // schema is `as const` (readonly) — cast for the smoke test
    toolName: "submit_classification",
    model: "claude-opus-4-8",
    agentType: "node_intro", // any valid AgentType for the smoke test trace
    runId: "hello-structured-1",
  })

  console.log("=== parsed structured output ===")
  console.log(JSON.stringify(result.data, null, 2))
  console.log(
    `\ncost: $${result.estimatedCostUsd.toFixed(4)}  tokens: ${result.tokens.input}in / ${result.tokens.output}out`,
  )
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
