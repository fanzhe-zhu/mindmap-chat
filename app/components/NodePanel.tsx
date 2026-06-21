"use client"

/**
 * Node conversation panel. Step 4: header + the node opening experience
 * (one-liner + intro + 3 starter questions — dogfood insight #3). Step 5 adds
 * the streaming leaf conversation, search indicator, summary-on-exit, and
 * propose_new_node accept-UI.
 */

import type { Dispatch, SetStateAction } from "react"
import { nodeStatus, type ClientNode, type ClientTree } from "../lib/types"

export default function NodePanel({
  node,
  onClose,
}: {
  tree: ClientTree
  node: ClientNode
  onClose: () => void
  setTree: Dispatch<SetStateAction<ClientTree | null>>
  prefetchIntros: (t: ClientTree, only?: string[]) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 17 }}>{node.title}</strong>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge ${nodeStatus(node)}`}>{nodeStatus(node)}</span>
          <span className="muted">{node.one_liner}</span>
        </div>
      </div>

      <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
        {node.intro ? (
          <>
            <p style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>{node.intro.intro}</p>
            <p className="muted" style={{ marginBottom: 8 }}>Try asking:</p>
            <div className="options">
              {node.intro.starter_questions.map((q, i) => (
                <div className="option" key={i}>{q}</div>
              ))}
            </div>
          </>
        ) : (
          <p className="spinner">Preparing this node</p>
        )}
      </div>
    </div>
  )
}
