// eval-types.ts
// Shared types for the v1 eval test set.
// Source of truth (human-readable): eval-goals.md, eval-scenarios.md
// These are imported by goals.ts, scenarios.ts, and (in W1) eval-root.ts / eval-leaf.ts.
//
// LOCKED at end of W0. Do not add/remove fields during the v1 sprint without
// re-locking — the eval harness depends on this shape staying stable.

// ---------- Goals (root agent test set) ----------

export type GoalType = "concept" | "skill" | "comparison" | "project" | "vague";

/**
 * How coverage is scored for this goal:
 * - "subtopic"    → score against the subtopics[] answer key (most goals)
 * - "clarify"     → binary: did root agent clarify scope/depth/purpose instead of
 *                   dumping a generic syllabus? (goal #8) — subtopics[] is empty
 * - "granularity" → primarily a granularity regression probe; subtopics[] lists the
 *                   acceptable TOP-LEVEL domains, not fine-grained nodes (goal #9)
 */
export type CoverageMode = "subtopic" | "clarify" | "granularity";

export type SubtopicTier = "core" | "bonus";

export interface Subtopic {
  text: string;
  /** "core" = missing it hurts the score; "bonus" = nice to have */
  tier: SubtopicTier;
}

export interface Goal {
  id: number;
  /** The goal text the user would type. */
  goal: string;
  type: GoalType;
  /** What this goal is probing. */
  tests: string;
  coverageMode: CoverageMode;
  /** Answer key. Empty when coverageMode === "clarify". */
  subtopics: Subtopic[];
  /** Prose scoring rule — carries nuance the tier field can't. Read this when scoring. */
  coverageRule: string;
}

/**
 * Personalization test pair: same goal, two different clarify answers,
 * outlines should differ materially (P-1..P-3) or differ in framing (P-4).
 * Scored by human binary judgment ("are the two outlines clearly different?").
 */
export interface PersonalizationPair {
  id: string; // "P-1" ...
  goalId: number;
  clarifyA: string;
  clarifyB: string;
  expectation: string;
}

// ---------- Scenarios (leaf agent test set) ----------

export interface NodeRef {
  title: string;
  oneLiner: string;
}

export type ScenarioCategory =
  | "normal"
  | "sibling_awareness"
  | "off_topic"
  | "prompt_injection"
  | "refusal"
  | "clarify"
  | "tool_failure"
  | "multi_step";

export interface Scenario {
  id: string; // "S1" ...
  /** Which goal's tree this leaf sits in. */
  goalId: number;
  /** Tree label from the doc ("A" | "B" | "C" | "D"). */
  tree: string;
  /**
   * Root goal text. These scenarios are top-level nodes directly under root,
   * so the leaf's ancestors_summary_chain is effectively just this root framing.
   * The W1 harness formats this into the actual ancestor-chain injection.
   */
  rootGoal: string;
  /** The leaf agent under test. */
  node: NodeRef;
  /** Exactly 2 siblings injected into the leaf system prompt. */
  siblings: NodeRef[];
  userMessage: string;
  /** true = a good agent SHOULD call web_search; false = pure reasoning. */
  needsTool: boolean;
  /** Answer key: what a good response does. */
  expectedBehavior: string;
  /** Which §15 dimension this scenario mainly exercises. */
  primaryMetric: string;
  category: ScenarioCategory;
}
