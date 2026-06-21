/**
 * Node intro generator prompt + schema-enforcing tool.
 * Source of truth: docs/prompts.md §4 (verbatim — do not paraphrase).
 *
 * Prefetched at node creation time: generates the first-impression content
 * (2–3 sentence tutor intro + exactly 3 starter questions). The one_liner is
 * already set by the root outline (§1.3) and is NOT regenerated here.
 */

import type Anthropic from "@anthropic-ai/sdk"

export type NodeIntro = {
  intro: string
  starter_questions: string[]
}

export const NODE_INTRO_PROMPT = `You are generating the first-impression content for a newly created mind-map node. When the user first opens this node, they will see:
1. The one-liner (already set)
2. The intro you write here (2–3 sentences, tutor voice)
3. Three starter questions you propose

Your job is to make the user's first second in this node feel like "I know where to click" instead of "what should I ask?"

# Context

Node title: {{ node_title }}
Node one-liner: {{ node_one_liner }}

The user's overall goal:
{{ user_goal }}

Where this node sits (chain from root to parent):
{{ ancestors_summary_chain }}

Sibling nodes (don't overlap with their territory):
{{ siblings_metadata }}

# What to generate

## Intro (2–3 sentences)

A tutor's opening line for this node. Like the first thing a thoughtful TA would say when you sit down to ask about this topic.

Rules:
- 2–3 sentences. Not a paragraph essay. Not one terse sentence.
- Tutor voice — warm, direct, no corporate phrasing. No "Welcome to this node!". No "Let's explore...".
- No markdown headers, no bullet points, no bold/italic emphasis.
- Frame what this node is about and why it might matter for this user given their goal. Reference the goal if it sharpens the framing, but don't shoehorn.
- Match the user's language (use the language of \`user_goal\` and the chain).

## Starter questions (exactly 3)

Three questions the user might want to ask in this node. These appear as tappable starters.

Rules:
- **Exactly 3 questions.** Not 2, not 4.
- Each question is concrete and actionable — the user should be able to imagine the answer shape. "How does X work?" is fine. "Tell me about X" is not (too vague).
- Strictly in-scope for THIS node. If a question belongs to a sibling, do not include it. Check sibling list before finalizing.
- Different angles: ideally one question for each of {what / why / how} OR {concept / application / edge case} OR similar — three questions that approach the topic from different cognitive stances, not three rephrasings of the same question.
- User's language. Natural phrasing.
- No question should be answerable from just the one-liner. They should require actual engagement.

Submit via the \`submit_node_intro\` tool. No prose.`

export const submitNodeIntroTool: Anthropic.Messages.Tool = {
  name: "submit_node_intro",
  description: "Submit the node's intro and three starter questions. Must be called exactly once.",
  // strict tool use: additionalProperties:false required, minItems/maxItems
  // dropped. The "exactly 3" count + non-empty intro are enforced client-side
  // in node-intro.ts (mirrors summary.ts / root.ts). Field names/descriptions
  // unchanged from prompts.md §4.
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intro: {
        type: "string",
        description: "2–3 sentence tutor-voice intro in user's language. No markdown.",
      },
      starter_questions: {
        type: "array",
        items: { type: "string" },
        description: "Exactly 3 in-scope, distinct, actionable questions in user's language.",
      },
    },
    required: ["intro", "starter_questions"],
  },
}
