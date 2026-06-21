/**
 * Node intro generator (prompts.md §4). One forced structured call producing the
 * node's first-impression content: a 2–3 sentence tutor intro + exactly 3
 * starter questions. Prefetched at node-creation time by the W3 web layer.
 *
 * Follows the exact pattern of summary.ts / runStructuredCall: strict tool use
 * with a client-side validate callback (strict mode drops minItems/maxItems, so
 * the "exactly 3 questions" + non-empty intro constraints are enforced here +
 * retried once). Opus 4.8.
 */

import { runStructuredCall } from "../lib/structured-call"
import { NODE_INTRO_PROMPT, submitNodeIntroTool, type NodeIntro } from "../prompts/node-intro"

export type { NodeIntro }

const MODEL = "claude-opus-4-8"

// Empty-state literals (prompts.md "Implementation Notes" — the model handles a
// descriptive placeholder better than a blank). v1 outline nodes are all
// top-level, so ancestors defaults to this and siblings is the other nodes.
const ANCESTORS_TOP_LEVEL = "(This node is at the top level of the tree. No ancestors.)"
const NO_SIBLINGS = "(No siblings.)"

export async function runNodeIntro(args: {
  nodeTitle: string
  nodeOneLiner: string
  userGoal: string
  ancestorsSummaryChain?: string
  siblingsMetadata?: string
  runId: string
}): Promise<NodeIntro> {
  const systemPrompt = NODE_INTRO_PROMPT
    .replace("{{ node_title }}", args.nodeTitle)
    .replace("{{ node_one_liner }}", args.nodeOneLiner)
    .replace("{{ user_goal }}", args.userGoal)
    .replace("{{ ancestors_summary_chain }}", args.ancestorsSummaryChain?.trim() || ANCESTORS_TOP_LEVEL)
    .replace("{{ siblings_metadata }}", args.siblingsMetadata?.trim() || NO_SIBLINGS)

  const { data } = await runStructuredCall<NodeIntro>({
    systemPrompt,
    messages: [{ role: "user", content: "Generate the node intro and starter questions." }],
    tool: submitNodeIntroTool,
    toolName: "submit_node_intro",
    model: MODEL,
    agentType: "node_intro",
    runId: args.runId,
    // strict mode can't enforce the exact count — validate client-side + retry.
    validate: (d) => {
      if (typeof d.intro !== "string" || d.intro.trim() === "") return "intro must be non-empty"
      if (!Array.isArray(d.starter_questions) || d.starter_questions.length !== 3) {
        return `expected exactly 3 starter_questions, got ${d.starter_questions?.length}`
      }
      if (d.starter_questions.some((q) => typeof q !== "string" || q.trim() === "")) {
        return "starter_questions must all be non-empty"
      }
      return null
    },
  })
  return data
}
