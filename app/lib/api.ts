/**
 * Browser-side API client. Thin fetch wrappers around the server route handlers.
 * This is the ONLY way the client reaches the agents — no SDK in the bundle.
 */

import type { ClarifyOutput, OutlineOutput } from "./types"

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
