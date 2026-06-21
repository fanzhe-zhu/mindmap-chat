/**
 * Client-side Tree helpers — the browser counterpart to src/lib/tree.ts.
 *
 * src/lib/tree.ts imports fs/promises (server-only), so it cannot be used in the
 * client. This mirrors its shape (ClientTree in ./types) with immutable updates
 * suitable for React state. v1 keeps the flat single-level shape: every node is
 * a top-level child of root. Accepted proposals and manually-created nodes are
 * added as additional top-level nodes (true parent/child placement is a v2 item
 * — the Tree shape has no parent pointer, and modifying src/lib/tree.ts is out
 * of scope for W3).
 */

import type {
  ClientNode,
  ClientTree,
  NodeIntro,
  NodeOrigin,
  OutlineNode,
  SummaryForParent,
  ChatMessage,
} from "./types"

export function createTree(
  goal: string,
  confirmedUnderstanding: string,
  outlineNodes: OutlineNode[],
): ClientTree {
  const nodes: Record<string, ClientNode> = {}
  const node_order: string[] = []
  outlineNodes.forEach((n, i) => {
    const id = `node_${i + 1}`
    nodes[id] = {
      id,
      title: n.title,
      one_liner: n.one_liner,
      messages: [],
      summary: null,
      intro: null,
      origin: "outline",
    }
    node_order.push(id)
  })
  const createdAt = new Date().toISOString()
  return {
    id: `tree_${createdAt.replace(/[:.]/g, "-")}`,
    goal,
    created_at: createdAt,
    confirmed_understanding: confirmedUnderstanding,
    nodes,
    node_order,
  }
}

/** Add a node (manual creation or accepted proposal). Returns the new tree + id. */
export function addNode(
  tree: ClientTree,
  fields: { title: string; one_liner: string; origin: NodeOrigin },
): { tree: ClientTree; id: string } {
  const id = `node_${crypto.randomUUID().slice(0, 8)}`
  const node: ClientNode = {
    id,
    title: fields.title,
    one_liner: fields.one_liner,
    messages: [],
    summary: null,
    intro: null,
    origin: fields.origin,
  }
  return {
    id,
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [id]: node },
      node_order: [...tree.node_order, id],
    },
  }
}

function patchNode(tree: ClientTree, nodeId: string, patch: Partial<ClientNode>): ClientTree {
  const node = tree.nodes[nodeId]
  if (!node) return tree
  return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, ...patch } } }
}

export function setNodeMessages(tree: ClientTree, nodeId: string, messages: ChatMessage[]): ClientTree {
  return patchNode(tree, nodeId, { messages })
}

export function setNodeSummary(tree: ClientTree, nodeId: string, summary: SummaryForParent): ClientTree {
  return patchNode(tree, nodeId, { summary })
}

export function setNodeIntro(tree: ClientTree, nodeId: string, intro: NodeIntro): ClientTree {
  return patchNode(tree, nodeId, { intro })
}

/** Sibling metadata = every OTHER node (matches scripts/w2-cli.ts buildLeafSystemPrompt). */
export function siblingsOf(tree: ClientTree, nodeId: string): OutlineNode[] {
  return tree.node_order
    .filter((id) => id !== nodeId)
    .map((id) => ({ title: tree.nodes[id].title, one_liner: tree.nodes[id].one_liner }))
}
