import { NEED_OPTIONS, type NeedOption } from "./config";
import { cosine, loadChunks, loadHistory, loadVisitor } from "./db";
import { embedQuery } from "./openrouter";
import { buildQuote } from "./pricing";
import { isSiteTour, isTourAdvance, lastTourStopIndex } from "./tour";
import type { AssistantState, ChatTurn, Intent, RetrievedChunk } from "./types";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NAME_STOP = new Set([
  "a", "an", "and", "build", "capabilities", "contact", "email", "estimate", "estimator",
  "hello", "help", "hey", "hi", "how", "human", "is", "my", "name", "no", "ok", "okay",
  "or", "please", "quote", "services", "show", "site", "start", "team", "tell", "thank",
  "thanks", "the", "this", "tour", "what", "who", "why", "yes",
]);
const ASKED_FOR_NAME_RE =
  /(?:share|send|leave)\s+your\s+name|what(?:'s| is)\s+your\s+name|name and email|your name so the team|please share your name|your email so the team/i;

export function extractEmail(text: string) {
  return text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
}

export function extractSpokenEmail(text: string) {
  const direct = extractEmail(text);
  if (direct) return direct;
  const normalized = text
    .replace(/\b(?:dot|period)\b/gi, ".")
    .replace(/\b(?:at the rate of|at the rate|at)\b/gi, "@")
    .replace(/\s*([.@])\s*/g, "$1");
  return extractEmail(normalized) || extractEmail(normalized.replace(/\s+/g, ""));
}

export function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function isPlausibleName(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  if (EMAIL_RE.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 3) return false;
  if (words.some((word) => NAME_STOP.has(word.toLowerCase()))) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word));
}

export function cleanLeadName(value: string | null | undefined) {
  return isPlausibleName(value) ? value.trim() : null;
}

export function extractName(text: string, history: ChatTurn[]) {
  const patterns = [
    /(?:my name is|name is|i am|i'm|this is)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+){0,2})/i,
    /^name:\s*([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+){0,2})/im,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !EMAIL_RE.test(candidate) && isPlausibleName(candidate)) return titleCaseName(candidate);
  }
  const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant");
  if (lastAssistant && ASKED_FOR_NAME_RE.test(lastAssistant.content)) {
    const compact = extractSpokenEmail(text)
      ? text.replace(EMAIL_RE, "").replace(/\b\S+@\S+\b/g, "").replace(/[,.]/g, " ").trim()
      : text.replace(/[,.]/g, " ").trim();
    const words = compact.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z'-]+$/.test(word) && !NAME_STOP.has(word.toLowerCase()));
    const candidate = words.join(" ");
    if (words.length >= 1 && words.length <= 3 && compact.length < 80 && isPlausibleName(candidate)) {
      return titleCaseName(candidate);
    }
  }
  return null;
}

export function extractLeadsFromMessages(messages: ChatTurn[]) {
  let leadName: string | null = null;
  let leadEmail: string | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const turn = messages[index];
    if (turn.role !== "user") continue;
    const slice = messages.slice(0, index + 1);
    leadName = extractName(turn.content, slice) || leadName;
    leadEmail = extractSpokenEmail(turn.content) || leadEmail;
  }
  return {
    leadName: leadName ? titleCaseName(leadName) : null,
    leadEmail,
  };
}

export function historyHasLeadAsk(history: ChatTurn[]) {
  return history.some(
    (turn) =>
      turn.role === "assistant" &&
      (ASKED_FOR_NAME_RE.test(turn.content) || /share your email|so the team can follow up|pass this to a human/i.test(turn.content)),
  );
}

export function historyShowsHandoffSent(history: ChatTurn[]) {
  return history.some(
    (turn) => turn.role === "assistant" && /sent your brief to the RoyTech AI team/i.test(turn.content),
  );
}

export function detectIntent(text: string, history: ChatTurn[], hasLead: boolean): Intent {
  const t = text.toLowerCase();
  const waitingForLead = historyHasLeadAsk(history.slice(-6));
  if (waitingForLead && (extractSpokenEmail(text) || extractName(text, history) || hasLead)) return "handoff";
  if (isSiteTour(text)) return "tour";
  if (isTourAdvance(text)) {
    const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant");
    if (
      lastTourStopIndex(history) >= 0 ||
      /hero section|walk you through|one section at a time|studio pitch/i.test(lastAssistant?.content || "")
    ) {
      return "tour";
    }
  }
  if (/(talk to (a )?human|speak to|contact (the )?team|talk to rehan|hire|start a build|book|schedule|nda|contract|legal|call me|email me)/i.test(t)) {
    return "handoff";
  }
  if (/(how much|pricing|price|cost|quote|estimate|budget|estimator)/i.test(t)) return "quote";
  if (/(take me|show me|navigate|go to|open the|scroll)/i.test(t) || /#(why|services|method|estimator|solutions|contact|top)/i.test(t)) {
    return "navigate";
  }
  return "qa";
}

export function detectNavigate(text: string) {
  const t = text.toLowerCase();
  if (/blog/.test(t)) return "/blog";
  if (/estimat|pric|cost|quote/.test(t)) return "/#estimator";
  if (/contact|form|start a build/.test(t)) return "/#contact";
  if (/method|deliver|process|how you work/.test(t)) return "/#method";
  if (/service|capabilit/.test(t)) return "/#services";
  if (/solution|pattern/.test(t)) return "/#solutions";
  if (/why|about the studio/.test(t)) return "/#why";
  return null;
}

export function mapNeed(text: string): NeedOption {
  const t = text.toLowerCase();
  if (/automat|n8n|integrat|crm|hubspot|salesforce|webhook/.test(t)) return "Automation and integrations";
  if (/moderniz|legacy|rewrite|migrate/.test(t)) return "Modernize existing software";
  if (/squad|embed|extend|staff|team/.test(t)) return "Extend an engineering team";
  if (/platform|portal|enterprise|internal/.test(t)) return "Build a custom platform";
  if (/mvp|saas|web app|full[- ]?stack/.test(t)) return "Build an MVP";
  return "Add AI to a product";
}

export function compileBrief(state: Pick<AssistantState, "messages" | "quote" | "lastUserMessage">) {
  const userNotes = state.messages
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .join("\n- ");
  const quoteLine = state.quote
    ? `\nIndicative quote: ${state.quote.summary}\nScope: ${state.quote.scope}\nAI: ${state.quote.aiFeatures.join(", ") || "n/a"}\nFull-stack: ${state.quote.fullStackFeatures.join(", ") || "n/a"}\nPace: ${state.quote.pace}`
    : "";
  return `Compiled by RoytechAI Assistant from the on-site conversation.

Latest request:
${state.lastUserMessage}

Conversation notes:
- ${userNotes}
${quoteLine}

Please follow up as a human on the RoyTech AI team.`.trim();
}

export function buildSystemPrompt(state: AssistantState) {
  const docs = state.docs
    .map((doc) => `### ${doc.source} — ${doc.section}\n${doc.text}`)
    .join("\n\n");
  const quote = state.quote ? `\nIndicative quote to mention if relevant:\n${state.quote.summary}\n` : "";
  return `You are RoytechAI Assistant, the on-site guide for RoyTech AI (roytechworkforce.com). Speak as the studio assistant, not as Rehan Ghafoor.

You help visitors tour the site, answer questions from the knowledge below, explain agentic AI, fullstack/web apps, n8n, and automation, and give indicative quotes from the estimator.

Rules:
- Ground answers in the knowledge. If you cannot, do not invent facts, emails, phone numbers, client names, or guarantees.
- Quotes are indicative ranges, never a contract.
- Never write "User Safety", "Response Safety", or any safety labels.
- If the visitor asks for a site tour, do not dump every section in one list and do not wait for them to say next. The product plays the full tour itself. Never emit tool-call tags such as <|tool_call_start|>. For a single section request, put [[NAVIGATE:/#services]] or [[NAVIGATE:/blog]] alone on the last line and say something natural such as "I'll take you to Capabilities."
- When a human should take over, put [[HANDOFF]] alone on the last line. Then politely ask only for the missing lead fields. Do not re-ask the project story if it is already in the thread.
- Lead on file: name=${state.leadName || "none"}; email=${state.leadEmail || "none"}. Never say you already have a name or email if that field is none. If both are none, ask for name and email together.
- If a brief was already sent, confirm that and do not pretend to email from a personal inbox.
- Keep replies concise, professional, and specific. Write only visitor-facing prose besides those hidden control lines.
- Format in Markdown: **bold** for roles, phases, and key terms; ### headings for section labels such as "Key steps".
- Write sequential steps as one numbered list, each item on its own line: 1. **Title** – detail. Do not put each step in its own paragraph.
- When comparing options, stacks, phases, or price bands, use a GitHub-flavored markdown table with a header row and a separator row of dashes. Never use HTML tags.

${quote}
Knowledge:
${docs || "No retrieved chunks. Stay conservative and offer a human handoff if needed."}`;
}

export async function retrieveChunks(query: string, k = 6): Promise<RetrievedChunk[]> {
  const [vector, chunks] = await Promise.all([embedQuery(query), loadChunks()]);
  return chunks
    .map((chunk) => ({
      source: chunk.source,
      section: chunk.section,
      text: chunk.text,
      score: cosine(vector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function hydrateState(input: {
  visitorId: string;
  message: string;
  history?: ChatTurn[];
  leadName?: string | null;
  leadEmail?: string | null;
}): Promise<AssistantState> {
  const storedHistory = await loadHistory(input.visitorId).catch(() => [] as ChatTurn[]);
  const visitor = await loadVisitor(input.visitorId).catch(() => ({
    leadName: null as string | null,
    leadEmail: null as string | null,
    handoffSent: false,
  }));
  const messages = (input.history && input.history.length > 0 ? input.history : storedHistory).concat({
    role: "user",
    content: input.message,
  });
  const leads = extractLeadsFromMessages(messages);
  const leadEmail = leads.leadEmail || extractSpokenEmail(input.message) || extractEmail(input.message) || input.leadEmail || visitor.leadEmail;
  const leadName = cleanLeadName(leads.leadName || input.leadName || visitor.leadName);
  const intent = detectIntent(input.message, messages, Boolean(leadName && leadEmail));
  const navigateTo = intent === "navigate" ? detectNavigate(input.message) : null;
  const quote = intent === "quote" || /quote|estimate|price|cost/.test(input.message.toLowerCase())
    ? buildQuote(input.message)
    : null;

  let docs: RetrievedChunk[] = [];
  try {
    docs = await retrieveChunks(input.message);
  } catch {
    docs = [];
  }

  const state: AssistantState = {
    visitorId: input.visitorId,
    messages,
    lastUserMessage: input.message,
    intent,
    docs,
    quote,
    navigateTo,
    leadName,
    leadEmail,
    handoffSent: visitor.handoffSent || historyShowsHandoffSent(messages),
    handoffNeeded: intent === "handoff",
    systemPrompt: "",
    compiledNeed: mapNeed(input.message + " " + messages.map((m) => m.content).join(" ")),
    compiledBrief: "",
  };
  state.compiledBrief = compileBrief(state);
  state.systemPrompt = buildSystemPrompt(state);
  return state;
}
