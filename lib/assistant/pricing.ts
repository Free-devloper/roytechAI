export type ProjectScope = "AI Agentic System" | "Full-Stack SaaS" | "Enterprise Platform" | "Mobile + Web App";

export const scopeBases: Record<ProjectScope, { base: number; timeline: string; desc: string }> = {
  "AI Agentic System": { base: 8500, timeline: "3–6 weeks", desc: "Autonomous AI agents, RAG knowledge bases, tool orchestration, & model evals." },
  "Full-Stack SaaS": { base: 12500, timeline: "4–8 weeks", desc: "Complete web SaaS product with Auth, Stripe billing, admin portal, & Postgres." },
  "Enterprise Platform": { base: 19500, timeline: "6–12 weeks", desc: "High-scale internal ops platform, legacy migration, RBAC, & microservices." },
  "Mobile + Web App": { base: 16000, timeline: "5–10 weeks", desc: "Cross-platform iOS/Android app + web admin dashboard & real-time sync." },
};

export const aiFeatures = [
  { id: "rag", label: "RAG & Vector Search", cost: 2500, keywords: ["rag", "vector", "knowledge", "embed"] },
  { id: "agents", label: "Multi-Agent Workflows", cost: 4200, keywords: ["multi-agent", "multi agent", "langgraph", "orchestr"] },
  { id: "evals", label: "Model Evals & Guardrails", cost: 1800, keywords: ["eval", "guardrail", "safety"] },
  { id: "multimodal", label: "Real-time Voice / Vision", cost: 3500, keywords: ["voice", "vision", "whisper", "speech"] },
  { id: "finetuning", label: "Custom Fine-Tuning", cost: 3800, keywords: ["fine-tun", "finetun", "lora"] },
] as const;

export const fullStackFeatures = [
  { id: "auth_rbac", label: "Auth & Multi-Tenant RBAC", cost: 1500, keywords: ["auth", "rbac", "tenant"] },
  { id: "billing", label: "Stripe Billing & Subscriptions", cost: 1800, keywords: ["stripe", "billing", "subscription"] },
  { id: "admin", label: "Custom Admin Control Room", cost: 2200, keywords: ["admin", "dashboard", "control room"] },
  { id: "integrations", label: "CRM & API Integrations", cost: 2000, keywords: ["crm", "hubspot", "salesforce", "integrat", "n8n"] },
  { id: "infra", label: "High-Performance Cloud & Queues", cost: 2500, keywords: ["redis", "queue", "websocket", "scale"] },
] as const;

export const deliveryPaces = [
  { key: "Standard", multiplier: 1.0, label: "Standard Sprint" },
  { key: "Accelerated", multiplier: 1.25, label: "Accelerated Squad" },
  { key: "Enterprise", multiplier: 1.5, label: "Turnkey & Support" },
] as const;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function detectScope(text: string): ProjectScope {
  const t = text.toLowerCase();
  if (/(mobile|ios|android|react native)/.test(t)) return "Mobile + Web App";
  if (/(enterprise|legacy|internal ops|microservice)/.test(t)) return "Enterprise Platform";
  if (/(saas|stripe|portal|full[- ]?stack|web app)/.test(t)) return "Full-Stack SaaS";
  return "AI Agentic System";
}

export function detectPace(text: string) {
  const t = text.toLowerCase();
  if (/(enterprise|turnkey|sla|support)/.test(t)) return deliveryPaces[2];
  if (/(accelerat|urgent|asap|fast)/.test(t)) return deliveryPaces[1];
  return deliveryPaces[0];
}

export function buildQuote(text: string) {
  const scope = detectScope(text);
  const pace = detectPace(text);
  const t = text.toLowerCase();
  const selectedAi = aiFeatures.filter((f) => f.keywords.some((k) => t.includes(k)));
  const selectedFs = fullStackFeatures.filter((f) => f.keywords.some((k) => t.includes(k)));
  const ai = selectedAi.length > 0 ? selectedAi : text.toLowerCase().includes("agent") || scope === "AI Agentic System"
    ? [aiFeatures[0], aiFeatures[1]]
    : [];
  const fs = selectedFs.length > 0 ? selectedFs : scope === "Full-Stack SaaS" || scope === "Enterprise Platform"
    ? [fullStackFeatures[0], fullStackFeatures[1]]
    : [];
  const subtotal = scopeBases[scope].base + ai.reduce((s, f) => s + f.cost, 0) + fs.reduce((s, f) => s + f.cost, 0);
  const low = Math.round(subtotal * pace.multiplier);
  const high = Math.round(low * 1.22);
  return {
    scope,
    timeline: scopeBases[scope].timeline,
    low,
    high,
    aiFeatures: ai.map((f) => f.label),
    fullStackFeatures: fs.map((f) => f.label),
    pace: pace.label,
    summary: `Indicative range ${money.format(low)} – ${money.format(high)} for a ${scope} (${scopeBases[scope].timeline}, ${pace.label}). This is not a contract.`,
  };
}

export function formatMoney(n: number) {
  return money.format(n);
}
