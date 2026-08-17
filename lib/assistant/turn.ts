import { sendContactBrief } from "./contact-webhook";
import { persistTurn, persistVisitor } from "./db";
import { assistantGraph } from "./graph";
import { streamChat, toOpenRouterMessages } from "./openrouter";
import { cleanLeadName } from "./prepare";
import { takeSentences, type SpeechClip } from "./speech";
import { END_CALL_RE, HANDOFF_RE, extractNavigateTargets, sanitizeAssistantText, type ChatTurn, type SseEvent } from "./types";
import { TOUR_CLOSE, TOUR_INTRO, TOUR_STOPS, isSiteTour, isTourAdvance, lastTourStopIndex, tourStepMarkdown } from "./tour";

const LIVE_CALL_RULES = `

You are on a live voice call. You have the same capabilities as the on-site text assistant: site tour, section navigation, indicative quotes, and human handoff through the contact brief.
- If they ask to tour the site, or say next during a tour, the product plays the remaining stops. Do not walk the tour yourself and do not wait for "next".
- Never emit tool-call markup such as <|tool_call_start|>, NAVIGATE('...'), or function calls. The only hidden controls are [[NAVIGATE:/#services]], [[HANDOFF]], and [[END_CALL]].
- If they want the contact form, put [[NAVIGATE:/#contact]] and collect any missing name and email, then [[HANDOFF]].
- When the visitor is finished — goodbye, hang up, end the call, or they confirm they do not need more after a brief is sent — say a short closing line, then put [[END_CALL]] alone on the last line. That ends the live call the same way the End button does.
- Do not end the call while you are still collecting a name, email, or project brief.`;

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

export function isHangupRequest(text: string) {
  return /\b(good\s?bye|bye now|hang up|end (the )?(call|conversation|chat)|that'?s all for now|i(?:'m| am) done)\b/i.test(
    text,
  );
}

export async function runAssistantTurn(
  input: {
    visitorId: string;
    message: string;
    history?: ChatTurn[];
    leadName?: string | null;
    leadEmail?: string | null;
    source?: string;
    allowHangup?: boolean;
  },
  send: (event: SseEvent) => void,
  speak?: (text: string) => Promise<SpeechClip | null>,
) {
  const message = input.message.trim();
  const graph = assistantGraph();
  const state = await graph.invoke({
    visitorId: input.visitorId,
    lastUserMessage: message,
    clientHistory: input.history ?? [],
    clientLeadName: input.leadName ?? null,
    clientLeadEmail: input.leadEmail ?? null,
  });
  const systemPrompt = input.allowHangup ? `${state.systemPrompt}${LIVE_CALL_RULES}` : state.systemPrompt;

  if (state.quote) send({ type: "quote", quote: state.quote });
  if (state.intent !== "tour" && state.navigateTo) send({ type: "navigate", target: state.navigateTo });

  let speakTail = Promise.resolve();
  const emitSpoken = (text: string, waitFor = true) => {
    const visible = sanitizeAssistantText(text, false).trim();
    if (!visible) return speakTail;
    if (!speak) {
      send({ type: "token", content: visible });
      return speakTail;
    }
    const clipPromise = speak(visible);
    speakTail = speakTail.then(async () => {
      try {
        const clip = await clipPromise;
        if (clip) send({ type: "audio", content: visible, ...clip });
        else send({ type: "token", content: visible });
      } catch {
        send({ type: "token", content: visible });
      }
    });
    return waitFor ? speakTail : Promise.resolve();
  };

  const continueTour = isTourAdvance(message) && lastTourStopIndex(state.messages) >= 0;
  const playTour = state.intent === "tour" || isSiteTour(message) || continueTour;
  if (playTour) {
    const startAt =
      continueTour && !isSiteTour(message) ? Math.min(TOUR_STOPS.length, lastTourStopIndex(state.messages) + 1) : 0;
    const stops = TOUR_STOPS.slice(startAt);
    let spoken = startAt === 0 ? TOUR_INTRO : "";
    if (startAt === 0) await emitSpoken(TOUR_INTRO);
    if (stops.length === 0) {
      spoken += TOUR_CLOSE;
      await emitSpoken(TOUR_CLOSE);
    } else {
      for (const stop of stops) {
        send({ type: "navigate", target: stop.target });
        const step = tourStepMarkdown(stop);
        spoken += step;
        const started = Date.now();
        await emitSpoken(step);
        const remaining = 2400 - (Date.now() - started);
        if (remaining > 0) await wait(remaining);
      }
      send({ type: "navigate", target: "/#top" });
      await wait(900);
      spoken += TOUR_CLOSE;
      await emitSpoken(TOUR_CLOSE);
    }
    await persistTurn(input.visitorId, { role: "user", content: message });
    await persistTurn(input.visitorId, { role: "assistant", content: spoken });
    await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
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
      flushed = visible;
      if (speak) {
        speakBuf += delta;
        const { ready, rest } = takeSentences(speakBuf);
        speakBuf = rest;
        for (const sentence of ready) void emitSpoken(sentence, false);
      } else {
        send({ type: "token", content: delta });
      }
    }
  }
  const finalVisible = sanitizeAssistantText(raw, false);
  if (finalVisible.length > flushed.length) {
    const delta = finalVisible.slice(flushed.length);
    flushed = finalVisible;
    if (speak) speakBuf += delta;
    else send({ type: "token", content: delta });
  }
  if (speak && speakBuf.trim()) void emitSpoken(speakBuf, false);
  await speakTail;

  const navigateMatch = extractNavigateTargets(raw).pop();
  if (navigateMatch && !state.navigateTo) send({ type: "navigate", target: navigateMatch });

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
        await emitSpoken(ask);
        raw += ask;
      }
    } else if (!handoffSent) {
      await sendContactBrief({
        name: state.leadName as string,
        email: state.leadEmail as string,
        need: state.compiledNeed,
        brief: state.compiledBrief,
        timestamp: new Date().toISOString(),
        source: input.source ?? "roytechai-assistant",
      });
      handoffSent = true;
      await persistVisitor(input.visitorId, {
        leadName: cleanLeadName(state.leadName),
        leadEmail: state.leadEmail,
        handoffSent: true,
      });
      const confirm = "\n\nI have sent your brief to the RoyTech AI team. Someone will follow up.";
      send({ type: "handoff", sent: true });
      await emitSpoken(confirm);
      raw += confirm;
    } else {
      send({ type: "handoff", sent: true });
    }
  }

  const userWantsHangup = Boolean(input.allowHangup && isHangupRequest(message));
  const modelWantsHangup = Boolean(input.allowHangup && END_CALL_RE.test(raw));
  if (userWantsHangup && !modelWantsHangup) {
    const closing = " Thanks for calling. I'll end the live conversation now.";
    await emitSpoken(closing);
    raw += closing;
  }
  if (input.allowHangup && (modelWantsHangup || userWantsHangup)) {
    send({ type: "hangup" });
  }

  const assistantText =
    sanitizeAssistantText(raw, false) || "I am here to help with RoyTech AI services, quotes, and site navigation.";
  await persistTurn(input.visitorId, { role: "user", content: message });
  await persistTurn(input.visitorId, { role: "assistant", content: assistantText });
  await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
  send({ type: "done" });
}
