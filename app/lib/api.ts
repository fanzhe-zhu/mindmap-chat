/**
 * Browser-side API client. Thin fetch wrappers around the server route handlers.
 * This is the ONLY way the client reaches the agents — no SDK in the bundle.
 */

import type {
  ChatMessage,
  ClarifyOutput,
  NodeIntro,
  OutlineOutput,
  SummaryForParent,
} from "./types"

export type LeafEvent =
  | { type: "search_start"; query: string }
  | { type: "search_end"; ok: boolean }
  | { type: "text_delta"; text: string }
  | { type: "proposal"; title: string; one_liner: string; reason: string }
  | { type: "done"; finalMessages: ChatMessage[]; stopReason: string }
  | { type: "error"; message: string }

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = ""
    try {
      detail = (await res.json())?.error ?? ""
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${url} failed (${res.status})${detail ? `: ${detail}` : ""}`)
  }
  return res.json() as Promise<T>
}

export function fetchClarify(userGoal: string): Promise<ClarifyOutput> {
  return postJSON<ClarifyOutput>("/api/root/clarify", { userGoal })
}

export function fetchConfirm(userGoal: string, clarifyExchange: string): Promise<{ text: string }> {
  return postJSON<{ text: string }>("/api/root/confirm", { userGoal, clarifyExchange })
}

export function fetchOutline(
  userGoal: string,
  clarifyExchange: string,
  confirmedUnderstanding: string,
): Promise<OutlineOutput> {
  return postJSON<OutlineOutput>("/api/root/outline", {
    userGoal,
    clarifyExchange,
    confirmedUnderstanding,
  })
}

export function fetchSummary(
  nodeTitle: string,
  nodeOneLiner: string,
  messages: ChatMessage[],
): Promise<SummaryForParent> {
  return postJSON<SummaryForParent>("/api/summary", { nodeTitle, nodeOneLiner, messages })
}

/**
 * Stream a leaf turn. Sends the full message history (incl. the new user turn)
 * and invokes onEvent for each NDJSON event. Resolves when the stream closes.
 */
export async function streamLeaf(
  body: {
    goal: string
    nodeTitle: string
    nodeOneLiner: string
    siblings: { title: string; one_liner: string }[]
    messages: ChatMessage[]
  },
  onEvent: (e: LeafEvent) => void,
): Promise<void> {
  const res = await fetch("/api/leaf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    let detail = ""
    try {
      detail = (await res.json())?.error ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(`/api/leaf failed (${res.status})${detail ? `: ${detail}` : ""}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  const flushLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      onEvent(JSON.parse(trimmed) as LeafEvent)
    } catch {
      /* skip malformed line */
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf("\n")) >= 0) {
      flushLine(buf.slice(0, idx))
      buf = buf.slice(idx + 1)
    }
  }
  flushLine(buf)
}

/**
 * Batch-prefetch intros + starter questions. `nodes` is the full sibling set;
 * pass `only` to restrict generation to specific ids (e.g. one new node).
 */
export function fetchIntros(
  goal: string,
  nodes: { id: string; title: string; one_liner: string }[],
  only?: string[],
): Promise<{ intros: Record<string, NodeIntro> }> {
  return postJSON<{ intros: Record<string, NodeIntro> }>("/api/node-intro", { goal, nodes, only })
}
