/**
 * Root phase 2 (confirm) route handler — the one plain-text agent call.
 * The caller loops this with corrections folded into clarifyExchange until the
 * user confirms (mirrors scripts/w2-cli.ts phase 2). Server-only.
 */

import { runRootPhase2Confirm } from "@/src/agents/root"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const userGoal = typeof body?.userGoal === "string" ? body.userGoal.trim() : ""
    const clarifyExchange = typeof body?.clarifyExchange === "string" ? body.clarifyExchange : ""
    if (!userGoal) {
      return Response.json({ error: "userGoal is required" }, { status: 400 })
    }
    const data = await runRootPhase2Confirm({
      userGoal,
      clarifyExchange,
      runId: `web-confirm-${crypto.randomUUID()}`,
    })
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
