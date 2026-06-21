/**
 * Root phase 1 (clarify) route handler.
 *
 * Server-only: imports the Anthropic-backed agent. The ANTHROPIC_API_KEY is read
 * lazily inside the agent's client and never crosses to the browser (hard
 * constraint #1). Next.js loads .env.local into the server runtime automatically,
 * so no dotenv is needed here (unlike the CLI scripts).
 */

import { runRootPhase1Clarify } from "@/src/agents/root"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const userGoal = typeof body?.userGoal === "string" ? body.userGoal.trim() : ""
    if (!userGoal) {
      return Response.json({ error: "userGoal is required" }, { status: 400 })
    }
    const data = await runRootPhase1Clarify({
      userGoal,
      runId: `web-clarify-${crypto.randomUUID()}`,
    })
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
