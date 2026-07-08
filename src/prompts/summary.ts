/**
 * Summary generator prompt + schema-enforcing tool.
 * Source of truth: docs/prompts.md §3 (verbatim — do not paraphrase).
 *
 * Triggered when a leaf conversation pauses (end_turn) and the node's messages
 * changed since the last summary. Forces the 4-field structured output.
 */

import type Anthropic from "@anthropic-ai/sdk"

export const SUMMARY_GENERATOR_PROMPT = `You are a summarization agent. A tutor conversation just paused inside one node of a mind map. Your job is to generate a structured summary of what happened, for use by the node's parent context and downstream agents.

The node:

Title: {{ node_title }}
One-liner: {{ node_one_liner }}

The conversation that just took place:

<conversation>
{{ node_messages }}
</conversation>

Your task:
Emit a structured summary via the \`submit_summary_for_parent\` tool. Four fields, all required.

Language rule: write \`topic\`, \`key_takeaways\`, and \`open_questions\` in the language the user's messages inside <conversation> are written in. If the user wrote in English, the summary is in English; if in Chinese, Chinese. Never use a language that does not appear in the conversation.

# Field guidance

**topic** (1 sentence): What this node's conversation actually ended up being about. Often this is just a slight refinement of the node title, but sometimes the conversation drifted; capture the actual content, not the intended content. Written in the conversation's language (see the language rule above).

**key_takeaways** (3–5 items): The substantive points the conversation established or clarified. Each takeaway is a complete sentence or short paragraph (not a fragment). Written in the conversation's language (see the language rule above). Things that count:
- A concept the user came to understand (state what they understand, not "user learned X")
- A decision or comparison the user made
- A factual point that was grounded via tool use
- A correction or refinement of an earlier understanding
Things that don't count:
- Pleasantries, greetings, sign-offs
- Process commentary ("agent searched the web")
- Things the agent said but the user didn't engage with

**status** (one of \`mastered\`, \`partial\`, \`confused\`): Your honest assessment of where the user is on this node's topic based on the conversation. Be honest — this field is used to flag where the user might need to come back. Definitions:
- \`mastered\`: The user demonstrated understanding (asked precise follow-ups, applied the concept, articulated it back accurately) OR completed the actionable task this node was about. The conversation reached a natural close with the user appearing settled.
- \`partial\`: The user got some of it but not all. They asked clarifying questions that landed, but there are visible gaps — concepts they didn't push on, parts they accepted without engagement, or they ended the conversation before fully working through something.
- \`confused\`: The user remained confused, asked the same kind of question multiple times without convergence, or expressed frustration. Also use this if the conversation never really got going (one short exchange that didn't resolve anything).

Default to \`partial\` when uncertain — \`mastered\` is a strong claim and should be justified by visible evidence in the conversation.

**open_questions** (0–N items): Specific questions or threads the user raised but the conversation didn't resolve. These may be:
- Questions the user explicitly asked that got deferred ("I'll come back to that later")
- Topics the user gestured at but didn't dig into
- Implications of what was discussed that the user seemed not to notice
Do NOT include:
- Questions the conversation fully answered
- Questions about sibling nodes' topics (those belong to siblings)
- Generic "what else is there?" filler

If there are no genuine open questions, return an empty array. Do not pad.

Output only via the tool call. No prose.`

export const submitSummaryForParentTool: Anthropic.Messages.Tool = {
  name: "submit_summary_for_parent",
  description: "Submit the structured summary of this node's conversation. Must be called exactly once.",
  // strict tool use: additionalProperties:false required, minItems/maxItems
  // dropped. The ≥1 key_takeaway floor is enforced client-side in summary.ts.
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      topic: {
        type: "string",
        description: "One sentence (conversation's language) on what the conversation was about.",
      },
      key_takeaways: {
        type: "array",
        items: { type: "string" },
        description: "3–5 substantive takeaways (conversation's language). 1 allowed if conversation was very short, but flag in status.",
      },
      status: {
        type: "string",
        enum: ["mastered", "partial", "confused"],
        description: "Honest self-assessment of where the user landed.",
      },
      open_questions: {
        type: "array",
        items: { type: "string" },
        description: "0–N genuine unresolved questions/threads (conversation's language). Empty array if none.",
      },
    },
    required: ["topic", "key_takeaways", "status", "open_questions"],
  },
}
