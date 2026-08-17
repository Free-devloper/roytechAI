# Agentic AI at RoyTech AI

RoyTech AI builds production agents when they improve a real workflow: routing, tools, retrieval, memory, evals, and an operator view. The founder stack includes LangChain, LangGraph, LlamaIndex, OpenAI-compatible models, and vector databases (PgVector, Qdrant, FAISS, OpenSearch, Chroma).

## What we mean by an agent

An agent is a loop with a goal, tools, and stop conditions — not a chatbot with extra prompts. Production systems use:

- A task router that classifies intent and dispatches to specialists
- Typed tool schemas (TypeScript or Pydantic) validated before execution
- Deterministic state machines (LangGraph) for retries and fallbacks
- Memory that is scoped (thread, user, org) rather than infinite chat logs
- Guardrails: allow-lists, PII filters, citation requirements, human-in-the-loop for irreversible actions
- Evaluation sets that measure accuracy, latency, and tool-success rate

## RAG with agents

Knowledge assistants retrieve first, then generate. Hybrid search (BM25 + dense embeddings + re-rank) is the default for governed answers. Citations should point at source chunks. Do not dump an entire corpus into the model context.

Typical architecture: ingest → chunk → embed → store → retrieve top-k → optional re-rank → generate with citations → log traces.

## Multi-agent patterns

- Router + specialists (analyst, writer, QA)
- Planner / executor
- Supervisor with worker agents
- Human approval node before send, pay, or delete

RoyTech AI uses these on FinTech fraud, property discovery, clinical decision support, portfolio risk, hospital operations, and document chat in the founder portfolio.

## When not to use agents

If the job is a fixed webhook chain (form → CRM → Slack), n8n or a simple API integration is cheaper and more reliable. Agents earn their keep when the next step depends on judgment, retrieval, or branching that cannot be fully enumerated.

## Indicative product

Estimator base "AI Agentic System" starts at $8,500 / 3–6 weeks. Add RAG ($2,500), multi-agent ($4,200), evals ($1,800), voice/vision ($3,500), or fine-tuning ($3,800) as needed. Always label as indicative.
