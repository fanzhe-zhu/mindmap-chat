// goals.ts
// 10 root-agent goals (answer keys) + 4 personalization pairs.
// Mirrors eval-goals.md (LOCKED 2026-05-26). Edit the .md and this file together.

import type { Goal, PersonalizationPair } from "./eval-types";

export const goals: Goal[] = [
  {
    id: 1,
    goal: "Understand the core ideas behind RLHF",
    type: "concept",
    tests: "Whether it can break an abstract training paradigm into a coherent chain of concepts",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Why RLHF is needed — why pretraining / next-token prediction isn't aligned enough", tier: "core" },
      { text: "Human preference data collection (pairwise comparison / preference data)", tier: "core" },
      { text: "Reward model training", tier: "core" },
      { text: "RL fine-tuning stage (PPO or similar, pushing the policy toward high reward)", tier: "core" },
      { text: "KL penalty / preventing reward hacking / preventing drifting too far from the base model", tier: "core" },
      { text: "Limitations and alternatives (DPO / RLAIF / Constitutional AI)", tier: "bonus" },
    ],
    coverageRule:
      "6 subtopics. 1-5 are core (missing any one is a heavy penalty); 6 is a bonus (a good outline includes a \"limitations/alternatives\" node).",
  },
  {
    id: 2,
    goal: "How Transformers work",
    type: "concept",
    tests: "A multi-layered structural concept; whether the outline has a reasonable surface-to-depth ordering",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Tokenization + embedding (how input becomes vectors)", tier: "bonus" },
      { text: "Positional encoding (why it's needed + how it's done)", tier: "bonus" },
      { text: "Self-attention (Q/K/V mechanism)", tier: "core" },
      { text: "Multi-head attention", tier: "core" },
      { text: "Feed-forward layers + residual connections + layer norm", tier: "core" },
      { text: "Encoder vs decoder architecture variants", tier: "bonus" },
      { text: "Why it replaced RNNs (parallelization / long-range dependencies)", tier: "bonus" },
    ],
    coverageRule:
      "7 total. 3-5 are absolutely core (attention is the soul of the Transformer; missing it scores low immediately). 1/2/6/7 are structural completeness; missing 1-2 is acceptable.",
  },
  {
    id: 3,
    goal: "Learn to use PostgreSQL",
    type: "skill",
    tests: "A skill-type goal — the answer key should lean toward \"what you can do\" rather than \"what you understand\"",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Installation / connection / basic psql operations", tier: "core" },
      { text: "Data types + table creation / schema design", tier: "core" },
      { text: "CRUD (SELECT / INSERT / UPDATE / DELETE)", tier: "core" },
      { text: "JOIN + relational modeling", tier: "core" },
      { text: "Indexes + query performance basics", tier: "core" },
      { text: "Transactions / ACID", tier: "core" },
      { text: "Backup / permission management", tier: "bonus" },
    ],
    coverageRule:
      "7 total. 1-6 core. For skill-type goals, coverage also depends on whether node titles are imperative / actionable in style; laying them out as pure noun concepts is a smell — note it manually; it doesn't count toward the coverage score, but goes into personalization/quality observation.",
  },
  {
    id: 4,
    goal: "How to do good user research",
    type: "skill",
    tests: "A soft skill — the answer key doesn't have a standard TOC like technical topics, so tolerance should be a bit higher",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Defining research goals / asking the right research question", tier: "core" },
      { text: "Choosing methods (qualitative vs quantitative; interviews / surveys / usability testing)", tier: "core" },
      { text: "Recruiting / sampling (finding the right people)", tier: "core" },
      { text: "Interviewing and questioning techniques (avoiding leading questions, follow-ups)", tier: "core" },
      { text: "Analysis / synthesis (raw data → insight, affinity mapping, etc.)", tier: "core" },
      { text: "Turning insights into actionable conclusions / influencing decisions", tier: "core" },
      { text: "Common biases (confirmation bias, leading bias)", tier: "bonus" },
    ],
    coverageRule:
      "7 total. Soft topics allow the outline to slice differently — using a different framework but substantively covering these points counts as coverage. Judge \"substantive coverage,\" not \"literal matching.\"",
  },
  {
    id: 5,
    goal: "What to prepare when transitioning from SWE to AIPM",
    type: "skill",
    tests: "Your own use case — the answer key is calibrated. 2/3/4 core, 1/5/6 bonus.",
    coverageMode: "subtopic",
    subtopics: [
      { text: "How AIPM responsibilities differ from traditional PM / SWE (what's actually different)", tier: "bonus" },
      { text: "Skills to build up (eval, prompt engineering, understanding agent systems, data intuition)", tier: "core" },
      { text: "Portfolio (how to prove ability through projects)", tier: "core" },
      { text: "Interview prep (case, product sense, technical-depth questions)", tier: "core" },
      { text: "Leveraging the differentiated advantage of an SWE background", tier: "bonus" },
      { text: "Target companies / market awareness (what kinds of companies are hiring, differences in requirements)", tier: "bonus" },
    ],
    coverageRule:
      "6 subtopics. 2/3/4 are absolutely core; missing any scores low. 1/5/6 are bonuses. Coverage % is computed against the total of 6 (standalone node = 1, passing mention = 0.5).",
  },
  {
    id: 6,
    goal: "Write a PRD for my side project",
    type: "project",
    tests: "A project-type goal — first check whether clarify asks what the project is; coverage evaluates the completeness of the PRD skeleton, not the domain content",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Problem statement / background (why build it)", tier: "core" },
      { text: "Target users + core use cases", tier: "core" },
      { text: "Goals / success metrics", tier: "core" },
      { text: "Functional requirements / scope (MVP vs later)", tier: "core" },
      { text: "Non-functional requirements (performance / security / privacy, etc.)", tier: "core" },
      { text: "Out of scope (explicit out of scope)", tier: "core" },
      { text: "Milestones / timeline", tier: "core" },
    ],
    coverageRule:
      "7 total (PRD structural dimensions). Precondition check: root should first clarify \"what your side project is\" before generating — skipping clarify and laying out a generic PRD template, even with full coverage, must be penalized on the personalization dimension (violates §11).",
  },
  {
    id: 7,
    goal: "How to choose between RAG and fine-tuning",
    type: "comparison",
    tests: "A comparison-type goal — the answer key emphasizes decision dimensions, rather than degenerating into two concept nodes of \"what is RAG + what is fine-tuning\"",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Quick overview of both mechanisms (brief is enough; shouldn't dominate)", tier: "bonus" },
      { text: "Decision dimension: data freshness / dynamism", tier: "core" },
      { text: "Decision dimension: cost (training vs retrieval infra)", tier: "core" },
      { text: "Decision dimension: task type (knowledge injection vs behavior/style change)", tier: "core" },
      { text: "Decision dimension: data volume / quality threshold", tier: "core" },
      { text: "Hybrid approach (combining both)", tier: "bonus" },
      { text: "Practical decision framework / decision tree", tier: "core" },
    ],
    coverageRule:
      "7 total. Comparison-specific smell: if half the outline's nodes cover \"RAG internals\" and half cover \"fine-tuning internals,\" with no cross-cutting decision-dimension nodes — coverage scores low. The nodes of a good comparison outline are \"dimensions,\" not \"each of the two compared things expanded separately.\"",
  },
  {
    id: 8,
    goal: "I want to learn about AI",
    type: "vague",
    tests: "A vague goal — tests whether clarify works. This one doesn't score subtopic coverage (without narrowing, any fixed list is wrong).",
    coverageMode: "clarify",
    subtopics: [],
    coverageRule:
      "Binary judgment: did clarify ask about scope/depth/purpose (pass), or skip clarify and directly generate a generic syllabus (fail). Whether the narrowed outline matches the clarify answer is a second-layer observation (goes into personalization). Expectation: do not directly lay out a generic outline of \"AI history / machine learning / deep learning / applications.\"",
  },
  {
    id: 9,
    goal: "Learn machine learning",
    type: "vague",
    tests: "A too-large goal — tests how root handles an oversized scope: granularity doesn't explode + top-level structure is reasonable. It may clarify or give a reasonably layered top-level structure.",
    coverageMode: "granularity",
    subtopics: [
      { text: "Math / statistics foundations", tier: "core" },
      { text: "Supervised learning (regression / classification)", tier: "core" },
      { text: "Unsupervised learning", tier: "core" },
      { text: "Model evaluation / validation", tier: "core" },
      { text: "Feature engineering / data processing", tier: "core" },
      { text: "Practice / tools (scikit-learn, etc.)", tier: "core" },
      { text: "Deep learning (extension entry point)", tier: "bonus" },
    ],
    coverageRule:
      "Primarily tests granularity (node count shouldn't explode into 20+ detail nodes). Covering the 6-7 top-level domains above counts as pass; laying out a bunch of same-level detail nodes like linear regression / logistic regression / SVM / KNN / decision tree = top-level abstraction failure, scores low. This is also the stress-test sample for the granularity regression metric.",
  },
  {
    id: 10,
    goal: "I've already built an LLM app and want to understand agents",
    type: "concept",
    tests: "Personalization test (vs a blank-slate user) — whether the outline skips the basics the user already knows (what an LLM is, how to call an API) and goes straight into agent-specific content.",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Agent vs single LLM call (loop / autonomy / ReAct)", tier: "core" },
      { text: "Tool use / function calling (user knows the basics → should go deeper: error handling, parallel calls)", tier: "core" },
      { text: "Planning / multi-step reasoning", tier: "core" },
      { text: "Memory / state management", tier: "core" },
      { text: "Multi-agent orchestration", tier: "core" },
      { text: "Agent eval / reliability / failure modes", tier: "core" },
      { text: "The capability gap from \"can call an API\" to \"can orchestrate agents\"", tier: "bonus" },
    ],
    coverageRule:
      "7 total. 1-6 all core. Personalization precondition check: if the outline contains nodes like \"what is an LLM/API/prompt\" = personalization failure (didn't leverage the \"already built an LLM app\" info); even with high technical coverage, personalization scores low.",
  },
];

/**
 * Personalization pairs (§14). Human binary judgment: are the two outlines
 * clearly different? P-4 tests framing adaptation only — both sides still cover
 * goal #10's 1-6 core subtopics; the coverage answer key does NOT change.
 */
export const personalizationPairs: PersonalizationPair[] = [
  {
    id: "P-1",
    goalId: 5,
    clarifyA: "I'm a senior SWE with backend experience",
    clarifyB: "I'm a new grad and can only write scripts",
    expectation:
      "Outlines substantively differ: the senior version emphasizes differentiated advantages/portfolio; the new-grad version emphasizes building fundamentals.",
  },
  {
    id: "P-2",
    goalId: 10,
    clarifyA: "I've built an LLM app (#10 original)",
    clarifyB: "I know nothing about AI and want to learn about agents",
    expectation: "#10 skips LLM basics; the blank-slate version must start from the basics.",
  },
  {
    id: "P-3",
    goalId: 8,
    clarifyA: "I'm a doctor and want to use it for diagnosis",
    clarifyB: "I'm a student looking to switch careers",
    expectation: "The narrowing directions are completely different.",
  },
  {
    id: "P-4",
    goalId: 10,
    clarifyA: "Want to understand agents from theory",
    clarifyB: "Want to learn by taking apart a real agent (e.g., Claude Code)",
    expectation:
      "Covers the same 6 core concepts, but the framing clearly differs: A is abstract concept nodes; B wraps the same concepts into a concrete system (\"how Claude Code does tool use / planning\"). Tests framing adaptation, doesn't change the coverage answer key.",
  },
];
