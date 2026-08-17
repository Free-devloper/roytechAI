import { sendContactBrief } from "./contact-webhook";
import { persistTurn, persistVisitor } from "./db";
import { assistantGraph } from "./graph";
import { streamChat, toOpenRouterMessages } from "./openrouter";
import { VISITOR_COOKIE } from "./config";
import { cleanLeadName } from "./prepare";
import { HANDOFF_RE, NAVIGATE_RE, sanitizeAssistantText, type ChatTurn, type SseEvent } from "./types";
import { TOUR_CLOSE, TOUR_INTRO, TOUR_STOPS, isSiteTour, tourStepMarkdown } from "./tour";

function cookieValue(header: string | null, name: string) {
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function newVisitorId() {
  return crypto.randomUUID();
}

function visitorCookie(id: string) {
  return `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
}

function sseLine(event: SseEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function stripControl(text: string) {
  return sanitizeAssistantText(text, false);
}

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const existingId = cookieValue(request.headers.get("cookie"), VISITOR_COOKIE);
  const visitorId = existingId || newVisitorId();
  const setCookie = existingId ? null : visitorCookie(visitorId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => controller.enqueue(encoder.encode(sseLine(event)));
      try {
        send({ type: "session", visitorId });
        const graph = assistantGraph();
        const state = await graph.invoke({
          visitorId,
          lastUserMessage: message,
          clientHistory: body.history ?? [],
          clientLeadName: body.leadName ?? null,
          clientLeadEmail: body.leadEmail ?? null,
        });

        if (state.quote) send({ type: "quote", quote: state.quote });
        if (state.intent !== "tour" && state.navigateTo) send({ type: "navigate", target: state.navigateTo });

        if (state.intent === "tour" || isSiteTour(message)) {
          let spoken = TOUR_INTRO;
          send({ type: "token", content: TOUR_INTRO });
          for (const stop of TOUR_STOPS) {
            send({ type: "navigate", target: stop.target });
            const step = tourStepMarkdown(stop);
            spoken += step;
            send({ type: "token", content: step });
            await wait(2400);
          }
          send({ type: "navigate", target: "/#top" });
          await wait(900);
          spoken += TOUR_CLOSE;
          send({ type: "token", content: TOUR_CLOSE });
          await persistTurn(visitorId, { role: "user", content: message });
          await persistTurn(visitorId, { role: "assistant", content: spoken });
          await persistVisitor(visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
          send({ type: "done" });
          return;
        }

        let raw = "";
        let flushed = "";
        const llmMessages = toOpenRouterMessages(state.systemPrompt, state.messages.slice(-12));
        for await (const token of streamChat(llmMessages)) {
          raw += token;
          const visible = sanitizeAssistantText(raw, true);
          if (visible.length > flushed.length) {
            send({ type: "token", content: visible.slice(flushed.length) });
            flushed = visible;
          }
        }
        const finalVisible = sanitizeAssistantText(raw, false);
        if (finalVisible.length > flushed.length) {
          send({ type: "token", content: finalVisible.slice(flushed.length) });
        }

        const navigateMatch = [...raw.matchAll(NAVIGATE_RE)].pop();
        if (navigateMatch && !state.navigateTo) {
          send({ type: "navigate", target: navigateMatch[1] });
        }

        const wantsHandoff = state.handoffNeeded || HANDOFF_RE.test(raw);
        let handoffSent = state.handoffSent;
        if (wantsHandoff) {
          const missing = missingLead(state.leadName, state.leadEmail);
          if (missing) {
            send({ type: "handoff", sent: false, missing });
            if (!hasCorrectLeadAsk(raw, missing)) {
              const ask =
                missing === "both"
                  ? "\n\nI can pass this to a human on the RoyTech AI team. Please share your name and email."
                  : missing === "name"
                    ? "\n\nI have your email. Please share your name so the team can follow up."
                    : "\n\nI have your name. Please share your email so the team can follow up.";
              send({ type: "token", content: ask });
              raw += ask;
            }
          } else if (!handoffSent) {
            await sendContactBrief({
              name: state.leadName as string,
              email: state.leadEmail as string,
              need: state.compiledNeed,
              brief: state.compiledBrief,
              timestamp: new Date().toISOString(),
              source: "roytechai-assistant",
            });
            handoffSent = true;
            await persistVisitor(visitorId, {
              leadName: cleanLeadName(state.leadName),
              leadEmail: state.leadEmail,
              handoffSent: true,
            });
            const confirm = "\n\nI have sent your brief to the RoyTech AI team. Someone will follow up.";
            send({ type: "token", content: confirm });
            send({ type: "handoff", sent: true });
            raw += confirm;
          } else {
            send({ type: "handoff", sent: true });
          }
        }

        const assistantText = stripControl(raw) || "I am here to help with RoyTech AI services, quotes, and site navigation.";
        await persistTurn(visitorId, { role: "user", content: message });
        await persistTurn(visitorId, { role: "assistant", content: assistantText });
        await persistVisitor(visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
        send({ type: "done" });
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

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}
