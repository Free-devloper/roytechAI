export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

export type Intent = "quote" | "navigate" | "qa" | "handoff" | "tour";

export type RetrievedChunk = {
  source: string;
  section: string;
  text: string;
  score: number;
};

export type QuoteResult = {
  scope: string;
  timeline: string;
  low: number;
  high: number;
  aiFeatures: string[];
  fullStackFeatures: string[];
  pace: string;
  summary: string;
};

export type AssistantState = {
  visitorId: string;
  messages: ChatTurn[];
  lastUserMessage: string;
  intent: Intent;
  docs: RetrievedChunk[];
  quote: QuoteResult | null;
  navigateTo: string | null;
  leadName: string | null;
  leadEmail: string | null;
  handoffSent: boolean;
  handoffNeeded: boolean;
  systemPrompt: string;
  compiledNeed: string;
  compiledBrief: string;
};

export type SseEvent =
  | { type: "session"; visitorId: string }
  | { type: "token"; content: string }
  | { type: "navigate"; target: string }
  | { type: "quote"; quote: QuoteResult }
  | { type: "handoff"; sent: boolean; missing?: "name" | "email" | "both" }
  | { type: "transcript"; text: string }
  | { type: "audio"; mime: string; data: string; rate?: number; content?: string }
  | { type: "hello" }
  | { type: "hangup" }
  | { type: "done" }
  | { type: "error"; message: string };

export const NAVIGATE_RE = /\[\[NAVIGATE:([^\]]+)\]\]/gi;
export const NAVIGATE_CALL_RE = /\[NAVIGATE\(\s*['"]([^'"]+)['"]\s*\)\]/gi;
export const NAVIGATE_BARE_RE = /\bNAVIGATE\(\s*['"]([^'"]+)['"]\s*\)/gi;
export const HANDOFF_RE = /\[\[HANDOFF\]\]/gi;
export const HANDOFF_CALL_RE = /\[HANDOFF\(\s*\)\]|\bHANDOFF\(\s*\)/gi;
export const END_CALL_RE = /\[\[END_CALL\]\]/gi;
const TOOL_WRAP_RE = /<\|[^|>]*\|>/g;
const SAFETY_RE = /(?:^|\n)\s*(?:user|response)\s*safety\s*:\s*\w+\s*/gi;
const SAFETY_INLINE_RE = /\b(?:user|response)\s*safety\s*:\s*\w+/gi;

export function normalizeNavigateTarget(raw: string) {
  const target = raw.trim();
  if (!target) return "";
  if (target.startsWith("/") || target.startsWith("#")) return target.startsWith("#") ? `/${target}` : target;
  if (/^(why|services|method|estimator|solutions|contact|top)$/i.test(target)) return `/#${target.toLowerCase()}`;
  return target;
}

export function extractNavigateTargets(text: string) {
  const targets: string[] = [];
  for (const pattern of [NAVIGATE_RE, NAVIGATE_CALL_RE, NAVIGATE_BARE_RE]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const target = normalizeNavigateTarget(match[1]);
      if (target) targets.push(target);
    }
  }
  return targets;
}

export function sanitizeAssistantText(text: string, streaming = false) {
  let out = text
    .replace(NAVIGATE_RE, "")
    .replace(NAVIGATE_CALL_RE, "")
    .replace(NAVIGATE_BARE_RE, "")
    .replace(HANDOFF_RE, "")
    .replace(HANDOFF_CALL_RE, "")
    .replace(END_CALL_RE, "")
    .replace(TOOL_WRAP_RE, "")
    .replace(SAFETY_RE, "\n")
    .replace(SAFETY_INLINE_RE, "");
  if (streaming) {
    const open = Math.max(out.lastIndexOf("[["), out.lastIndexOf("<|"));
    const close = Math.max(out.lastIndexOf("]]"), out.lastIndexOf("|>"));
    if (open > close) out = out.slice(0, open);
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/^\s+/g, "");
}
