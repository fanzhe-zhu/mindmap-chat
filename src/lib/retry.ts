/**
 * Retry helper for transient API failures. Used by runReActLoop for the
 * Anthropic API call.
 *
 * Per P4 §3: "Use it for Anthropic API calls and Tavily search calls.
 * Never for tool dispatch logic itself — those errors are deterministic,
 * retrying won't help."
 */

export type RetryOptions = {
  maxAttempts: number
  backoffMs: number[]                    // length should be maxAttempts - 1
  isRetriable: (err: unknown) => boolean
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  // Attempts are 1-indexed so the math reads like the P4 §3 table
  // (1s, 2s, 4s, max 3 attempts).
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      // Last attempt, or a deterministic/non-retriable error — give up and
      // let the caller handle it.
      if (attempt === opts.maxAttempts || !opts.isRetriable(err)) {
        throw err
      }
      // backoffMs has maxAttempts-1 entries; attempt-1 indexes the delay to
      // wait before the *next* attempt. Fall back to the last entry defensively.
      const ms = opts.backoffMs[attempt - 1] ?? opts.backoffMs[opts.backoffMs.length - 1] ?? 0
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`retry ${attempt}/${opts.maxAttempts} after ${ms}ms (${msg})`)
      await sleep(ms)
    }
  }

  // Unreachable: the loop either returns or throws on the final attempt.
  // Satisfies the type checker that all paths produce a T or throw.
  throw new Error("withRetry: exhausted attempts without returning")
}
