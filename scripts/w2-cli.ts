/**
 * W2 CLI — the full v1 flow in the terminal, no UI.
 *
 *   goal → root phase 1 (clarify) → answer → phase 2 (confirm, loop) →
 *   phase 3 (outline) → numbered list → pick a node → leaf conversation
 *   (runReActLoop, multi-turn, sibling awareness injected) → summary on exit
 *   → pick another or quit → serialize Tree to tree-runs/<ts>.json
 *
 * dotenv is loaded FIRST, before importing anything that builds the Anthropic
 * client (ESM hoists imports above statements; the lazy client defers the env
 * read to first call, but load here so it's set before any call).
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { createInterface } from "node:readline/promises"
import { join } from "node:path"

import type Anthropic from "@anthropic-ai/sdk"

import { runRootPhase1Clarify, runRootPhase2Confirm, runRootPhase3Outline } from "../src/agents/root"
import { runReActLoop } from "../src/agents/react-loop"
import { runSummaryGenerator } from "../src/agents/summary"
import { tavilySearchTool, tavilyHandler } from "../src/tools/tavily"
import { LEAF_SYSTEM_PROMPT } from "../src/prompts/leaf"
import {
  createTree,
  getNode,
  setNodeMessages,
  setNodeSummary,
  writeTree,
  type Tree,
  type Node,
} from "../src/lib/tree"
import type { ClarifyOutput } from "../src/prompts/root"

type MessageParam = Anthropic.Messages.MessageParam

const MODEL = "claude-opus-4-8"
// Empty-state literal for top-level nodes (prompts.md Implementation Notes;
// matches eval-leaf.ts ANCESTORS_TOP_LEVEL). v1 outline nodes are all under root.
const ANCESTORS_TOP_LEVEL = "(This node is at the top level of the tree. No ancestors.)"

// Buffered line input — robust to both interactive TTY and piped stdin. Plain
// readline.question() rejects with ERR_USE_AFTER_CLOSE when piped input hits EOF
// during an async gap; a line queue + EOF sentinel handles both cleanly.
const rl = createInterface({ input: process.stdin })
const lineQueue: string[] = []
let resolveWaiter: ((line: string | null) => void) | null = null
let inputEnded = false
rl.on("line", (line) => {
  if (resolveWaiter) {
    const r = resolveWaiter
    resolveWaiter = null
    r(line)
  } else {
    lineQueue.push(line)
  }
})
rl.on("close", () => {
  inputEnded = true
  if (resolveWaiter) {
    const r = resolveWaiter
    resolveWaiter = null
    r(null)
  }
})

/** Prompt and read one line. Returns null on EOF (piped input exhausted). */
async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt)
  if (lineQueue.length > 0) return lineQueue.shift()!
  if (inputEnded) return null
  return new Promise<string | null>((resolve) => {
    resolveWaiter = resolve
  })
}

/** ask() + trim, preserving the null EOF sentinel. */
async function askTrim(prompt: string): Promise<string | null> {
  const line = await ask(prompt)
  return line === null ? null : line.trim()
}

// ── helpers ────────────────────────────────────────────────────────────────

function lastAssistantText(messages: MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "assistant") continue
    if (typeof m.content === "string") return m.content
    if (Array.isArray(m.content)) {
      return m.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
    }
  }
  return "(no response)"
}

/** Sibling injection — exact eval-leaf.ts formatSiblings format. */
function formatSiblings(siblings: Node[]): string {
  if (siblings.length === 0) return "(No siblings.)"
  return siblings.map((s) => `- "${s.title}": ${s.one_liner}`).join("\n")
}

/** Fill the 6 leaf placeholders. {{ siblings_metadata }} = every OTHER node. */
function buildLeafSystemPrompt(tree: Tree, node: Node): string {
  const siblings = tree.node_order.filter((id) => id !== node.id).map((id) => tree.nodes[id])
  return LEAF_SYSTEM_PROMPT
    .replace("{{ node_title }}", node.title)
    .replace("{{ node_one_liner }}", node.one_liner)
    .replace("{{ user_goal }}", tree.goal)
    .replace("{{ ancestors_summary_chain }}", ANCESTORS_TOP_LEVEL)
    .replace("{{ siblings_metadata }}", formatSiblings(siblings))
    .replace("{{ user_notes_block }}", "")
}

function printOutline(tree: Tree): void {
  console.log(`\n=== Mind map: ${tree.goal} ===`)
  tree.node_order.forEach((id, i) => {
    const n = tree.nodes[id]
    const done = n.summary ? `  [${n.summary.status}]` : ""
    console.log(`  ${i + 1}. ${n.title}${done}`)
    console.log(`     ${n.one_liner}`)
  })
}

/** Present a clarify question, collect the user's answer text. */
async function answerQuestion(q: ClarifyOutput["questions"][number]): Promise<string> {
  console.log(`\n${q.question}`)
  if (q.answer_format === "multi_choice" && q.options.length > 0) {
    q.options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`))
    const raw = (await askTrim("Your choice (number, or type your own): ")) ?? ""
    const idx = Number.parseInt(raw, 10)
    if (Number.isInteger(idx) && idx >= 1 && idx <= q.options.length) {
      const picked = q.options[idx - 1]
      if (/other/i.test(picked)) return (await askTrim("Please specify: ")) ?? ""
      return picked
    }
    return raw // typed a free-text answer instead of a number
  }
  return (await askTrim("Your answer: ")) ?? ""
}

// ── leaf node conversation ───────────────────────────────────────────────────

async function converseInNode(tree: Tree, node: Node): Promise<void> {
  const systemPrompt = buildLeafSystemPrompt(tree, node)
  console.log(`\n--- Node ${node.id}: ${node.title} ---`)
  console.log(`(${node.one_liner})`)
  console.log(`Talk to the tutor. Blank line or /back to leave the node.\n`)

  let messages: MessageParam[] = [...node.messages]
  const messagesBefore = node.messages.length
  let turn = 0

  while (true) {
    const input = await askTrim("You: ")
    if (input === null || input === "" || input === "/back") break

    messages.push({ role: "user", content: input })
    const result = await runReActLoop({
      systemPrompt,
      initialMessages: messages,
      tools: [tavilySearchTool as unknown as Anthropic.Messages.Tool],
      toolHandlers: { web_search: tavilyHandler },
      model: MODEL,
      maxIterations: 10,
      cacheSystem: true,
      runId: `w2-${tree.id}-${node.id}-t${turn}`,
      agentType: "leaf",
    })
    messages = result.finalMessages
    console.log(`\nTutor: ${lastAssistantText(messages)}\n`)
    if (result.finalStopReason !== "end_turn") {
      console.log(`[stop_reason: ${result.finalStopReason}; cost so far this turn $${result.estimatedCostUsd.toFixed(4)}]`)
    }
    turn++
  }

  setNodeMessages(tree, node.id, messages)

  // Summary regen on exit IF the conversation changed since last summary
  // (prompts.md §3 trigger).
  const changed = messages.length > messagesBefore && messages.length > 0
  if (changed) {
    console.log(`\n[generating summary_for_parent for ${node.id}...]`)
    try {
      const summary = await runSummaryGenerator({
        nodeTitle: node.title,
        nodeOneLiner: node.one_liner,
        nodeMessages: messages,
        runId: `w2-${tree.id}-${node.id}-summary`,
      })
      setNodeSummary(tree, node.id, summary)
      console.log(`[summary: status=${summary.status}, ${summary.key_takeaways.length} takeaways, ${summary.open_questions.length} open questions]`)
    } catch (err: any) {
      console.log(`[summary generation failed: ${err?.message ?? err}]`)
    }
  }
}

// ── main flow ────────────────────────────────────────────────────────────────

async function main() {
  const runId = `w2-${new Date().toISOString().replace(/[:.]/g, "-")}`

  const userGoal = await askTrim("What do you want to learn or do? (your goal)\n> ")
  if (!userGoal) {
    console.log("No goal given. Bye.")
    rl.close()
    return
  }

  // Phase 1 — clarify
  console.log("\n[thinking about what to ask...]")
  const clarify = await runRootPhase1Clarify({ userGoal, runId: `${runId}-p1` })
  if (clarify.framing) console.log(`\n${clarify.framing}`)
  const answers: string[] = []
  for (const q of clarify.questions) {
    answers.push(await answerQuestion(q))
  }
  let clarifyExchange = clarify.questions
    .map((q, i) => `Q: ${q.question}\nA: ${answers[i]}`)
    .join("\n\n")

  // Phase 2 — confirm (loop until the user confirms)
  let confirmedUnderstanding = ""
  for (let round = 0; ; round++) {
    console.log("\n[summarizing my understanding...]")
    const confirm = await runRootPhase2Confirm({
      userGoal,
      clarifyExchange,
      runId: `${runId}-p2-r${round}`,
    })
    console.log(`\n${confirm.text}\n`)
    const reply = await askTrim("Press enter / 'yes' to confirm, or type a correction: ")
    if (reply === null || reply === "" || /^(y|yes|yep|correct|looks good|lgtm)$/i.test(reply)) {
      confirmedUnderstanding = confirm.text
      break
    }
    // fold correction in and re-summarize
    clarifyExchange += `\n\nUser correction: ${reply}`
  }

  // Phase 3 — outline
  console.log("\n[sketching the outline...]")
  const outline = await runRootPhase3Outline({
    userGoal,
    clarifyExchange,
    confirmedUnderstanding,
    runId: `${runId}-p3`,
  })
  const tree = createTree(userGoal, confirmedUnderstanding, outline.nodes)

  // Node selection loop
  while (true) {
    printOutline(tree)
    const pick = await askTrim(`\nPick a node (1-${tree.node_order.length}), or 'q' to quit: `)
    if (pick === null || /^q(uit)?$/i.test(pick)) break
    const idx = Number.parseInt(pick, 10)
    if (!Number.isInteger(idx) || idx < 1 || idx > tree.node_order.length) {
      console.log("Not a valid node number.")
      continue
    }
    const node = getNode(tree, tree.node_order[idx - 1])!
    await converseInNode(tree, node)
  }

  // Serialize on quit
  const path = await writeTree(tree, join("tree-runs", `${tree.id}.json`))
  console.log(`\nTree written → ${path}`)
  rl.close()
}

main().catch((err) => {
  console.error("FATAL:", err)
  rl.close()
  process.exit(1)
})
