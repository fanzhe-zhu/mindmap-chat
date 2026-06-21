/**
 * Node intro batch route handler. Prefetches intros + starter questions for a
 * set of nodes (prompts.md §4 / tracking P5: "Prefetched at node creation
 * time"). Called when the outline lands so every node has a cached intro before
 * the user clicks anything; also called for a single manually-created / accepted
 * node. Server-only.
 *
 * Body: { goal: string, nodes: { id, title, one_liner }[], only?: string[] }
 * Returns: { intros: Record<nodeId, { intro, starter_questions }> }
 *
 * `nodes` is always the full sibling set (for context); `only`, when present,
 * restricts generation to those ids (used when adding a single node so we don't
 * regenerate every intro). Sibling metadata for each node = every OTHER node,
 * formatted exactly like the leaf prompt's {{ siblings_metadata }}
 * (scripts/w2-cli.ts).
 */

import { runNodeIntro } from "@/src/agents/node-intro"

type InNode = { id: string; title: string; one_liner: string }

function formatSiblings(siblings: InNode[]): string {
  if (siblings.length === 0) return "(No siblings.)"
  return siblings.map((s) => `- "${s.title}": ${s.one_liner}`).join("\n")
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const goal = typeof body?.goal === "string" ? body.goal : ""
    const nodes: InNode[] = Array.isArray(body?.nodes) ? body.nodes : []
    const only: string[] | null = Array.isArray(body?.only) ? body.only : null
    if (!goal || nodes.length === 0) {
      return Response.json({ error: "goal and a non-empty nodes[] are required" }, { status: 400 })
    }
    const targets = only ? nodes.filter((n) => only.includes(n.id)) : nodes

    const results = await Promise.all(
      targets.map(async (node) => {
        const siblings = nodes.filter((n) => n.id !== node.id)
        const intro = await runNodeIntro({
          nodeTitle: node.title,
          nodeOneLiner: node.one_liner,
          userGoal: goal,
          siblingsMetadata: formatSiblings(siblings),
          runId: `web-intro-${node.id}-${crypto.randomUUID()}`,
        })
        return [node.id, intro] as const
      }),
    )

    return Response.json({ intros: Object.fromEntries(results) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
