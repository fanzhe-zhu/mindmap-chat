/**
 * Token-pricing helpers. See P3 §"Token cost estimator helper" (L284-303)
 * and P4 §4 for current Anthropic pricing.
 */

export type TokenAccumulator = {
  input: number      // total input tokens (including cache reads/writes)
  output: number     // total output tokens
  cacheRead: number  // cache_read_input_tokens (charged at ~10% of in-price)
  cacheWrite: number // cache_creation_input_tokens (charged at 125% of in-price)
}

// Prices are per 1M tokens (MTok).
//
// Cross-checked against the Anthropic pricing table on 2026-06-17. Opus 4.8 and
// 4.7 share pricing ($5/$25 per MTok); Sonnet 4.6 $3/$15; Haiku 4.5 $1/$5.
// Cache-write = 1.25× input price (5-min ephemeral TTL), cache-read = 0.1× input
// price — derived rates below are the products, kept explicit so a future price
// change is a single-line edit. P4 §4 warns prices shift; these constants don't,
// so re-verify before ship. Opus 4.8 is the current default model.
const PRICES: Record<
  string,
  { in: number; out: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-opus-4-8": { in: 5.0, out: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-7": { in: 5.0, out: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { in: 1.0, out: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
}

export function estimateCost(tokens: TokenAccumulator, model: string): number {
  const p = PRICES[model] ?? PRICES["claude-opus-4-8"]

  // `tokens.input` is the grand total of input tokens; cache reads and writes
  // are billed at their own rates, so subtract them out to get the slice
  // charged at the full input price.
  const nonCacheInput = tokens.input - tokens.cacheRead - tokens.cacheWrite

  return (
    (nonCacheInput * p.in +
      tokens.cacheWrite * p.cacheWrite +
      tokens.cacheRead * p.cacheRead +
      tokens.output * p.out) /
    1_000_000
  )
}
