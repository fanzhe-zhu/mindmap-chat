/**
 * Tavily web search tool, wrapped for Anthropic Messages API tool use.
 *
 * Decision (P4 §1): we write dispatch ourselves rather than use Anthropic's
 * native web_search_20260209. The portfolio value is in showing tool-dispatch
 * judgment ("did the model call when it should? were params valid?"), which
 * the native tool abstracts away.
 *
 * Default searchDepth: "basic" (1 credit, P4 §1).
 */

import { tavily } from "@tavily/core"

const client = tavily({ apiKey: process.env.TAVILY_API_KEY })

// Anthropic Messages API tool definition.
// `name` matches the dispatch key used in runReActLoop's toolHandlers map.
export const tavilySearchTool = {
  name: "web_search",
  description:
    "Search the web for current information. Returns up to 5 results with " +
    "title, URL, and content snippet. Use this when you need facts, news, " +
    "specific entities the user named, or anything time-sensitive that may " +
    "be beyond your training data. Do not use for general reasoning, " +
    "definitions of well-established concepts, or content the user can " +
    "verify themselves.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The search query. Be concise and specific — 3 to 10 keywords " +
          "usually work best. Avoid filler ('please', 'can you find').",
      },
    },
    required: ["query"],
  },
} as const

// Handler return shape matches what runReActLoop expects to marshal into
// a tool_result content block: { is_error, content: string }.
export async function tavilyHandler(
  input: unknown,
): Promise<{ is_error: boolean; content: string }> {
  // Validate shape — the model can produce malformed input even with a schema.
  // P4 §3: "LLM returns invalid tool call → return tool_result with is_error: true
  //         and the validation error message. Model retries naturally."
  if (!input || typeof input !== "object" || !("query" in input)) {
    return {
      is_error: true,
      content: "Invalid input: expected { query: string }.",
    }
  }
  const { query } = input as { query: unknown }
  if (typeof query !== "string" || query.trim().length === 0) {
    return {
      is_error: true,
      content: "Invalid input: 'query' must be a non-empty string.",
    }
  }

  try {
    const result = await client.search(query, {
      searchDepth: "basic",
      maxResults: 5,
    })

    if (!result.results || result.results.length === 0) {
      // P4 §3: surface as is_error so the model handles gracefully via
      // leaf prompt instruction #3 ("when a tool returns nothing useful,
      // say so. Do not fabricate").
      return {
        is_error: true,
        content: `Search returned no results for query: "${query}"`,
      }
    }

    // Format as plain text — easier for the model to read than raw JSON,
    // and roughly token-equivalent.
    const formatted = result.results
      .map(
        (r: any, i: number) =>
          `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`,
      )
      .join("\n\n---\n\n")

    return { is_error: false, content: formatted }
  } catch (err: any) {
    // Network errors, 429s, 5xx all funnel here. Retry logic lives in
    // runReActLoop's withRetry wrapper (Step 5), not here.
    return {
      is_error: true,
      content: `Search failed: ${err?.message ?? String(err)}`,
    }
  }
}
