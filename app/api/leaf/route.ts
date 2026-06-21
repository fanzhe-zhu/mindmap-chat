/**
 * Leaf conversation route — streaming.
 *
 * Reuses runReActLoop EXACTLY as scripts/w2-cli.ts does (hard constraint #5):
 * same sibling injection, same Tavily tool + handler, cacheSystem:true,
 * maxIterations:10, agentType "leaf". runReActLoop is non-streaming and is NOT
 * modified (constraint #2). Streaming is therefore done at the TRANSPORT layer:
 * this handler returns a ReadableStream of newline-delimited JSON events.
 *
 *   { type: "search_start", query }   — emitted the moment web_search is in
 *                                        flight (the wrapped handler enqueues
 *                                        before awaiting Tavily; runReActLoop
 *                                        awaits the handler, so this is a
 *                                        genuinely real-time indicator)
 *   { type: "search_end", ok }
 *   { type: "proposal", title, one_liner, reason }  — propose_new_node call
 *   { type: "text_delta", text }      — assistant text, delivered in chunks
 *   { type: "done", finalMessages, stopReason }
 *   { type: "error", message }
 *
 * propose_new_node's tool definition lives HERE in the app layer (not src/) so
 * src/* stays untouched; its schema is verbatim from prompts.md §2. The leaf
 * prompt already offers it; W2's CLI never wired a handler so it was inert. Here
 * the handler records the proposal and surfaces it to the UI for accept.
 */

import type Anthropic from "@anthropic-ai/sdk"

import { runReActLoop } from "@/src/agents/react-loop"
import { tavilySearchTool, tavilyHandler } from "@/src/tools/tavily"
import { LEAF_SYSTEM_PROMPT } from "@/src/prompts/leaf"

type MessageParam = Anthropic.Messages.MessageParam

const MODEL = "claude-opus-4-8"
const ANCESTORS_TOP_LEVEL = "(This node is at the top level of the tree. No ancestors.)"

// propose_new_node — verbatim schema from prompts.md §2 (leaf agent tools).
const proposeNewNodeTool = {
  name: "propose_new_node",
  description:
    "Propose creating a child node under the current node. User confirms before creation. Use sparingly — only for genuine sub-topics that warrant their own scope.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "Proposed title in the user's language. Natural phrasing — question, imperative, or noun phrase as fits.",
      },
      one_liner: {
        type: "string",
        description: "≤25 words/characters describing what this node would address.",
      },
      reason: {
        type: "string",
        description:
          "One sentence (English, for system logs) explaining why this deserves its own node rather than being handled in the current conversation.",
      },
    },
    required: ["title", "one_liner", "reason"],
  },
} as const

type Sibling = { title: string; one_liner: string }

function formatSiblings(siblings: Sibling[]): string {
  if (!siblings || siblings.length === 0) return "(No siblings.)"
  return siblings.map((s) => `- "${s.title}": ${s.one_liner}`).join("\n")
}

function buildLeafSystemPrompt(args: {
  goal: string
  nodeTitle: string
  nodeOneLiner: string
  siblings: Sibling[]
}): string {
  return LEAF_SYSTEM_PROMPT.replace("{{ node_title }}", args.nodeTitle)
    .replace("{{ node_one_liner }}", args.nodeOneLiner)
    .replace("{{ user_goal }}", args.goal)
    .replace("{{ ancestors_summary_chain }}", ANCESTORS_TOP_LEVEL)
    .replace("{{ siblings_metadata }}", formatSiblings(args.siblings))
    .replace("{{ user_notes_block }}", "")
}

function lastAssistantText(messages: MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== "assistant") continue
    if (typeof m.content === "string") return m.content
    if (Array.isArray(m.content)) {
      return m.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
    }
  }
  return ""
}

/** Split text into ~6-word chunks so the client renders it progressively. */
function chunkText(text: string): string[] {
  const parts = text.split(/(\s+)/)
  const chunks: string[] = []
  let buf = ""
  let words = 0
  for (const p of parts) {
    buf += p
    if (/\S/.test(p)) words++
    if (words >= 6) {
      chunks.push(buf)
      buf = ""
      words = 0
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

export async function POST(request: Request): Promise<Response> {
  let body: {
    goal?: string
    nodeTitle?: string
    nodeOneLiner?: string
    siblings?: Sibling[]
    messages?: MessageParam[]
    runId?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const goal = typeof body.goal === "string" ? body.goal : ""
  const nodeTitle = typeof body.nodeTitle === "string" ? body.nodeTitle : ""
  const nodeOneLiner = typeof body.nodeOneLiner === "string" ? body.nodeOneLiner : ""
  const siblings = Array.isArray(body.siblings) ? body.siblings : []
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (!goal || !nodeTitle || messages.length === 0) {
    return Response.json(
      { error: "goal, nodeTitle and a non-empty messages[] are required" },
      { status: 400 },
    )
  }

  const systemPrompt = buildLeafSystemPrompt({ goal, nodeTitle, nodeOneLiner, siblings })
  const runId = body.runId || `web-leaf-${crypto.randomUUID()}`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      let closed = false
      const send = (obj: unknown) => {
        if (closed) return
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"))
      }

      // Wrap the real Tavily handler so we emit a real-time indicator while the
      // search is actually in flight. runReActLoop awaits this, so the
      // search_start event reaches the browser before Tavily returns.
      const webSearchWrapped = async (input: unknown) => {
        const query =
          input && typeof input === "object" && "query" in input
            ? String((input as { query: unknown }).query)
            : ""
        send({ type: "search_start", query })
        const result = await tavilyHandler(input)
        send({ type: "search_end", ok: !result.is_error })
        return result
      }

      const proposeHandler = async (input: unknown) => {
        const p = (input ?? {}) as { title?: string; one_liner?: string; reason?: string }
        send({
          type: "proposal",
          title: p.title ?? "",
          one_liner: p.one_liner ?? "",
          reason: p.reason ?? "",
        })
        // Acknowledge so the model continues cleanly; the USER decides in the UI.
        return {
          is_error: false,
          content: "Noted — this proposal has been surfaced to the user, who will decide whether to create it.",
        }
      }

      try {
        const result = await runReActLoop({
          systemPrompt,
          initialMessages: messages,
          tools: [
            tavilySearchTool as unknown as Anthropic.Messages.Tool,
            proposeNewNodeTool as unknown as Anthropic.Messages.Tool,
          ],
          toolHandlers: { web_search: webSearchWrapped, propose_new_node: proposeHandler },
          model: MODEL,
          maxIterations: 10,
          cacheSystem: true,
          runId,
          agentType: "leaf",
        })

        for (const chunk of chunkText(lastAssistantText(result.finalMessages))) {
          send({ type: "text_delta", text: chunk })
        }
        send({
          type: "done",
          finalMessages: result.finalMessages,
          stopReason: result.finalStopReason,
        })
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        closed = true
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  })
}
