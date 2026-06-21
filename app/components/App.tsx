"use client"

/**
 * Top-level app + state machine. Holds the single ClientTree (P6: one tree in
 * v1). No agent/SDK import here — all model calls go through route handlers via
 * app/lib/api. Onboarding (3-phase root flow) runs until a Tree exists; after
 * that the React Flow mind map + node conversation panel take over.
 *
 * Step 6 layers localStorage persistence on top of this state.
 */

import { useCallback, useState } from "react"
import Onboarding, { type OnboardingResult } from "./Onboarding"
import MindMap from "./MindMap"
import NodePanel from "./NodePanel"
import AddNodeForm from "./AddNodeForm"
import { addNode, createTree, setNodeIntro } from "../lib/tree"
import { fetchIntros } from "../lib/api"
import type { ClientTree } from "../lib/types"

export default function App() {
  const [tree, setTree] = useState<ClientTree | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  /**
   * Prefetch intros (dogfood insight #3, tracking P5). `only` restricts which
   * nodes are generated (one new node) while still passing the full set as
   * sibling context. Runs in the background; intros merge in as they arrive.
   */
  const prefetchIntros = useCallback((t: ClientTree, only?: string[]) => {
    const nodes = t.node_order.map((id) => ({
      id,
      title: t.nodes[id].title,
      one_liner: t.nodes[id].one_liner,
    }))
    fetchIntros(t.goal, nodes, only)
      .then(({ intros }) => {
        setTree((cur) => {
          if (!cur || cur.id !== t.id) return cur
          let next = cur
          for (const [id, intro] of Object.entries(intros)) next = setNodeIntro(next, id, intro)
          return next
        })
      })
      .catch((err) => console.error("intro prefetch failed:", err))
  }, [])

  function onOnboardingComplete(r: OnboardingResult) {
    const t = createTree(r.goal, r.confirmedUnderstanding, r.outline.nodes)
    setTree(t)
    prefetchIntros(t)
  }

  function addManualNode(title: string, oneLiner: string) {
    if (!tree) return
    const { tree: t2, id } = addNode(tree, { title, one_liner: oneLiner, origin: "manual" })
    setTree(t2)
    setAdding(false)
    setSelectedId(id)
    prefetchIntros(t2, [id])
  }

  // Accept a propose_new_node proposal — adds it to the map (v1 flat tree) and
  // prefetches its intro. Keeps the current node selected (the user is mid-chat).
  function acceptProposal(title: string, oneLiner: string) {
    if (!tree) return
    const { tree: t2, id } = addNode(tree, { title, one_liner: oneLiner, origin: "proposal" })
    setTree(t2)
    prefetchIntros(t2, [id])
  }

  if (!tree) {
    return <Onboarding onComplete={onOnboardingComplete} />
  }

  const selectedNode = selectedId ? tree.nodes[selectedId] : null

  return (
    <div className="app-shell">
      <div className="map-area">
        <MindMap
          tree={tree}
          selectedNodeId={selectedId}
          onSelect={(id) => {
            setAdding(false)
            setSelectedId(id)
          }}
          onAddNode={() => {
            setSelectedId(null)
            setAdding(true)
          }}
        />
      </div>

      {adding && (
        <aside className="side-panel">
          <AddNodeForm onCancel={() => setAdding(false)} onSubmit={addManualNode} />
        </aside>
      )}

      {!adding && selectedNode && (
        <aside className="side-panel">
          <NodePanel
            key={selectedNode.id}
            tree={tree}
            node={selectedNode}
            onClose={() => setSelectedId(null)}
            setTree={setTree}
            onAcceptProposal={acceptProposal}
          />
        </aside>
      )}
    </div>
  )
}
