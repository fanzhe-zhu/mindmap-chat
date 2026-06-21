"use client"

/**
 * Root agent 3-phase onboarding, mirroring the scripts/w2-cli.ts state machine.
 * The CALLER owns the state; this component drives:
 *   goal → phase 1 clarify (multi-choice / free-text) → phase 2 confirm (loops
 *   on correction, folding it into clarifyExchange) → phase 3 outline.
 * On completion it hands the finished outline + confirmed understanding up via
 * onComplete; App turns that into the Tree (and Step 3 prefetches intros).
 */

import { useState } from "react"
import { fetchClarify, fetchConfirm, fetchOutline } from "../lib/api"
import type { ClarifyOutput, OutlineOutput } from "../lib/types"

type Phase = "goal" | "clarify" | "confirm" | "outline"

export type OnboardingResult = {
  goal: string
  confirmedUnderstanding: string
  outline: OutlineOutput
}

const OTHER_RE = /other/i

export default function Onboarding({ onComplete }: { onComplete: (r: OnboardingResult) => void }) {
  const [phase, setPhase] = useState<Phase>("goal")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [goal, setGoal] = useState("")
  const [clarify, setClarify] = useState<ClarifyOutput | null>(null)
  // per-question answer state
  const [answers, setAnswers] = useState<string[]>([])
  const [otherOpen, setOtherOpen] = useState<boolean[]>([])

  const [clarifyExchange, setClarifyExchange] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [correction, setCorrection] = useState("")

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : String(err))
    setLoading(false)
  }

  // ── Phase: goal → clarify ──────────────────────────────────────────────
  async function submitGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!goal.trim()) return
    setLoading(true)
    setError(null)
    try {
      const c = await fetchClarify(goal.trim())
      setClarify(c)
      setAnswers(c.questions.map(() => ""))
      setOtherOpen(c.questions.map(() => false))
      setPhase("clarify")
      setLoading(false)
    } catch (err) {
      fail(err)
    }
  }

  function pickOption(qi: number, option: string) {
    const isOther = OTHER_RE.test(option)
    setOtherOpen((prev) => prev.map((v, i) => (i === qi ? isOther : v)))
    setAnswers((prev) => prev.map((v, i) => (i === qi ? (isOther ? "" : option) : v)))
  }

  function setAnswerText(qi: number, text: string) {
    setAnswers((prev) => prev.map((v, i) => (i === qi ? text : v)))
  }

  const allAnswered =
    clarify != null && answers.length === clarify.questions.length && answers.every((a) => a.trim() !== "")

  // ── Phase: clarify → confirm ───────────────────────────────────────────
  async function submitAnswers() {
    if (!clarify || !allAnswered) return
    const exchange = clarify.questions
      .map((q, i) => `Q: ${q.question}\nA: ${answers[i].trim()}`)
      .join("\n\n")
    setClarifyExchange(exchange)
    await runConfirm(exchange)
  }

  async function runConfirm(exchange: string) {
    setLoading(true)
    setError(null)
    setPhase("confirm")
    try {
      const { text } = await fetchConfirm(goal.trim(), exchange)
      setConfirmText(text)
      setLoading(false)
    } catch (err) {
      fail(err)
    }
  }

  // ── Phase: confirm loop ────────────────────────────────────────────────
  async function sendCorrection() {
    if (!correction.trim()) return
    const next = `${clarifyExchange}\n\nUser correction: ${correction.trim()}`
    setClarifyExchange(next)
    setCorrection("")
    await runConfirm(next)
  }

  // ── Phase: confirm → outline → done ────────────────────────────────────
  async function confirmAndOutline() {
    setLoading(true)
    setError(null)
    setPhase("outline")
    try {
      const outline = await fetchOutline(goal.trim(), clarifyExchange, confirmText)
      onComplete({ goal: goal.trim(), confirmedUnderstanding: confirmText, outline })
      // App swaps in the map view; no need to clear loading.
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div className="container">
      <h1 className="title">Mind Map Chat</h1>

      {phase === "goal" && (
        <>
          <p className="lead">What do you want to learn or do?</p>
          <form onSubmit={submitGoal} className="row">
            <input
              className="input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I want to prepare for an AIPM interview"
              autoFocus
            />
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Thinking" : "Start"}
            </button>
          </form>
        </>
      )}

      {phase === "clarify" && clarify && (
        <>
          {clarify.framing && <p className="framing">{clarify.framing}</p>}
          {clarify.questions.map((q, qi) => (
            <div className="qcard" key={qi}>
              <p className="qtext">{q.question}</p>
              {q.answer_format === "multi_choice" && q.options.length > 0 ? (
                <div className="options">
                  {q.options.map((opt, oi) => {
                    const isOther = OTHER_RE.test(opt)
                    const selected = isOther ? otherOpen[qi] : answers[qi] === opt
                    return (
                      <button
                        type="button"
                        key={oi}
                        className={`option${selected ? " selected" : ""}`}
                        onClick={() => pickOption(qi, opt)}
                      >
                        {opt}
                      </button>
                    )
                  })}
                  {otherOpen[qi] && (
                    <input
                      className="input"
                      placeholder="Type your answer"
                      value={answers[qi]}
                      onChange={(e) => setAnswerText(qi, e.target.value)}
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  placeholder="Your answer"
                  value={answers[qi]}
                  onChange={(e) => setAnswerText(qi, e.target.value)}
                />
              )}
            </div>
          ))}
          <button className="btn primary" onClick={submitAnswers} disabled={!allAnswered || loading}>
            {loading ? "Working" : "Continue"}
          </button>
        </>
      )}

      {phase === "confirm" && (
        <>
          <p className="muted" style={{ marginBottom: 8 }}>Here&apos;s my understanding of you:</p>
          {loading && !confirmText ? (
            <p className="spinner">Summarizing</p>
          ) : (
            <>
              <div className="card" style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>{confirmText}</div>
              <div className="col">
                <button className="btn primary" onClick={confirmAndOutline} disabled={loading}>
                  Looks right — sketch the outline
                </button>
                <textarea
                  className="textarea"
                  placeholder="Or correct me (what did I get wrong?)"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                />
                <button className="btn" onClick={sendCorrection} disabled={loading || !correction.trim()}>
                  Send correction
                </button>
              </div>
            </>
          )}
        </>
      )}

      {phase === "outline" && (
        <p className="spinner">Sketching your mind map</p>
      )}

      {error && <p className="error">Error: {error}</p>}
    </div>
  )
}
