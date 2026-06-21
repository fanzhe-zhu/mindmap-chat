"use client"

/**
 * React Flow mind map. Renders the flat outline as root → N child nodes
 * (v1 single-level tree). Custom node shows title + truncated one-liner + a
 * status badge (summary / in-progress / untouched). Clicking a topic node
 * selects it (App opens the conversation panel). Default-ish styling per the
 * W3 pre-decision ("do not sink time into CSS").
 *
 * Node positions are derived deterministically from index; node dragging is
 * disabled (drag persistence is not a v1 concern). The viewport pans/zooms and
 * fitView frames the whole tree.
 */

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Panel,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { nodeStatus, type ClientTree } from "../lib/types"

type TopicData = {
  label: string
  oneLiner: string
  status: "summary" | "in-progress" | "untouched"
  hasIntro: boolean
}
type RootData = { label: string }

function RootNode({ data }: NodeProps) {
  const d = data as RootData
  return (
    <div className="mm-node mm-root">
      <strong>{d.label}</strong>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </div>
  )
}

function TopicNode({ data, selected }: NodeProps) {
  const d = data as TopicData
  return (
    <div className={`mm-node mm-topic${selected ? " mm-selected" : ""}`}>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div className="mm-node-head">
        <span className="mm-node-title">{d.label}</span>
        <span className={`badge ${d.status}`}>{d.status}</span>
      </div>
      <div className="mm-node-oneliner">{d.oneLiner}</div>
      {!d.hasIntro && <div className="mm-node-foot muted">preparing…</div>}
    </div>
  )
}

const nodeTypes = { root: RootNode, topic: TopicNode }

const SPACING_X = 250
const CHILD_Y = 220

export default function MindMap({
  tree,
  selectedNodeId,
  onSelect,
  onAddNode,
  onReset,
}: {
  tree: ClientTree
  selectedNodeId: string | null
  onSelect: (nodeId: string) => void
  onAddNode: () => void
  onReset: () => void
}) {
  const { nodes, edges } = useMemo(() => {
    const ids = tree.node_order
    const n = ids.length
    const rootX = ((n - 1) * SPACING_X) / 2
    const rfNodes: RFNode[] = [
      {
        id: "root",
        type: "root",
        position: { x: rootX, y: 0 },
        data: { label: tree.goal } satisfies RootData,
        draggable: false,
      },
    ]
    const rfEdges: RFEdge[] = []
    ids.forEach((id, i) => {
      const node = tree.nodes[id]
      rfNodes.push({
        id,
        type: "topic",
        position: { x: i * SPACING_X, y: CHILD_Y },
        selected: id === selectedNodeId,
        draggable: false,
        data: {
          label: node.title,
          oneLiner: node.one_liner,
          status: nodeStatus(node),
          hasIntro: node.intro != null,
        } satisfies TopicData,
      })
      rfEdges.push({ id: `e-root-${id}`, source: "root", target: id })
    })
    return { nodes: rfNodes, edges: rfEdges }
  }, [tree, selectedNodeId])

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.id !== "root") onSelect(node.id)
        }}
        nodesDraggable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <div className="row">
            <button className="btn small" onClick={onAddNode}>+ Add node</button>
            <button className="btn small" onClick={onReset}>New map</button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
