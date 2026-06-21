/**
 * localStorage persistence for the single v1 Tree (P6: LocalStorageRoot_v1 =
 * { version, tree }). Client-only.
 *
 * ── P6 DECISION 1: quota strategy (5MB cap — what happens when full) ─────────
 * The in-memory tree is ALWAYS authoritative — a failed write never loses the
 * user's current session, and we never silently drop data. On a
 * QuotaExceededError we make ONE compaction attempt: strip the raw `messages`
 * transcript from any node that already has a `summary` (the summary + intro are
 * the durable, hard-to-regenerate artifacts; the raw transcript — which carries
 * full web-search tool_result text and dominates size — is the expendable part,
 * and the conversation's value is preserved in its summary). If the compacted
 * write succeeds the user gets a non-blocking notice that old transcripts were
 * trimmed; if it still fails they get a notice that recent changes aren't being
 * saved but remain in memory until the tab closes. No eviction of whole nodes,
 * no crash.
 *
 * ── P6 DECISION 2: schema version migration (v1 → v2) ────────────────────────
 * Stored payload carries an explicit numeric `version`. On load:
 *   - version === CURRENT_VERSION  → use as-is.
 *   - version  <  CURRENT_VERSION  → run the migrator chain (migrators[v] takes
 *                                    a vN payload to v(N+1)); each future schema
 *                                    change adds one migrator and bumps
 *                                    CURRENT_VERSION. v1 has no predecessors yet.
 *   - version  >  CURRENT_VERSION  → data was written by a NEWER build this code
 *                                    can't safely interpret → discard, start
 *                                    fresh (forward-compat; never guess).
 *   - missing / unparseable        → discard, start fresh.
 * To ship v2: define migrateV1toV2 in `migrators`, bump CURRENT_VERSION to 2.
 */

import type { ClientTree } from "./types"

const STORAGE_KEY = "mindmap-chat:root"
const CURRENT_VERSION = 1

type LocalStorageRoot = { version: number; tree: ClientTree | null }

export type SaveResult = { ok: boolean; warning?: string }

/** Migrators[n] upgrades a version-n payload to version n+1. Empty for v1. */
const migrators: Record<number, (root: LocalStorageRoot) => LocalStorageRoot> = {}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22
  )
}

/** Drop raw transcripts from nodes that already have a summary (compaction). */
function compact(tree: ClientTree): ClientTree {
  const nodes = Object.fromEntries(
    Object.entries(tree.nodes).map(([id, n]) => [
      id,
      n.summary ? { ...n, messages: [] } : n,
    ]),
  )
  return { ...tree, nodes }
}

function write(root: LocalStorageRoot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(root))
}

export function saveTree(tree: ClientTree): SaveResult {
  if (typeof window === "undefined") return { ok: false }
  const root: LocalStorageRoot = { version: CURRENT_VERSION, tree }
  try {
    write(root)
    return { ok: true }
  } catch (err) {
    if (!isQuotaError(err)) {
      return { ok: false, warning: "Couldn’t save to local storage; your work stays in this tab." }
    }
    // Quota: one compaction retry (P6 decision 1).
    try {
      write({ version: CURRENT_VERSION, tree: compact(tree) })
      return {
        ok: true,
        warning: "Storage was full — older conversation transcripts were trimmed to fit. Summaries are kept.",
      }
    } catch {
      return {
        ok: false,
        warning: "Storage is full — recent changes aren’t being saved. They stay in this tab until you close it.",
      }
    }
  }
}

export function loadTree(): ClientTree | null {
  if (typeof window === "undefined") return null
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let root: LocalStorageRoot
  try {
    root = JSON.parse(raw)
  } catch {
    return null // unparseable → start fresh
  }
  if (!root || typeof root.version !== "number") return null

  // version > current: written by a newer build → discard (P6 decision 2).
  if (root.version > CURRENT_VERSION) return null

  // version < current: run the migrator chain up to current.
  while (root.version < CURRENT_VERSION) {
    const migrate = migrators[root.version]
    if (!migrate) return null // no path → start fresh rather than guess
    root = migrate(root)
  }

  return root.tree ?? null
}

export function clearTree(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
