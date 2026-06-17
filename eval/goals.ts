// goals.ts
// 10 root-agent goals (answer keys) + 4 personalization pairs.
// Mirrors eval-goals.md (LOCKED 2026-05-26). Edit the .md and this file together.

import type { Goal, PersonalizationPair } from "./eval-types";

export const goals: Goal[] = [
  {
    id: 1,
    goal: "理解 RLHF 的核心思想",
    type: "concept",
    tests: "能否把一个抽象训练范式拆成连贯的概念链",
    coverageMode: "subtopic",
    subtopics: [
      { text: "为什么需要 RLHF — pretraining / next-token prediction 为什么不够 aligned", tier: "core" },
      { text: "人类偏好数据收集(pairwise comparison / preference data)", tier: "core" },
      { text: "Reward model 训练", tier: "core" },
      { text: "RL 微调阶段(PPO 或类似,把 policy 推向高 reward)", tier: "core" },
      { text: "KL penalty / 防 reward hacking / 防偏离基座太远", tier: "core" },
      { text: "局限与替代(DPO / RLAIF / Constitutional AI)", tier: "bonus" },
    ],
    coverageRule:
      "6 个 subtopic。1-5 是核心(缺任一扣分重),6 是加分项(好的 outline 会带一个“局限/替代”节点)。",
  },
  {
    id: 2,
    goal: "Transformer 怎么工作",
    type: "concept",
    tests: "多层结构的概念,outline 是否有合理的由表及里顺序",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Tokenization + embedding(输入怎么变成向量)", tier: "bonus" },
      { text: "Positional encoding(为什么需要 + 怎么做)", tier: "bonus" },
      { text: "Self-attention(Q/K/V 机制)", tier: "core" },
      { text: "Multi-head attention", tier: "core" },
      { text: "Feed-forward 层 + 残差连接 + layer norm", tier: "core" },
      { text: "Encoder vs decoder 架构变体", tier: "bonus" },
      { text: "为什么取代 RNN(并行化 / 长程依赖)", tier: "bonus" },
    ],
    coverageRule:
      "7 个。3-5 是绝对核心(attention 是 Transformer 的灵魂,缺了直接判低)。1/2/6/7 是结构完整性,缺 1-2 个可接受。",
  },
  {
    id: 3,
    goal: "学会用 PostgreSQL",
    type: "skill",
    tests: "skill 类 goal —— 答案 key 应偏“能做什么”而非“理解什么”",
    coverageMode: "subtopic",
    subtopics: [
      { text: "安装 / 连接 / psql 基本操作", tier: "core" },
      { text: "数据类型 + 建表 / schema 设计", tier: "core" },
      { text: "CRUD(SELECT / INSERT / UPDATE / DELETE)", tier: "core" },
      { text: "JOIN + 关系建模", tier: "core" },
      { text: "索引 + 查询性能基础", tier: "core" },
      { text: "事务 / ACID", tier: "core" },
      { text: "备份 / 权限管理", tier: "bonus" },
    ],
    coverageRule:
      "7 个。1-6 核心。skill 类的 coverage 还要看节点标题是否 imperative / 可操作风格;铺成纯名词概念是 smell —— 人工记一笔,不进 coverage 分,进 personalization/质量观察。",
  },
  {
    id: 4,
    goal: "如何写好的 user research",
    type: "skill",
    tests: "soft skill —— 答案 key 不像技术 topic 那样有标准 TOC,容错率要高一点",
    coverageMode: "subtopic",
    subtopics: [
      { text: "定义研究目标 / 问对 research question", tier: "core" },
      { text: "选方法(定性 vs 定量;访谈 / 问卷 / 可用性测试)", tier: "core" },
      { text: "招募 / 抽样(找对的人)", tier: "core" },
      { text: "访谈与提问技巧(避免诱导性问题、追问)", tier: "core" },
      { text: "分析 / 综合(原始数据 → insight,affinity mapping 等)", tier: "core" },
      { text: "把 insight 转成可执行结论 / 影响决策", tier: "core" },
      { text: "常见偏差(确认偏差、引导偏差)", tier: "bonus" },
    ],
    coverageRule:
      "7 个。soft topic 容许 outline 用不同切法 —— 用了不同框架但实质覆盖了这些点,算覆盖。判的是“实质覆盖”不是“字面匹配”。",
  },
  {
    id: 5,
    goal: "从 SWE 转 AIPM 应该准备什么",
    type: "skill",
    tests: "你自己的 use case —— 答案 key 已校准。2/3/4 核心,1/5/6 加分。",
    coverageMode: "subtopic",
    subtopics: [
      { text: "AIPM 与传统 PM / SWE 的职责差异(到底不一样在哪)", tier: "bonus" },
      { text: "需要补的技能(eval、prompt engineering、agent 系统理解、数据直觉)", tier: "core" },
      { text: "作品集 / portfolio(怎么用项目证明能力)", tier: "core" },
      { text: "面试准备(case、product sense、技术深度问题)", tier: "core" },
      { text: "利用 SWE 背景的差异化优势", tier: "bonus" },
      { text: "目标公司 / 市场认知(哪类公司在招、要求差异)", tier: "bonus" },
    ],
    coverageRule:
      "6 个 subtopic。2/3/4 是绝对核心,缺任一判低。1/5/6 是加分项。覆盖 % 按 6 个总数算(独立节点=1,passing mention=0.5)。",
  },
  {
    id: 6,
    goal: "为我的 side project 写一份 PRD",
    type: "project",
    tests: "project 类 —— 先看 clarify 是否问出项目是什么,coverage 评的是 PRD 骨架完整度而非领域内容",
    coverageMode: "subtopic",
    subtopics: [
      { text: "问题陈述 / 背景(为什么做)", tier: "core" },
      { text: "目标用户 + 核心用例", tier: "core" },
      { text: "目标 / 成功指标(success metrics)", tier: "core" },
      { text: "功能需求 / scope(MVP vs later)", tier: "core" },
      { text: "非功能需求(性能 / 安全 / 隐私等)", tier: "core" },
      { text: "范围外(explicit out of scope)", tier: "core" },
      { text: "里程碑 / 时间线", tier: "core" },
    ],
    coverageRule:
      "7 个(PRD 结构维度)。前置检查:root 应先 clarify “你的 side project 是什么” 再生成 —— 跳过 clarify 直接铺通用 PRD 模板,coverage 即使满也要在 personalization 维度扣分(违反 §11)。",
  },
  {
    id: 7,
    goal: "RAG 和 fine-tuning 该怎么选",
    type: "comparison",
    tests: "comparison 类 —— 答案 key 强调决策维度,而非退化成“RAG 是什么 + fine-tuning 是什么”两个 concept 节点",
    coverageMode: "subtopic",
    subtopics: [
      { text: "两者机制速览(简述即可,不应占大头)", tier: "bonus" },
      { text: "决策维度:数据新鲜度 / 动态性", tier: "core" },
      { text: "决策维度:成本(训练 vs 检索 infra)", tier: "core" },
      { text: "决策维度:任务类型(知识注入 vs 行为/风格改变)", tier: "core" },
      { text: "决策维度:数据量 / 质量门槛", tier: "core" },
      { text: "混合方案(两者结合)", tier: "bonus" },
      { text: "实际决策框架 / decision tree", tier: "core" },
    ],
    coverageRule:
      "7 个。comparison 专属 smell:若 outline 一半节点讲“RAG 内部细节”、一半讲“fine-tuning 内部细节”,而没有 cross-cutting 的决策维度节点 —— coverage 判低。好的 comparison outline 的节点是“维度”,不是“两个被比的东西各自展开”。",
  },
  {
    id: 8,
    goal: "我想了解 AI",
    type: "vague",
    tests: "模糊 goal —— 测 clarify 是否起作用。这条不评 subtopic 覆盖(没收窄,任何固定清单都是错的)。",
    coverageMode: "clarify",
    subtopics: [],
    coverageRule:
      "二元判断:clarify 是否问到 scope/depth/purpose(pass)还是跳过 clarify 直接生成通用 syllabus(fail)。收窄后的 outline 是否匹配 clarify 答案,作为第二层观察(进 personalization)。期望:不直接铺“AI 历史/机器学习/深度学习/应用”的通用大纲。",
  },
  {
    id: 9,
    goal: "学会 machine learning",
    type: "vague",
    tests: "太大 goal —— 测 root 怎么处理过大 scope:granularity 不爆炸 + 顶层结构合理。可 clarify 或给分层合理的顶层结构。",
    coverageMode: "granularity",
    subtopics: [
      { text: "数学 / 统计基础", tier: "core" },
      { text: "监督学习(回归 / 分类)", tier: "core" },
      { text: "无监督学习", tier: "core" },
      { text: "模型评估 / 验证", tier: "core" },
      { text: "特征工程 / 数据处理", tier: "core" },
      { text: "实践 / 工具(scikit-learn 等)", tier: "core" },
      { text: "深度学习(延伸入口)", tier: "bonus" },
    ],
    coverageRule:
      "主测 granularity(node count 不应爆炸成 20+ 细节节点)。覆盖上面 6-7 个顶层域算 pass;若直接铺 linear regression / logistic regression / SVM / KNN / decision tree 一堆平级细节节点 = 顶层抽象失败,判低。这条同时是 granularity regression metric 的压力测试样本。",
  },
  {
    id: 10,
    goal: "我已经 build 过 LLM app,想理解 agent",
    type: "concept",
    tests: "personalization 测试(对比白纸用户)—— outline 是否跳过用户已知的基础(LLM 是什么、怎么调 API),直接进 agent-specific 内容。",
    coverageMode: "subtopic",
    subtopics: [
      { text: "Agent vs 单次 LLM call 的区别(loop / 自主性 / ReAct)", tier: "core" },
      { text: "Tool use / function calling(用户已知基础 → 应偏深:错误处理、并行调用)", tier: "core" },
      { text: "Planning / multi-step reasoning", tier: "core" },
      { text: "Memory / state 管理", tier: "core" },
      { text: "Multi-agent orchestration", tier: "core" },
      { text: "Agent eval / 可靠性 / 失败模式", tier: "core" },
      { text: "从“会调 API”到“会编排 agent”的能力 gap", tier: "bonus" },
    ],
    coverageRule:
      "7 个。1-6 全核心。personalization 前置检查:outline 若出现“什么是 LLM/API/prompt”这种节点 = personalization 失败(没利用“已 build 过 LLM app”信息),即使技术 coverage 高也判 personalization 低。",
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
    clarifyA: "我是资深 SWE,做过后端",
    clarifyB: "我是应届,只会写脚本",
    expectation:
      "outline 实质不同:资深的强调差异化优势/作品集,应届的强调补基础。",
  },
  {
    id: "P-2",
    goalId: 10,
    clarifyA: "我 build 过 LLM app(#10 原文)",
    clarifyB: "我完全不懂 AI,想了解 agent",
    expectation: "#10 跳过 LLM 基础,白纸版必须从基础起。",
  },
  {
    id: "P-3",
    goalId: 8,
    clarifyA: "我是医生,想用在诊断",
    clarifyB: "我是学生,想转行",
    expectation: "收窄方向完全不同。",
  },
  {
    id: "P-4",
    goalId: 10,
    clarifyA: "想从理论理解 agent",
    clarifyB: "想拆一个真 agent(如 Claude Code)来学",
    expectation:
      "覆盖同样的 6 个核心概念,但 framing 明显不同:A 是抽象概念节点;B 是把同样概念包装进具体系统(“Claude Code 怎么做 tool use / planning”)。测 framing 适配,不改 coverage 答案 key。",
  },
];
