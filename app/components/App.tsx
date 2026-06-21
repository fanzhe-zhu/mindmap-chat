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
import { createTree } from "../lib/tree"
import { nodeStatus, type ClientTree } from "../lib/types"

export default function App() {
  const [tree, setTree] = useState<ClientTree | null>(null)

  function onOnboardingComplete(r: OnboardingResult) {
    setTree(createTree(r.goal, r.confirmedUnderstanding, r.outline.nodes))
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
