/**
 * Smoke test for Tavily handler. Three paths:
 *   1. normal query → is_error=false, real results
 *   2. empty query → is_error=true, validation message
 *   3. wrong input shape → is_error=true, validation message
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { tavilyHandler } from "../src/tools/tavily"

async function main() {
  console.log("=== Test 1: normal query ===")
  const t0 = Date.now()
  const r1 = await tavilyHandler({ query: "Anthropic Claude Opus 4.7 release" })
  console.log(`is_error: ${r1.is_error}`)
  console.log(`elapsed:  ${Date.now() - t0}ms`)
  console.log(`content (first 400 chars):\n${r1.content.slice(0, 400)}${r1.content.length > 400 ? "…" : ""}`)

  console.log("\n=== Test 2: empty query ===")
  const r2 = await tavilyHandler({ query: "" })
  console.log(`is_error: ${r2.is_error}`)
  console.log(`content:  ${r2.content}`)

  console.log("\n=== Test 3: wrong input shape ===")
  const r3 = await tavilyHandler({ q: "wrong key name" })
  console.log(`is_error: ${r3.is_error}`)
  console.log(`content:  ${r3.content}`)
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
