import { sendContactBrief } from "./contact-webhook";
import { corsHeaders, sseLine, visitorFromRequest } from "./http";
import { runAssistantTurn } from "./turn";
import type { ChatTurn, SseEvent } from "./types";

export async function handleAssistantRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
  }

  let body: { message?: string; history?: ChatTurn[]; leadName?: string; leadEmail?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400, headers: corsHeaders() });
  }

  const { visitorId, setCookie } = visitorFromRequest(request);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => controller.enqueue(encoder.encode(sseLine(event)));
      try {
        send({ type: "session", visitorId });
        await runAssistantTurn(
          {
            visitorId,
            message,
            history: body.history,
            leadName: body.leadName,
            leadEmail: body.leadEmail,
            source: "roytechai-assistant",
          },
          send,
        );
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : "Assistant failed.";
        send({ type: "error", message: errMessage });
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

export async function handleContactRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
  }
  try {
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      need?: string;
      brief?: string;
    };
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim() ?? "";
    const need = payload.need?.trim() ?? "";
    const brief = payload.brief?.trim() ?? "";
    if (!name || !email || !need || !brief) {
      return Response.json({ error: "name, email, need, and brief are required" }, { status: 400, headers: corsHeaders() });
    }
    await sendContactBrief({
      name,
      email,
      need,
      brief,
      timestamp: new Date().toISOString(),
      source: "contact-form",
    });
    return Response.json({ ok: true }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact request failed";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders() });
  }
}
