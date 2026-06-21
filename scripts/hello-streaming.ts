/**
 * W3 streaming pre-decision proof (tracking-doc W3: "get the Anthropic SDK
 * streaming API working with a toy first"). Mirrors the W1/W2 hello-* scripts.
 *
 * This proves the SDK's token streaming works end-to-end. NOTE: the production
 * leaf path does NOT stream tokens this way — runReActLoop is non-streaming and
 * is reused unchanged (hard constraint #2/#5). The leaf route streams at the
 * TRANSPORT layer instead (a ReadableStream of NDJSON events: a real-time
 * search indicator driven by a wrapped tool handler, plus the assistant text
 * delivered progressively). This script is the isolated proof that SDK-level
 * streaming is available should a future version wire it into the loop.
 *
 *   npx tsx scripts/hello-streaming.ts
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import Anthropic from "@anthropic-ai/sdk"

async function main() {
  const client = new Anthropic({ maxRetries: 0 })
  process.stdout.write("streaming: ")
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 256,
    messages: [{ role: "user", content: "In one sentence, what is a mind map?" }],
  })
  stream.on("text", (delta) => process.stdout.write(delta))
  const final = await stream.finalMessage()
  process.stdout.write("\n\n[done] stop_reason=" + final.stop_reason + "\n")
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
