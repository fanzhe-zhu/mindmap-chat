/**
 * Summary route — runs runSummaryGenerator on a node's conversation when the
 * user leaves the node (prompts.md §3 trigger: end_turn + messages changed).
 * Server-only.
 *
 * Body: { nodeTitle, nodeOneLiner, messages }
 * Returns: SummaryForParent ({ topic, key_takeaways[], status, open_questions[] })
 */

import type Anthropic from "@anthropic-ai/sdk"
import { runSummaryGenerator } from "@/src/agents/summary"

type MessageParam = Anthropic.Messages.MessageParam

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const nodeTitle = typeof body?.nodeTitle === "string" ? body.nodeTitle : ""
    const nodeOneLiner = typeof body?.nodeOneLiner === "string" ? body.nodeOneLiner : ""
    const messages: MessageParam[] = Array.isArray(body?.messages) ? body.messages : []
    if (!nodeTitle || messages.length === 0) {
      return Response.json({ error: "nodeTitle and a non-empty messages[] are required" }, { status: 400 })
    }
    const summary = await runSummaryGenerator({
      nodeTitle,
      nodeOneLiner,
      nodeMessages: messages,
      runId: `web-summary-${crypto.randomUUID()}`,
    })
    return Response.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
