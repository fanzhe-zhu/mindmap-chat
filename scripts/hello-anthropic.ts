/**
 * Smoke test: verify Anthropic SDK + API key + model name all wired correctly.
 * No tools, no loop — just one round trip.
 */
import Anthropic from "@anthropic-ai/sdk"
import { config } from "dotenv"

config({ path: ".env.local" })

const client = new Anthropic()  // picks up ANTHROPIC_API_KEY from env

async function main() {
  const MODEL = "claude-sonnet-4-6"
  console.log(`Calling ${MODEL}...`)
  const t0 = Date.now()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      { role: "user", content: "In exactly one sentence, what is a vector database?" },
    ],
  })

  const elapsedMs = Date.now() - t0

  console.log("\n=== Response ===")
  for (const block of response.content) {
    if (block.type === "text") console.log(block.text)
  }

  console.log("\n=== Metadata ===")
  console.log(`stop_reason:  ${response.stop_reason}`)
  console.log(`input tokens:  ${response.usage.input_tokens}`)
  console.log(`output tokens: ${response.usage.output_tokens}`)
  console.log(`elapsed:       ${elapsedMs}ms`)
}

main().catch((err) => {
  console.error("ERROR:", err.message)
  process.exit(1)
})
