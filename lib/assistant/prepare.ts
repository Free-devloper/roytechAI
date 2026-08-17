import { NEED_OPTIONS, type NeedOption } from "./config";
import { cosine, loadChunks, loadHistory, loadVisitor } from "./db";
import { embedQuery } from "./openrouter";
import { buildQuote } from "./pricing";
import type { AssistantState, ChatTurn, Intent, RetrievedChunk } from "./types";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function extractEmail(text: string) {
  return text.match(EMAIL_RE)?.[0] ?? null;
}

export function extractName(text: string, history: ChatTurn[]) {
  const patterns = [
    /(?:my name is|i am|i'm|this is)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/i,
    /^name:\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/im,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && !EMAIL_RE.test(match[1])) return match[1].trim();
  }
  const asked = history.slice(-4).some((turn) => turn.role === "assistant" && /name/i.test(turn.content));
  if (asked) {
    const compact = text.replace(EMAIL_RE, "").replace(/[,.]/g, " ").trim();
    const words = compact.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z'-]+$/.test(word));
    if (words.length >= 1 && words.length <= 4 && compact.length < 60) return words.join(" ");
  }
  return null;
}

export function detectIntent(text: string, history: ChatTurn[], hasLead: boolean): Intent {
  const t = text.toLowerCase();
  const waitingForLead = history.slice(-2).some(
    (turn) => turn.role === "assistant" && /name|email/i.test(turn.content) && /follow up|handoff|team|human|brief/i.test(turn.content),
  );
  if (waitingForLead && (extractEmail(text) || extractName(text, history) || hasLead)) return "handoff";
  if (/(talk to (a )?human|speak to|contact (the )?team|talk to rehan|hire|start a build|book|schedule|nda|contract|legal|call me|email me)/i.test(t)) {
    return "handoff";
  }
  if (/(how much|pricing|price|cost|quote|estimate|budget|estimator)/i.test(t)) return "quote";
  if (/(take me|show me|tour|navigate|go to|open the|scroll)/i.test(t) || /#(why|services|method|estimator|solutions|contact|top)/i.test(t)) {
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
  if (/tour|walk me|show me (the )?site|around the site/.test(t)) return "/#services";
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
- Never show control syntax to the visitor. If you need to move the page, put [[NAVIGATE:/#services]] or [[NAVIGATE:/blog]] alone on the last line. In the spoken reply, say something natural such as "I'll take you to Capabilities."
- When a human should take over, put [[HANDOFF]] alone on the last line. Then politely ask only for name and email if they are missing. Do not re-ask the project story if it is already in the thread.
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
  const leadEmail = extractEmail(input.message) || input.leadEmail || visitor.leadEmail;
  const leadName = extractName(input.message, messages) || input.leadName || visitor.leadName;
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
    handoffSent: visitor.handoffSent,
    handoffNeeded: intent === "handoff",
    systemPrompt: "",
    compiledNeed: mapNeed(input.message + " " + messages.map((m) => m.content).join(" ")),
    compiledBrief: "",
  };
  state.compiledBrief = compileBrief(state);
  state.systemPrompt = buildSystemPrompt(state);
  return state;
}
