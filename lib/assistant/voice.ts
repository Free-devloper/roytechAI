import { corsHeaders, sseLine, visitorFromRequest } from "./http";
import { synthesizeSpeech, transcribeAudio } from "./speech";
import { runAssistantTurn } from "./turn";
import type { ChatTurn, SseEvent } from "./types";

const MAX_AUDIO_CHARS = 2_000_000;
const VOICE_GREETING =
  "You're on a live call with RoytechAI Assistant. I can walk you through the site, sketch a quote, or pass a brief to the team.";

type VoiceBody = {
  action?: "start" | "utterance";
  audio?: string;
  format?: string;
  history?: ChatTurn[];
  leadName?: string;
  leadEmail?: string;
  message?: string;
};

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
    const clip = await synthesizeSpeech(VOICE_GREETING);
    if (clip) send({ type: "audio", content: VOICE_GREETING, ...clip });
    else send({ type: "token", content: VOICE_GREETING });
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

  await runAssistantTurn(
    {
      visitorId: input.visitorId,
      message,
      history: input.history,
      leadName: input.leadName,
      leadEmail: input.leadEmail,
      source: "roytechai-assistant-voice",
      allowHangup: true,
    },
    send,
    (text) => synthesizeSpeech(text),
  );
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
