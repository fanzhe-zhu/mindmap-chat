"use client"

/**
 * Step 1 — minimal client app proving the server/client boundary:
 *   goal → POST /api/root/clarify → render the real clarifying questions.
 *
 * This file holds NO agent / SDK import — it only fetches the route handler.
 * It is expanded into the full 3-phase onboarding + mind map in later steps.
 */

import { useState } from "react"
import { fetchClarify } from "../lib/api"
import type { ClarifyOutput } from "../lib/types"

export default function App() {
  const [goal, setGoal] = useState("")
  const [loading, setLoading] = useState(false)
  const [clarify, setClarify] = useState<ClarifyOutput | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!goal.trim()) return
    setLoading(true)
    setError(null)
    setClarify(null)
    try {
      setClarify(await fetchClarify(goal.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Mind Map Chat</h1>
      <p style={{ marginBottom: 24 }}>
        What do you want to learn or do?
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. I want to prepare for an AIPM interview"
          style={{ flex: 1, padding: "10px 12px", fontSize: 16, border: "1px solid #171717", borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 16px", fontSize: 16, border: "1px solid #171717", borderRadius: 6, background: "#171717", color: "#fff", cursor: "pointer" }}
        >
          {loading ? "Thinking…" : "Start"}
        </button>
      </form>

      {error && (
        <p style={{ marginTop: 16, color: "#b00020" }}>Error: {error}</p>
      )}

      {clarify && (
        <section style={{ marginTop: 32 }}>
          {clarify.framing && <p style={{ marginBottom: 16, fontStyle: "italic" }}>{clarify.framing}</p>}
          {clarify.questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <p style={{ fontWeight: 600 }}>{q.question}</p>
              {q.answer_format === "multi_choice" && (
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {q.options.map((o, j) => (
                    <li key={j}>{o}</li>
                  ))}
                </ul>
              )}
              {q.answer_format === "free_text" && (
                <p style={{ marginTop: 8, color: "#444" }}>(free-text answer)</p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
