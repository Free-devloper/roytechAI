import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { loadHistory, loadVisitor } from "./db";
import { extractSpokenEmail, extractEmail, extractLeadsFromMessages, cleanLeadName, detectIntent, detectNavigate, mapNeed, retrieveChunks, compileBrief, buildSystemPrompt, historyShowsHandoffSent } from "./prepare";
import { buildQuote } from "./pricing";
import type { ChatTurn, Intent, QuoteResult, RetrievedChunk } from "./types";

function last<T>(_left: T, right: T) {
  return right;
}

export const AgentState = Annotation.Root({
  visitorId: Annotation<string>(),
  lastUserMessage: Annotation<string>(),
  clientHistory: Annotation<ChatTurn[]>({ reducer: last, default: () => [] }),
  clientLeadName: Annotation<string | null>({ reducer: last, default: () => null }),
  clientLeadEmail: Annotation<string | null>({ reducer: last, default: () => null }),
  messages: Annotation<ChatTurn[]>({ reducer: last, default: () => [] }),
  intent: Annotation<Intent>({ reducer: last, default: () => "qa" as Intent }),
  docs: Annotation<RetrievedChunk[]>({ reducer: last, default: () => [] }),
  quote: Annotation<QuoteResult | null>({ reducer: last, default: () => null }),
  navigateTo: Annotation<string | null>({ reducer: last, default: () => null }),
  leadName: Annotation<string | null>({ reducer: last, default: () => null }),
  leadEmail: Annotation<string | null>({ reducer: last, default: () => null }),
  handoffSent: Annotation<boolean>({ reducer: last, default: () => false }),
  handoffNeeded: Annotation<boolean>({ reducer: last, default: () => false }),
  systemPrompt: Annotation<string>({ reducer: last, default: () => "" }),
  compiledNeed: Annotation<string>({ reducer: last, default: () => "" }),
  compiledBrief: Annotation<string>({ reducer: last, default: () => "" }),
});

export type GraphState = typeof AgentState.State;

async function loadHistoryNode(state: GraphState) {
  const stored = await loadHistory(state.visitorId).catch(() => [] as ChatTurn[]);
  const visitor = await loadVisitor(state.visitorId).catch(() => ({
    leadName: null as string | null,
    leadEmail: null as string | null,
    handoffSent: false,
  }));
  const base = state.clientHistory.length > 0 ? state.clientHistory : stored;
  const messages = base.concat({ role: "user", content: state.lastUserMessage });
  const leads = extractLeadsFromMessages(messages);
  return {
    messages,
    leadName: cleanLeadName(leads.leadName || state.clientLeadName || visitor.leadName),
    leadEmail: leads.leadEmail || extractSpokenEmail(state.lastUserMessage) || extractEmail(state.lastUserMessage) || state.clientLeadEmail || visitor.leadEmail,
    handoffSent: visitor.handoffSent || historyShowsHandoffSent(messages),
  };
}

function routeIntentNode(state: GraphState) {
  const intent = detectIntent(state.lastUserMessage, state.messages, Boolean(state.leadName && state.leadEmail));
  return {
    intent,
    handoffNeeded: intent === "handoff",
    navigateTo: intent === "navigate" ? detectNavigate(state.lastUserMessage) : state.navigateTo,
  };
}

async function retrieveNode(state: GraphState) {
  try {
    return { docs: await retrieveChunks(state.lastUserMessage) };
  } catch {
    return { docs: [] as RetrievedChunk[] };
  }
}

function buildQuoteNode(state: GraphState) {
  if (state.intent !== "quote" && !/(quote|estimate|price|cost|budget)/i.test(state.lastUserMessage)) {
    return { quote: state.quote };
  }
  return { quote: buildQuote(state.lastUserMessage) };
}

function prepareGenerateNode(state: GraphState) {
  const compiledNeed = mapNeed(state.lastUserMessage + " " + state.messages.map((item) => item.content).join(" "));
  const next = {
    ...state,
    compiledNeed,
    compiledBrief: "",
    systemPrompt: "",
  };
  next.compiledBrief = compileBrief(next);
  next.systemPrompt = buildSystemPrompt(next);
  return {
    compiledNeed: next.compiledNeed,
    compiledBrief: next.compiledBrief,
    systemPrompt: next.systemPrompt,
  };
}

function afterIntent(state: GraphState) {
  if (state.intent === "tour") return "prepareGenerate";
  return "retrieve";
}

function afterRetrieve(state: GraphState) {
  if (state.intent === "quote" || /(quote|estimate|price|cost|budget)/i.test(state.lastUserMessage)) {
    return "buildQuote";
  }
  return "prepareGenerate";
}

export function createAssistantGraph() {
  return new StateGraph(AgentState)
    .addNode("loadHistory", loadHistoryNode)
    .addNode("routeIntent", routeIntentNode)
    .addNode("retrieve", retrieveNode)
    .addNode("buildQuote", buildQuoteNode)
    .addNode("prepareGenerate", prepareGenerateNode)
    .addEdge(START, "loadHistory")
    .addEdge("loadHistory", "routeIntent")
    .addConditionalEdges("routeIntent", afterIntent, {
      retrieve: "retrieve",
      prepareGenerate: "prepareGenerate",
    })
    .addConditionalEdges("retrieve", afterRetrieve, {
      buildQuote: "buildQuote",
      prepareGenerate: "prepareGenerate",
    })
    .addEdge("buildQuote", "prepareGenerate")
    .addEdge("prepareGenerate", END)
    .compile();
}

let graph: ReturnType<typeof createAssistantGraph> | null = null;

export function assistantGraph() {
  graph ??= createAssistantGraph();
  return graph;
}
