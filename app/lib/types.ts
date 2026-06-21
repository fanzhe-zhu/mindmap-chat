/**
 * Client-safe plain types for the W3 web layer.
 *
 * IMPORTANT (hard constraint #1): this file is imported by "use client"
 * components, so it must NEVER import the Anthropic SDK, fs, or anything under
 * src/agents|lib|tools that pulls those in. These types mirror the backend
 * shapes (src/prompts/root.ts, src/agents/summary.ts, src/agents/node-intro.ts)
 * but are declared independently to keep the client bundle free of server code.
 */

export type AnswerFormat = "multi_choice" | "free_text"

export type ClarifyQuestion = {
  question: string
  answer_format: AnswerFormat
  options: string[]
}

export type ClarifyOutput = {
  framing: string
  questions: ClarifyQuestion[]
}

export type OutlineNode = {
  title: string
  one_liner: string
}

export type OutlineOutput = {
  rationale: string
  nodes: OutlineNode[]
}

export type NodeIntro = {
  intro: string
  starter_questions: string[]
}

export type SummaryStatus = "mastered" | "partial" | "confused"

export type SummaryForParent = {
  topic: string
  key_takeaways: string[]
  status: SummaryStatus
  open_questions: string[]
}

/**
 * Anthropic MessageParam, stored opaquely as JSON. We never construct these by
 * hand on the client beyond the initial {role:"user", content:string} turn —
 * the leaf route returns the full finalMessages array and we round-trip it back
 * on the next turn, exactly as scripts/w2-cli.ts threads `messages`.
 */
export type ChatMessage = {
  role: "user" | "assistant"
  content: unknown
}

export type NodeProposal = {
  title: string
  one_liner: string
  reason: string
}

export type NodeOrigin = "outline" | "manual" | "proposal"

export type ClientNode = {
  id: string
  title: string
  one_liner: string
  messages: ChatMessage[]
  summary: SummaryForParent | null
  intro: NodeIntro | null
  origin: NodeOrigin
}

export type ClientTree = {
  id: string
  goal: string
  created_at: string
  confirmed_understanding: string
  nodes: Record<string, ClientNode>
  node_order: string[]
}

/** Status badge derived from a node's state (used by the React Flow node). */
export function nodeStatus(node: ClientNode): "summary" | "in-progress" | "untouched" {
  if (node.summary) return "summary"
  if (node.messages.length > 0) return "in-progress"
  return "untouched"
}

/** Extract readable text from a ChatMessage's content (string or block array). */
export function extractText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: "text"; text: string } =>
        !!b && typeof b === "object" && (b as { type?: string }).type === "text",
      )
      .map((b) => b.text)
      .join("")
  }
  return ""
}
