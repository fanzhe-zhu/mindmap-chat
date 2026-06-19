/**
 * Summary generator (prompts.md §3). One forced structured call that turns a
 * leaf conversation into a 4-field summary_for_parent. Called by the CLI / eval
 * when a node conversation pauses (end_turn) and its messages changed.
 */

import type Anthropic from "@anthropic-ai/sdk"

import { runStructuredCall } from "../lib/structured-call"
import { SUMMARY_GENERATOR_PROMPT, submitSummaryForParentTool } from "../prompts/summary"

type MessageParam = Anthropic.Messages.MessageParam

const MODEL = "claude-opus-4-8"

export type SummaryForParent = {
  topic: string
  key_takeaways: string[]
  status: "mastered" | "partial" | "confused"
  open_questions: string[]
}

/**
 * Render the leaf conversation's MessageParam[] into readable text for the
 * {{ node_messages }} placeholder — user/assistant turns plus tool calls and
 * results (the summary prompt asks for "including tool calls/results").
 */
export function formatNodeMessages(messages: MessageParam[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const role = m.role === "user" ? "User" : "Assistant"
    if (typeof m.content === "string") {
      lines.push(`${role}: ${m.content}`)
      continue
    }
    for (const block of m.content) {
      if (block.type === "text") {
        lines.push(`${role}: ${block.text}`)
      } else if (block.type === "tool_use") {
        lines.push(`${role} [calls ${block.name}]: ${JSON.stringify(block.input)}`)
      } else if (block.type === "tool_result") {
        const c =
          typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content
                  .map((b) => (b.type === "text" ? b.text : `[${b.type}]`))
                  .join(" ")
              : ""
        lines.push(`Tool result${block.is_error ? " (error)" : ""}: ${c.slice(0, 600)}`)
      }
    }
  }
  return lines.join("\n\n")
}

export async function runSummaryGenerator(args: {
  nodeTitle: string
  nodeOneLiner: string
  nodeMessages: MessageParam[]
  runId: string
}): Promise<SummaryForParent> {
  const systemPrompt = SUMMARY_GENERATOR_PROMPT
    .replace("{{ node_title }}", args.nodeTitle)
    .replace("{{ node_one_liner }}", args.nodeOneLiner)
    .replace("{{ node_messages }}", formatNodeMessages(args.nodeMessages))

  const { data } = await runStructuredCall<SummaryForParent>({
    systemPrompt,
    messages: [{ role: "user", content: "Generate the structured summary." }],
    tool: submitSummaryForParentTool,
    toolName: "submit_summary_for_parent",
    model: MODEL,
    agentType: "summary_generator",
    runId: args.runId,
    // strict mode can't enforce minItems — require at least 1 takeaway.
    validate: (d) =>
      Array.isArray(d.key_takeaways) && d.key_takeaways.length >= 1
        ? null
        : `expected ≥1 key_takeaway, got ${d.key_takeaways?.length}`,
  })
  return data
}
