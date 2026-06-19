/**
 * In-memory Tree for v1 — a single tree, one flat level of nodes under root
 * (the outline is flat). Shape mirrors docs/tracking.md P6. No localStorage —
 * that's W3. Serialized to JSON on quit for manual inspection.
 */

import type Anthropic from "@anthropic-ai/sdk"
import { mkdir, writeFile } from "fs/promises"
import { dirname } from "path"

import type { SummaryForParent } from "../agents/summary"
import type { OutlineNode } from "../prompts/root"

type MessageParam = Anthropic.Messages.MessageParam

export type Node = {
  id: string
  title: string
  one_liner: string
  messages: MessageParam[] // leaf conversation history
  summary: SummaryForParent | null
}

export type Tree = {
  id: string
  goal: string
  created_at: string
  confirmed_understanding: string
  nodes: Record<string, Node> // keyed by node id
  node_order: string[] // preserves outline order for numbered display
}

/** Build a fresh tree from the root agent's confirmed understanding + outline. */
export function createTree(
  goal: string,
  confirmedUnderstanding: string,
  outlineNodes: OutlineNode[],
): Tree {
  const nodes: Record<string, Node> = {}
  const node_order: string[] = []
  outlineNodes.forEach((n, i) => {
    const id = `node_${i + 1}` // stable, ordered
    nodes[id] = { id, title: n.title, one_liner: n.one_liner, messages: [], summary: null }
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

export function getNode(tree: Tree, nodeId: string): Node | undefined {
  return tree.nodes[nodeId]
}

export function setNodeMessages(tree: Tree, nodeId: string, messages: MessageParam[]): void {
  const node = tree.nodes[nodeId]
  if (node) node.messages = messages
}

export function setNodeSummary(tree: Tree, nodeId: string, summary: SummaryForParent): void {
  const node = tree.nodes[nodeId]
  if (node) node.summary = summary
}

export function serializeTree(tree: Tree): string {
  return JSON.stringify(tree, null, 2)
}

export async function writeTree(tree: Tree, path: string): Promise<string> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serializeTree(tree))
  return path
}
