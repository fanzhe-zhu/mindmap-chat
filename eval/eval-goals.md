# Mind Map Chat — Eval Goals (Root Agent Test Set)

> **Version**: v1.0 (2026-05-26, initial lock candidate)
> **Status**: Draft — **lock at end of W0**, then frozen for entire v1 sprint
> **Companion**: `design-doc-v1.md` §14 (root eval metrics), §16 (test set), `eval-scenarios.md` (leaf)
> **Purpose**: This is the **answer key** for root agent coverage scoring. Without it, coverage is vibes.

---

## How to use this file

Each goal has:
- **Type** — concept / skill / comparison / project / vague (drives what "good" looks like)
- **Tests** — the specific thing this goal probes
- **Core subtopics (answer key)** — the 5–8 subtopics a good outline SHOULD surface. This is the coverage reference (§14: "参照专家清单 / wiki TOC").
- **Coverage scoring rule** — when scoring, what counts as "covered"

### Coverage scoring convention (lock this — it's your rubric)

A subtopic counts as **covered** if the outline has **a node whose title or one_liner clearly maps to it**. A subtopic only *mentioned in passing inside another node's one_liner* counts as **half** (0.5). Coverage % = covered subtopics / total answer-key subtopics, scored per goal, then averaged across all 10.

- **Target**: 80%+ average (capability metric — expect to start lower, climb via prompt iteration)
- **Don't** penalize an outline for *extra* nodes beyond the answer key — only measure what's missing. (Extra-node bloat is caught by the granularity regression metric, not coverage.)

### Capability vs Regression note

Root agent metrics split (per design-doc-v1 §14, type column):
- **Capability** (climb, track trend): Coverage, Personalization, Non-overlap
- **Regression** (should stay stable): Granularity (node count std/mean < 0.3)

---

## Goal 1 — 理解 RLHF 的核心思想

- **Type**: concept (concept-heavy)
- **Tests**: 能否把一个抽象训练范式拆成连贯的概念链
- **Core subtopics (answer key)**:
  1. 为什么需要 RLHF — pretraining / next-token prediction 为什么不够 aligned
  2. 人类偏好数据收集(pairwise comparison / preference data)
  3. Reward model 训练
  4. RL 微调阶段(PPO 或类似,把 policy 推向高 reward）
  5. KL penalty / 防 reward hacking / 防偏离基座太远
  6. 局限与替代(DPO / RLAIF / Constitutional AI)
- **Coverage scoring rule**: 6 个 subtopic。1-5 是核心(缺任一扣分重),6 是加分项(缺了不算大问题,但好的 outline 会带一个"局限/替代"节点)。

---

## Goal 2 — Transformer 怎么工作

- **Type**: concept (multi-layer)
- **Tests**: 多层结构的概念,outline 是否有合理的由表及里顺序
- **Core subtopics (answer key)**:
  1. Tokenization + embedding(输入怎么变成向量)
  2. Positional encoding(为什么需要 + 怎么做)
  3. Self-attention(Q/K/V 机制)
  4. Multi-head attention
  5. Feed-forward 层 + 残差连接 + layer norm
  6. Encoder vs decoder 架构变体
  7. 为什么取代 RNN(并行化 / 长程依赖)
- **Coverage scoring rule**: 7 个。3-5 是绝对核心(attention 是 Transformer 的灵魂,缺了直接判低)。1、2、6、7 是结构完整性,缺 1-2 个可接受。

---

## Goal 3 — 学会用 PostgreSQL

- **Type**: skill (skill-oriented)
- **Tests**: skill 类 goal —— 答案key 应偏"能做什么"而非"理解什么"
- **Core subtopics (answer key)**:
  1. 安装 / 连接 / psql 基本操作
  2. 数据类型 + 建表 / schema 设计
  3. CRUD(SELECT / INSERT / UPDATE / DELETE)
  4. JOIN + 关系建模
  5. 索引 + 查询性能基础
  6. 事务 / ACID
  7. (加分)备份 / 权限管理
- **Coverage scoring rule**: 7 个。1-6 核心。注意 skill 类的 coverage 还要看节点标题是否是 imperative / 可操作风格(§12.1:title style 由 LLM 自决,但 skill 类铺成纯名词概念是个 smell —— 人工记一笔,不进 coverage 分,进 personalization/质量观察)。

---

## Goal 4 — 如何写好的 user research

- **Type**: skill (soft topic)
- **Tests**: soft skill —— 答案key 不像技术 topic 那样有标准 TOC,容错率要高一点
- **Core subtopics (answer key)**:
  1. 定义研究目标 / 问对 research question
  2. 选方法(定性 vs 定量;访谈 / 问卷 / 可用性测试)
  3. 招募 / 抽样(找对的人)
  4. 访谈与提问技巧(避免诱导性问题、追问)
  5. 分析 / 综合(原始数据 → insight,affinity mapping 等)
  6. 把 insight 转成可执行结论 / 影响决策
  7. (加分)常见偏差(确认偏差、引导偏差)
- **Coverage scoring rule**: 7 个。soft topic 容许 outline 用不同切法 —— 如果 outline 用了不同框架但实质覆盖了这些点,算覆盖。判的是"实质覆盖"不是"字面匹配"。

---

## Goal 5 — 从 SWE 转 AIPM 应该准备什么  ✅ 已校准

- **Type**: skill / planning (你自己的 use case)
- **Tests**: 你最懂的领域 —— 答案key 已由你校准。
- **Core subtopics (answer key)**:
  - **核心(缺任一扣分重)**:
    2. 需要补的技能(eval、prompt engineering、agent 系统理解、数据直觉)
    3. 作品集 / portfolio(怎么用项目证明能力)
    4. 面试准备(case、product sense、技术深度问题)
  - **加分项(缺了不算大问题)**:
    1. AIPM 与传统 PM / SWE 的职责差异(到底不一样在哪)
    5. 利用 SWE 背景的差异化优势
    6. 目标公司 / 市场认知(哪类公司在招、要求差异)
- **Coverage scoring rule**: 6 个 subtopic。2/3/4 是绝对核心,缺任一判低。1/5/6 是加分项。覆盖 % 仍按 6 个总数算(独立节点=1,passing mention=0.5)。

---

## Goal 6 — 为我的 side project 写一份 PRD

- **Type**: project (project-based)
- **Tests**: project 类 goal —— 内容依赖具体项目,所以**先看 clarify 是否问出项目是什么**,coverage 评的是 PRD 骨架完整度而非领域内容
- **Core subtopics (answer key) — PRD 结构维度**:
  1. 问题陈述 / 背景(为什么做)
  2. 目标用户 + 核心用例
  3. 目标 / 成功指标(success metrics)
  4. 功能需求 / scope(MVP vs later)
  5. 非功能需求(性能 / 安全 / 隐私等)
  6. 范围外(explicit out of scope)
  7. 里程碑 / 时间线
- **Coverage scoring rule**: 7 个。**前置检查**:root 应该先 clarify "你的 side project 是什么"再生成 —— 如果它跳过 clarify 直接铺通用 PRD 模板,coverage 即使满也要在 personalization 维度扣分(它把你当白纸了,违反 §11)。

---

## Goal 7 — RAG 和 fine-tuning 该怎么选

- **Type**: comparison
- **Tests**: comparison 类 —— 答案key 应强调**决策维度**,而不是退化成"RAG 是什么 + fine-tuning 是什么"两个 concept 节点
- **Core subtopics (answer key)**:
  1. 两者机制速览(简述即可,不应占大头)
  2. 决策维度:数据新鲜度 / 动态性
  3. 决策维度:成本(训练 vs 检索 infra)
  4. 决策维度:任务类型(知识注入 vs 行为/风格改变)
  5. 决策维度:数据量 / 质量门槛
  6. 混合方案(两者结合)
  7. 实际决策框架 / decision tree
- **Coverage scoring rule**: 7 个。**comparison 专属 smell**:如果 outline 一半节点在讲"RAG 内部细节"、一半讲"fine-tuning 内部细节",而没有 cross-cutting 的决策维度节点 —— coverage 判低。好的 comparison outline 的节点是"维度",不是"两个被比的东西各自展开"。

---

## Goal 8 — 我想了解 AI  (模糊 goal)

- **Type**: vague —— **coverage 评分方式不同**
- **Tests**: clarify 是否起作用。这条**不评 subtopic 覆盖**(因为根本没收窄,任何固定 subtopic 清单都是错的)。
- **答案key = clarify 行为,不是 subtopic**:
  - ✅ 期望:root agent **不直接生成通用 AI syllabus**,而是先 clarify —— 问"你想了解 AI 的哪个方面 / 你的背景 / 目的(职业?好奇?具体问题?)"
  - ❌ 失败:直接铺一个"AI 历史 / 机器学习 / 深度学习 / 应用"的通用大纲,把用户当白纸
- **Coverage scoring rule**: 二元判断 —— **clarify 是否问到了 scope/depth/purpose**(pass)还是**跳过 clarify 直接生成通用 syllabus**(fail)。收窄后的 outline 是否匹配 clarify 答案,作为第二层观察(进 personalization)。

---

## Goal 9 — 学会 machine learning  (太大 goal)

- **Type**: vague-ish / oversized —— **测 root 怎么处理过大 scope**
- **Tests**: granularity 不爆炸 + 顶层结构合理。比 #8 稍具体,所以 root 可以选择 clarify **或** 给一个分层合理的顶层结构(而不是一口气铺 30 个细节节点)
- **答案key — 合理顶层结构(若不 clarify 也应长这样)**:
  1. 数学 / 统计基础
  2. 监督学习(回归 / 分类)
  3. 无监督学习
  4. 模型评估 / 验证
  5. 特征工程 / 数据处理
  6. 实践 / 工具(scikit-learn 等)
  7. (延伸入口)深度学习
- **Coverage scoring rule**: **主测 granularity**(node count 不应爆炸成 20+ 细节节点)。覆盖上面 6-7 个**顶层域**算 pass;如果直接铺 "linear regression / logistic regression / SVM / KNN / decision tree ..." 一堆平级细节节点 = 顶层抽象失败,判低。**这条 goal 同时是 granularity regression metric 的压力测试样本**。

---

## Goal 10 — 我已经 build 过 LLM app,想理解 agent  ✅ 已校准

- **Type**: concept + **personalization 测试**(对比白纸用户)
- **Tests**: outline 是否**跳过用户已知的基础**(LLM 是什么、怎么调 API),直接进 agent-specific 内容。这是 personalization 维度的核心样本 —— 拿它和一个假想"白纸理解 agent"对比。
- **Core subtopics (answer key)**:
  - **核心(1-6 全部核心,缺任一扣分)**:
    1. Agent vs 单次 LLM call 的区别(loop / 自主性 / ReAct)
    2. Tool use / function calling(用户可能已知基础 → 应偏深:错误处理、并行调用)
    3. Planning / multi-step reasoning
    4. Memory / state 管理
    5. Multi-agent orchestration
    6. Agent eval / 可靠性 / 失败模式
  - **加分项**:
    7. 从"会调 API"到"会编排 agent"的能力 gap
- **Coverage scoring rule**: 7 个。1-6 全核心。**personalization 前置检查**:outline 若出现"什么是 LLM""什么是 API""什么是 prompt"这种节点 = personalization 失败(没利用"已 build 过 LLM app"这个信息),即使技术 coverage 高也判 personalization 低。

---

## Personalization 测试对(§14 personalization 维度专用)

Personalization 要求"同一 goal,不同 clarify 答案 → 实质不同 outline"。固定测试对:

| 测试对 | Goal | Clarify 答案 A | Clarify 答案 B | 期望 |
|---|---|---|---|---|
| P-1 | #5 "转 AIPM" | "我是资深 SWE,做过后端" | "我是应届,只会写脚本" | outline 实质不同(资深的强调差异化优势/作品集,应届的强调补基础) |
| P-2 | #10 vs 白纸 | "我 build 过 LLM app"(#10 原文) | "我完全不懂 AI,想了解 agent" | #10 跳过 LLM 基础,白纸版必须从基础起 |
| P-3 | #8 "了解 AI" | clarify 答"我是医生,想用在诊断" | clarify 答"我是学生,想转行" | 收窄方向完全不同 |
| P-4 | #10 theory-vs-example | "想从理论理解 agent" | "想拆一个真 agent(如 Claude Code)来学" | **覆盖同样的 6 个核心概念,但 framing 明显不同**:A 是抽象概念节点;B 是把同样概念包装进具体系统("Claude Code 怎么做 tool use / planning")。测的是 framing 适配,**不改 coverage 答案key** |

**评分**: 人工二元判断"两个 outline 是否明显不同"。Target: 明显不同(§14)。

**P-4 注意**: 这条只测"agent 有没有根据 theory/example 选择换 framing"。两边 coverage 都仍按 #10 的 1-6 核心算 —— example 路线把概念包装进 Claude Code,不等于少覆盖概念。
> **关联 P1 prompt(非 eval,W3 迭代时再动)**: "theory vs example" 是 root agent clarify 可选的一个问法,适合 #1/#2/#10 这类有标志性实现的 concept goal,**不写成每个 goal 必问的硬规则**(soft topic 如 #4 没有 canonical example)。此改动属 `prompts.md`,W0 锁 ground truth 阶段不碰。

---

## Lock statement

W0 收尾时,本文件(含所有 subtopic 答案key、coverage 评分细则、personalization 测试对)**锁定**。Sprint 期间不改不加不删。Goal #5/#10 的校准必须在 lock 之前完成 —— lock 之后改答案key = 破坏 apples-to-apples 比较。

**待办(lock 前)**:
- [x] 校准 Goal #5 答案key —— 2/3/4 核心,1/5/6 加分(2026-05-26)
- [x] 校准 Goal #10 答案key —— 1-6 核心,7 加分;新增 P-4 personalization 对(2026-05-26)
- [x] 确认 coverage 评分细则(独立节点 = 1,passing mention = 0.5)

**✅ 全部校准完成 — 本文件可 lock。**
