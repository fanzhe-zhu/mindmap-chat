"use client"

/**
 * Node conversation panel — the streaming leaf chat.
 *
 *  - Opening experience (dogfood insight #3): before the first message, shows
 *    the intro + 3 starter questions as tappable starters.
 *  - Streaming (W3): each turn hits the /api/leaf NDJSON stream. A real-time
 *    "searching the web…" indicator shows while a Tavily tool_use is in flight;
 *    assistant text renders progressively from text_delta chunks.
 *  - propose_new_node: proposals surface as an accept-in-UI affordance.
 *  - Summary on exit (prompts.md §3): when the user leaves the node and the
 *    conversation changed, runSummaryGenerator regenerates the summary and the
 *    node's badge updates.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { fetchSummary, streamLeaf } from "../lib/api"
import { setNodeMessages, setNodeSummary, siblingsOf } from "../lib/tree"
import {
  extractText,
  nodeStatus,
  type ChatMessage,
  type ClientNode,
  type ClientTree,
} from "../lib/types"

type Proposal = { title: string; one_liner: string; reason: string }

export default function NodePanel({
  tree,
  node,
  onClose,
  setTree,
  onAcceptProposal,
}: {
  tree: ClientTree
  node: ClientNode
  onClose: () => void
  setTree: Dispatch<SetStateAction<ClientTree | null>>
  onAcceptProposal: (title: string, oneLiner: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(node.messages)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [pending, setPending] = useState("")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  // For summary-on-exit: latest messages + whether they changed this session.
  const messagesRef = useRef(messages)
  const dirtyRef = useRef(false)
  messagesRef.current = messages

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pending, searchQuery, proposals])

  // Summary on node exit (unmount = close OR switch nodes). Fires only if the
  // conversation changed. Runs after unmount; setTree still resolves into App.
  useEffect(() => {
    const nodeId = node.id
    const title = node.title
    const oneLiner = node.one_liner
    return () => {
      if (!dirtyRef.current) return
      fetchSummary(title, oneLiner, messagesRef.current)
        .then((summary) => setTree((cur) => (cur ? setNodeSummary(cur, nodeId, summary) : cur)))
        .catch((err) => console.error("summary generation failed:", err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setInput("")
    setError(null)
    setProposals([])
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages(next)
    setStreaming(true)
    setPending("")

    try {
      await streamLeaf(
        {
          goal: tree.goal,
          nodeTitle: node.title,
          nodeOneLiner: node.one_liner,
          siblings: siblingsOf(tree, node.id),
          messages: next,
        },
        (e) => {
          switch (e.type) {
            case "search_start":
              setSearchQuery(e.query || "")
              break
            case "search_end":
              setSearchQuery(null)
              break
            case "text_delta":
              setPending((p) => p + e.text)
              break
            case "proposal":
              setProposals((ps) => [...ps, { title: e.title, one_liner: e.one_liner, reason: e.reason }])
              break
            case "done": {
              const final = e.finalMessages
              setMessages(final)
              dirtyRef.current = true
              setTree((cur) => (cur ? setNodeMessages(cur, node.id, final) : cur))
              break
            }
            case "error":
              setError(e.message)
              break
          }
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStreaming(false)
      setSearchQuery(null)
      setPending("")
    }
  }

  const visible = messages.filter((m) => extractText(m.content).trim() !== "")
  const hasConversation = visible.length > 0

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

      <div ref={scrollRef} style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        {/* opening experience */}
        {!hasConversation && (
          <div style={{ marginBottom: 8 }}>
            {node.intro ? (
              <>
                <p style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}>{node.intro.intro}</p>
                <p className="muted" style={{ marginBottom: 8 }}>Try asking:</p>
                <div className="options">
                  {node.intro.starter_questions.map((q, i) => (
                    <button className="option" key={i} disabled={streaming} onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="spinner">Preparing this node</p>
            )}
          </div>
        )}

        {/* conversation */}
        <div className="chat">
          {visible.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{extractText(m.content)}</div>
          ))}
          {pending && <div className="msg assistant">{pending}</div>}
          {searchQuery !== null && (
            <div className="search-indicator">
              <span className="spinner" />
              <span>searching the web{searchQuery ? `: “${searchQuery}”` : "…"}</span>
            </div>
          )}
          {streaming && !pending && searchQuery === null && (
            <div className="search-indicator"><span className="spinner" /><span>thinking…</span></div>
          )}
          {proposals.map((p, i) => (
            <div className="proposal" key={i}>
              <div className="ptitle">Proposed new node: {p.title}</div>
              <div className="muted">{p.one_liner}</div>
              <div className="row">
                <button
                  className="btn small primary"
                  onClick={() => {
                    onAcceptProposal(p.title, p.one_liner)
                    setProposals((ps) => ps.filter((_, j) => j !== i))
                  }}
                >
                  Add to map
                </button>
                <button className="btn small" onClick={() => setProposals((ps) => ps.filter((_, j) => j !== i))}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="error">Error: {error}</p>}
      </div>

      <form
        className="panel-input"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasConversation ? "Ask a follow-up…" : "Ask anything about this node…"}
          disabled={streaming}
        />
        <button className="btn primary" type="submit" disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  )
}
