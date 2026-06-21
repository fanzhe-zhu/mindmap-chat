"use client"

/**
 * Top-level app + state machine. Holds the single ClientTree (P6: one tree in
 * v1). No agent/SDK import here — all model calls go through route handlers via
 * app/lib/api. Onboarding (3-phase root flow) runs until a Tree exists; after
 * that the mind map view takes over.
 *
 * Steps land incrementally: Step 2 shows the outline as a list; Step 4 swaps in
 * the React Flow map; Steps 5-6 add the conversation panel + persistence.
 */

import { useState } from "react"
import Onboarding, { type OnboardingResult } from "./Onboarding"
import { createTree, setNodeIntro } from "../lib/tree"
import { fetchIntros } from "../lib/api"
import { nodeStatus, type ClientTree } from "../lib/types"

export default function App() {
  const [tree, setTree] = useState<ClientTree | null>(null)

  /**
   * Prefetch intros for all nodes (dogfood insight #3, tracking P5). Fired as
   * soon as the tree exists so every node has a cached intro + 3 starters before
   * the user clicks in. Runs in the background; the map renders immediately and
   * intros merge in as they arrive. setTree((cur) => …) avoids clobbering any
   * edits the user makes while the batch is in flight.
   */
  function prefetchIntros(t: ClientTree) {
    const nodes = t.node_order.map((id) => ({
      id,
      title: t.nodes[id].title,
      one_liner: t.nodes[id].one_liner,
    }))
    fetchIntros(t.goal, nodes)
      .then(({ intros }) => {
        setTree((cur) => {
          if (!cur || cur.id !== t.id) return cur
          let next = cur
          for (const [id, intro] of Object.entries(intros)) {
            next = setNodeIntro(next, id, intro)
          }
          return next
        })
      })
      .catch((err) => console.error("intro prefetch failed:", err))
  }

  function onOnboardingComplete(r: OnboardingResult) {
    const t = createTree(r.goal, r.confirmedUnderstanding, r.outline.nodes)
    setTree(t)
    prefetchIntros(t)
  }

  if (!tree) {
    return <Onboarding onComplete={onOnboardingComplete} />
  }

  // Step 2 placeholder map view — replaced by React Flow in Step 4.
  return (
    <div className="container">
      <h1 className="title">{tree.goal}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>{tree.node_order.length} nodes</p>
      <div className="col" style={{ gap: 12 }}>
        {tree.node_order.map((id) => {
          const n = tree.nodes[id]
          return (
            <div className="card" key={id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{n.title}</strong>
                <span className={`badge ${nodeStatus(n)}`}>{nodeStatus(n)}</span>
              </div>
              <p style={{ marginTop: 6 }}>{n.one_liner}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
