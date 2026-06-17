# P2 — Cost Model

> **Date**: 2026-05-19
> **Companion**: `prompts.md`, `P3-react-loop-pseudocode.md`, `P4-tools-and-infra.md`
> **Update protocol**: After W1 ship, plug in real token measurements from trace files and recompute.

---

## 1. Pricing reference (May 2026)

**Claude Opus 4.7**:
- Input: $5.00 / MTok
- Output: $25.00 / MTok
- Cache write (5-min TTL): $6.25 / MTok (1.25x input)
- Cache read: $0.50 / MTok (0.10x input)

**Tavily**:
- Free tier: 1,000 credits/month
- Basic search: 1 credit = $0.008 (after free quota)

---

## 2. Operation-level costs

### Op A: Root phase 1 (clarify)

| | tokens | $ |
|---|---|---|
| Input (system prompt + user goal) | ~400 | $0.0020 |
| Output (1-2 questions + options) | ~150 | $0.0038 |
| **Total** | | **$0.0058** |

### Op B: Root phase 2 (confirm)

| | tokens | $ |
|---|---|---|
| Input (system + goal + Q&A) | ~600 | $0.0030 |
| Output (summary + ask for confirmation) | ~200 | $0.0050 |
| **Total** | | **$0.0080** |

If user corrects, this op runs again. Assume 30% probability of correction → effective average **$0.0080 × 1.3 = $0.0104**.

### Op C: Root phase 3 (outline)

| | tokens | $ |
|---|---|---|
| Input (system + goal + Q&A + confirmed understanding) | ~800 | $0.0040 |
| Output (rationale + 5-9 nodes × {title, one_liner}) | ~500 | $0.0125 |
| **Total** | | **$0.0165** |

### Op D: Node intro generation (one per node, prefetched)

| | tokens | $ |
|---|---|---|
| Input (system + node title + one_liner + ancestors chain + siblings) | ~700 | $0.0035 |
| Output (intro + 3 starter questions) | ~200 | $0.0050 |
| **Total per node** | | **$0.0085** |

For a 7-node outline (median outline size), intro generation total = **7 × $0.0085 = $0.0595**.

### Op E: Single root agent run = generating a complete mind map

= A + B + C + (D × N nodes)

For median 7-node outline:

| Component | $ |
|---|---|
| Phase 1 clarify | $0.0058 |
| Phase 2 confirm (with 30% correction rate) | $0.0104 |
| Phase 3 outline | $0.0165 |
| 7 × node intro prefetch | $0.0595 |
| **Total: 1 root agent run** | **$0.0922 ≈ $0.09** |

**Rounded: ~$0.10 per mind map generation.**

### Op F: Single leaf agent turn (one ReAct iteration set)

This is for **one user message → one model response**, possibly with 1-2 tool calls.

| | tokens | $ |
|---|---|---|
| Turn 1 of node (cache write on system) | | |
| → Cache write | 1800 | $0.01125 |
| → Other input (user msg + tools) | 200 | $0.0010 |
| → Output (response with maybe tool calls) | 500 | $0.0125 |
| **Subtotal turn 1** | | **$0.0248** |
| | | |
| Turn 2-5 of node (cache read) | | |
| → Cache read | 1800 | $0.0009 |
| → Other input (growing message history avg) | 1200 | $0.0060 |
| → Output | 500 | $0.0125 |
| **Subtotal per turn 2-N** | | **$0.0194** |

**Plus web search** (Tavily): assume average 1 search per turn after free quota = $0.008/search.

### Op G: Average leaf conversation (1 full node session)

Assume 5 turns per node, 2 of those involve a tool call:

| | $ |
|---|---|
| Turn 1 (with cache write) | $0.0248 |
| Turns 2-5 (4 × $0.0194) | $0.0776 |
| Web searches: 2 × $0.008 (after free quota; **$0 during free**) | $0.0160 |
| **Total per node session (Opus + paid Tavily)** | **$0.1184 ≈ $0.12** |

### Op H: Summary regeneration (triggered at end_turn)

| | tokens | $ |
|---|---|---|
| Input (full node messages + node metadata) | ~2500 | $0.0125 |
| Output (4-field structured summary) | ~200 | $0.0050 |
| **Total** | | **$0.0175 ≈ $0.02** |

### Cost-per-action summary

| Action | $ | Note |
|---|---|---|
| Generate mind map (1 root run, ~7 nodes) | $0.10 | One-time per goal |
| Engage one node (5-turn conversation) | $0.12 | Per node session |
| Summary regen after conversation | $0.02 | Auto per node |
| **Total "fully engage one node"** | **$0.14** | conversation + summary |

---

## 3. Dogfood scenarios (per your numbers)

### Scenario A: Dev phase (10 root runs/day)

This is generating 10 mind maps/day. **You said this doesn't include leaf chat** — so this is pure outline generation, no engagement.

| Per day | $ |
|---|---|
| 10 root agent runs × $0.10 | $1.00 |
| **Total/day** | **$1.00** |
| **Total/week** (7 days) | **$7.00** |
| **Total over 3-week sprint** | **$21.00** |

Realistic note: you probably won't generate maps 7 days/week. If 5 days × 3 weeks = 15 active days, sprint total **≈ $15**.

### Scenario B: Medium dogfood (20-30 root runs/day)

Take midpoint 25/day. **Still pure root generation per your spec.**

| Per day | $ |
|---|---|
| 25 root agent runs × $0.10 | $2.50 |
| **Total/day** | **$2.50** |
| **Total/week** | **$17.50** |
| **Total over 3 weeks (15 active days)** | **$37.50** |

### Scenario C: Heavy dogfood (50+/day)

Take 60/day.

| Per day | $ |
|---|---|
| 60 root agent runs × $0.10 | $6.00 |
| **Total/day** | **$6.00** |
| **Total/week** | **$42.00** |
| **Total over 3 weeks (15 active days)** | **$90.00** |

### But: leaf engagement is the bigger lever

The numbers above are **only** root generation per your spec. In reality, you'll engage some nodes. If you generate 10 maps/day and engage 3 nodes per map (median):

| Per day | $ |
|---|---|
| 10 root runs × $0.10 | $1.00 |
| 30 node engagements × $0.14 (conversation + summary) | $4.20 |
| **Total/day** | **$5.20** |
| **Total/week** | $36.40 |
| **Total over 3 weeks (15 active days)** | **$78.00** |

If you engage 7 nodes per map (full engagement):

| Per day | $ |
|---|---|
| 10 root runs × $0.10 | $1.00 |
| 70 node engagements × $0.14 | $9.80 |
| **Total/day** | **$10.80** |
| **Total/week** | $75.60 |
| **Total over 3 weeks (15 active days)** | **$162** |

---

## 4. Eval costs (W1/W2/W3 baselines)

Per `design-doc-v1.md` §16: 10 root goals × 3 runs + 20 leaf scenarios.

### Per full eval pass

| | $ |
|---|---|
| 10 goals × 3 runs × $0.10 (root) | $3.00 |
| 20 leaf scenarios × $0.12 + summary $0.02 | $2.80 |
| **One full eval pass** | **$5.80 ≈ $6** |

### Across the sprint

- W1 leaf baseline: 20 scenarios × $0.12 = $2.40
- W2 full baseline: $6
- W3 final eval: $6
- + ~5 prompt iteration mini-evals during W3 × $2 each = $10
- **Total eval cost over sprint: ~$25**

---

## 5. Sprint total

Combining your stated dogfood level + likely leaf engagement + eval:

| Dogfood level (per your spec) | Pure root runs | + leaf engagement (3 nodes avg) | + eval | **3-week total** |
|---|---|---|---|---|
| **Dev phase (10/day)** | $15 | $78 | $25 | **~$103** |
| **Medium (25/day)** | $37.50 | $94 | $25 | **~$157** |
| **Heavy (60/day)** | $90 | $147 | $25 | **~$262** |

**Realistic estimate**: you'll likely be **dev phase early sprint, ramping to medium late sprint as the product works**. Expect **$120-180 total for the 3-week sprint**.

---

## 6. Cost levers if you need to cut

In rough order of pain-vs-savings:

| Lever | Saves | Pain |
|---|---|---|
| **Move summary + intro generators to Haiku 4.5** (P4 §4) | ~$0.04/map + $0.01/node session = ~30% leaf cost | Low — eval in W2 first |
| **Reduce intro prefetch from all 7 nodes to 3** (only generate intro for nodes user clicks first) | $0.04/map | Medium — degrades first-impression UX, but recoverable |
| **Don't regenerate summary on every end_turn**, only when user explicitly closes node | ~$0.02/node session | Low — summary stale until user closes, but for v1 this is fine |
| **Cut Phase 2 confirm correction loop** to 0% (force user to accept first summary) | $0.002/map | Low impact, modest user trust hit |
| **Smaller outline** (5 nodes vs 7) | $0.017/map (intros) | Medium — outline quality matters |
| **Stop using Tavily, use Anthropic native web_search** | $0.008/search → $0.01/search, **but you keep free tier longer** | High — loses portfolio narrative (see P4 §1) |

**My recommendation**: don't preemptively optimize. Run W1 with the budget I gave, watch real spend in the trace files. Only cut if you actually hit $200+ before W3 ship.

---

## 7. Budget caps (recommended)

Set monitoring at:

- **Single root agent run > $0.25** → alert (something pathological in outline generation)
- **Single leaf conversation > $0.50** → alert (loop didn't terminate properly, or ridiculous tool use)
- **Daily spend > $15** → alert (you've drifted into heavy dogfood without realizing)
- **Weekly spend > $60** → think hard about cuts

Implementation: simple sum in your trace logger. Console warn when threshold crossed, don't block.

---

## 8. Critical caveats

1. **All numbers are estimates.** Real Opus 4.7 calls on your actual prompts might use 30% more or less tokens than my guesses. **After W1 ship, recompute from real trace data.**

2. **The 35% Opus 4.7 tokenizer overhead is already baked into my estimates** — I padded the token counts vs what Opus 4.6 would have used. If Anthropic releases Opus 4.8 with a tighter tokenizer, recompute.

3. **Tool calls inflate output tokens.** My "500 output tokens per turn" assumes ~2 tool calls. If your leaf prompt produces longer reasoning text, the output cost climbs faster than the input.

4. **Cache misses if you change system prompt mid-conversation.** If you're iterating prompts during W1-W3 and re-running the same node, you'll see cache write costs on every turn. Don't panic — this is dev cost, not user cost.

5. **First $5 of Tavily is free** (1k credits/month). You probably won't exceed it in W1+W2 CLI work. W3 web app dogfood might.

---

## 9. TL;DR

- **Budget for $150-200 over the 3-week sprint** if you do medium dogfood + leaf engagement + eval.
- **Worst case: ~$260** if you go heavy on dogfood.
- **Per single mind map = $0.10. Per fully engaged node = $0.14.** Cheap enough that you should not hold back on iteration.
- **Set $15/day alert** as your "did I lose my mind" tripwire.
- **After W1 ship, recompute from real trace numbers** before W2 starts.
