/**
 * Root phase 3 (outline) route handler. Returns the 5–9 node outline
 * (OutlineOutput). The client turns it into a Tree via app/lib/tree.ts.
 * Server-only.
 */

import { runRootPhase3Outline } from "@/src/agents/root"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const userGoal = typeof body?.userGoal === "string" ? body.userGoal.trim() : ""
    const clarifyExchange = typeof body?.clarifyExchange === "string" ? body.clarifyExchange : ""
    const confirmedUnderstanding =
      typeof body?.confirmedUnderstanding === "string" ? body.confirmedUnderstanding : ""
    if (!userGoal) {
      return Response.json({ error: "userGoal is required" }, { status: 400 })
    }
    const data = await runRootPhase3Outline({
      userGoal,
      clarifyExchange,
      confirmedUnderstanding,
      runId: `web-outline-${crypto.randomUUID()}`,
    })
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
