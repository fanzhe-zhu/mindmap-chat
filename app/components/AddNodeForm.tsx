"use client"

/**
 * Manual node creation (dogfood insight #5: "the user must be able to manually
 * create nodes — basic UX, not optional"). On submit, App adds a top-level node
 * and prefetches its intro.
 */

import { useState } from "react"

export default function AddNodeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, oneLiner: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [oneLiner, setOneLiner] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit(title.trim(), oneLiner.trim() || title.trim())
  }

  return (
    <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ fontSize: 18 }}>Add a node</h2>
      <label className="col" style={{ gap: 4 }}>
        <span className="muted">Title</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Prompt engineering basics"
          autoFocus
        />
      </label>
      <label className="col" style={{ gap: 4 }}>
        <span className="muted">One-liner (optional)</span>
        <input
          className="input"
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="What this node should answer"
        />
      </label>
      <div className="row">
        <button className="btn primary" type="submit" disabled={!title.trim()}>Add</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
