export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

export type Intent = "quote" | "navigate" | "qa" | "handoff";

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
  | { type: "done" }
  | { type: "error"; message: string };

export const NAVIGATE_RE = /\[\[NAVIGATE:([^\]]+)\]\]/g;
export const HANDOFF_RE = /\[\[HANDOFF\]\]/g;
