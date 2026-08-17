import { sendContactBrief } from "./contact-webhook";
import { persistTurn, persistVisitor } from "./db";
import { assistantGraph } from "./graph";
import { corsHeaders, sseLine, visitorFromRequest } from "./http";
import { streamChat, toOpenRouterMessages } from "./openrouter";
import { cleanLeadName } from "./prepare";
import { synthesizeSpeech, takeSentences, transcribeAudio } from "./speech";
import { HANDOFF_RE, NAVIGATE_RE, sanitizeAssistantText, type ChatTurn, type SseEvent } from "./types";
import { isSiteTour } from "./tour";

const MAX_AUDIO_CHARS = 2_000_000;
const VOICE_GREETING =
  "You're on a live call with RoytechAI Assistant. Ask about the studio, a quote, or how we deliver.";
const VOICE_TOUR =
  "I can walk the site in the chat panel. Stay on this call and ask about a section, a quote, or how we deliver.";
const VOICE_STYLE = `

The visitor is speaking on a live voice call. Answer in short spoken sentences. Do not use markdown tables, headings, or code fences. Hidden [[NAVIGATE]] and [[HANDOFF]] lines are still allowed.`;

type VoiceBody = {
  action?: "start" | "utterance";
  audio?: string;
  format?: string;
  history?: ChatTurn[];
  leadName?: string;
  leadEmail?: string;
  message?: string;
};

function missingLead(name: string | null, email: string | null): "name" | "email" | "both" | null {
  const hasName = Boolean(cleanLeadName(name));
  const hasEmail = Boolean(email);
  if (!hasName && !hasEmail) return "both";
  if (!hasName) return "name";
  if (!hasEmail) return "email";
  return null;
}

function hasCorrectLeadAsk(raw: string, missing: "name" | "email" | "both") {
  const text = raw.toLowerCase();
  const claimedName = /i have your name/.test(text);
  if (missing === "both") return /name/.test(text) && /email/.test(text) && !claimedName;
  if (missing === "name") return /share your name|your name/.test(text) && !claimedName;
  return /share your email|your email/.test(text) && claimedName;
}

async function speakAndSend(text: string, send: (event: SseEvent) => void) {
  const clip = await synthesizeSpeech(text);
  if (clip) send({ type: "audio", ...clip });
}

export async function emitVoiceTurn(
  input: {
    visitorId: string;
    message?: string;
    audio?: string;
    format?: string;
    history?: ChatTurn[];
    leadName?: string | null;
    leadEmail?: string | null;
    greeting?: boolean;
  },
  send: (event: SseEvent) => void,
) {
  send({ type: "session", visitorId: input.visitorId });

  if (input.greeting) {
    send({ type: "hello" });
    send({ type: "token", content: VOICE_GREETING });
    await speakAndSend(VOICE_GREETING, send);
    send({ type: "done" });
    return;
  }

  let message = input.message?.trim() ?? "";
  if (!message && input.audio) {
    if (input.audio.length > MAX_AUDIO_CHARS) throw new Error("Audio clip is too large.");
    message = await transcribeAudio(input.audio, input.format || "webm");
  }
  if (!message) throw new Error("I did not catch that. Please try again.");
  send({ type: "transcript", text: message });

  const graph = assistantGraph();
  const state = await graph.invoke({
    visitorId: input.visitorId,
    lastUserMessage: message,
    clientHistory: input.history ?? [],
    clientLeadName: input.leadName ?? null,
    clientLeadEmail: input.leadEmail ?? null,
  });
  const systemPrompt = `${state.systemPrompt}${VOICE_STYLE}`;

  if (state.quote) send({ type: "quote", quote: state.quote });
  if (state.intent !== "tour" && state.navigateTo) send({ type: "navigate", target: state.navigateTo });

  if (state.intent === "tour" || isSiteTour(message)) {
    send({ type: "token", content: VOICE_TOUR });
    await speakAndSend(VOICE_TOUR, send);
    await persistTurn(input.visitorId, { role: "user", content: message });
    await persistTurn(input.visitorId, { role: "assistant", content: VOICE_TOUR });
    send({ type: "done" });
    return;
  }

  let raw = "";
  let flushed = "";
  let speakBuf = "";
  const llmMessages = toOpenRouterMessages(systemPrompt, state.messages.slice(-12));
  for await (const token of streamChat(llmMessages)) {
    raw += token;
    const visible = sanitizeAssistantText(raw, true);
    if (visible.length > flushed.length) {
      const delta = visible.slice(flushed.length);
      send({ type: "token", content: delta });
      flushed = visible;
      speakBuf += delta;
      const { ready, rest } = takeSentences(speakBuf);
      speakBuf = rest;
      for (const sentence of ready) await speakAndSend(sentence, send);
    }
  }
  const finalVisible = sanitizeAssistantText(raw, false);
  if (finalVisible.length > flushed.length) {
    send({ type: "token", content: finalVisible.slice(flushed.length) });
    speakBuf += finalVisible.slice(flushed.length);
  }
  if (speakBuf.trim()) await speakAndSend(speakBuf, send);

  const navigateMatch = [...raw.matchAll(NAVIGATE_RE)].pop();
  if (navigateMatch && !state.navigateTo) send({ type: "navigate", target: navigateMatch[1] });

  const wantsHandoff = state.handoffNeeded || HANDOFF_RE.test(raw);
  let handoffSent = state.handoffSent;
  if (wantsHandoff) {
    const missing = missingLead(state.leadName, state.leadEmail);
    if (missing) {
      send({ type: "handoff", sent: false, missing });
      if (!hasCorrectLeadAsk(raw, missing)) {
        const ask =
          missing === "both"
            ? " I can pass this to a human on the RoyTech AI team. Please share your name and email."
            : missing === "name"
              ? " I have your email. Please share your name so the team can follow up."
              : " I have your name. Please share your email so the team can follow up.";
        send({ type: "token", content: ask });
        await speakAndSend(ask, send);
        raw += ask;
      }
    } else if (!handoffSent) {
      await sendContactBrief({
        name: state.leadName as string,
        email: state.leadEmail as string,
        need: state.compiledNeed,
        brief: state.compiledBrief,
        timestamp: new Date().toISOString(),
        source: "roytechai-assistant-voice",
      });
      handoffSent = true;
      await persistVisitor(input.visitorId, {
        leadName: cleanLeadName(state.leadName),
        leadEmail: state.leadEmail,
        handoffSent: true,
      });
      const confirm = " I have sent your brief to the RoyTech AI team. Someone will follow up.";
      send({ type: "token", content: confirm });
      send({ type: "handoff", sent: true });
      await speakAndSend(confirm, send);
      raw += confirm;
    } else {
      send({ type: "handoff", sent: true });
    }
  }

  const assistantText = sanitizeAssistantText(raw, false) || "I am here to help with RoyTech AI services, quotes, and site navigation.";
  await persistTurn(input.visitorId, { role: "user", content: message });
  await persistTurn(input.visitorId, { role: "assistant", content: assistantText });
  await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
  send({ type: "done" });
}

export async function handleVoiceRequest(request: Request) {
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return handleVoiceUpgrade(request);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
  }

  let body: VoiceBody;
  try {
    body = (await request.json()) as VoiceBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  const { visitorId, setCookie } = visitorFromRequest(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => controller.enqueue(encoder.encode(sseLine(event)));
      try {
        await emitVoiceTurn(
          {
            visitorId,
            message: body.message,
            audio: body.audio,
            format: body.format,
            history: body.history,
            leadName: body.leadName,
            leadEmail: body.leadEmail,
            greeting: body.action === "start" || (!body.audio && !body.message),
          },
          send,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Voice session failed.";
        send({ type: "error", message });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    ...Object.fromEntries(corsHeaders()),
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(stream, { status: 200, headers });
}

export function handleVoiceUpgrade(request: Request) {
  const Pair = (globalThis as { WebSocketPair?: new () => { 0: WebSocket; 1: WebSocket } }).WebSocketPair;
  if (!Pair) {
    return Response.json(
      { error: "WebSocket upgrades are not available on this host. Use the streaming voice endpoint." },
      { status: 426, headers: corsHeaders() },
    );
  }
  const pair = new Pair();
  const client = pair[0];
  const server = pair[1] as WebSocket & { accept(): void };
  server.accept();
  void runVoiceSocket(server, request);
  return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
}

async function runVoiceSocket(socket: WebSocket, request: Request) {
  const { visitorId } = visitorFromRequest(request);
  const send = (event: SseEvent) => {
    try {
      socket.send(JSON.stringify(event));
    } catch {
      // socket closed
    }
  };
  let queue = Promise.resolve();
  socket.addEventListener("message", (event) => {
    queue = queue.then(async () => {
      try {
        const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
        const body = JSON.parse(raw) as VoiceBody & { type?: string };
        const action = body.action || (body.type === "start" ? "start" : "utterance");
        await emitVoiceTurn(
          {
            visitorId,
            message: body.message,
            audio: body.audio,
            format: body.format,
            history: body.history,
            leadName: body.leadName,
            leadEmail: body.leadEmail,
            greeting: action === "start",
          },
          send,
        );
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Voice session failed." });
        send({ type: "done" });
      }
    });
  });
  socket.addEventListener("error", () => {
    try {
      socket.close();
    } catch {
      // ignore
    }
  });
}
