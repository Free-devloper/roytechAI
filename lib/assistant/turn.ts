import { sendContactBrief } from "./contact-webhook";
import { persistTurn, persistVisitor } from "./db";
import { assistantGraph } from "./graph";
import { streamChat, toOpenRouterMessages } from "./openrouter";
import { cleanLeadName, historyHasLeadAsk, historyShowsHandoffSent } from "./prepare";
import { clipDurationMs, estimateSpeechMs, takeSentences, type SpeechClip } from "./speech";
import {
  HANDOFF_CALL_RE,
  HANDOFF_RE,
  extractNavigateTargets,
  sanitizeAssistantText,
  type ChatTurn,
  type Intent,
  type SseEvent,
} from "./types";
import { TOUR_CLOSE, TOUR_INTRO, TOUR_STOPS, isSiteTour, isTourAdvance, lastTourStopIndex, tourStepMarkdown } from "./tour";

const CLOSE_OFFER = " Would you like me to end the call, or is there something else I can help with?";
const CLOSE_OFFER_RE = /would you like me to end the call/i;

const LIVE_CALL_RULES = `

You are on a live voice call. You have the same capabilities as the on-site text assistant: site tour, section navigation, indicative quotes, and human handoff through the contact brief.
- If they ask to tour the site, or say next during a tour, the product plays the remaining stops. Do not walk the tour yourself and do not wait for "next".
- Never emit tool-call markup such as <|tool_call_start|>, NAVIGATE('...'), or function calls. The only hidden controls are [[NAVIGATE:/#services]], [[HANDOFF]], and [[END_CALL]].
- If they want the contact form, put [[NAVIGATE:/#contact]] and collect any missing name and email, then [[HANDOFF]].
- After the current request is finished — quote given, section shown, brief sent, or question answered — do not hang up yet. Ask once whether they want to end the call or need something else. Do not emit [[END_CALL]] until they confirm they are done.
- If they confirm they are finished — goodbye, hang up, that's all, or yes after you asked to end — say a short closing line, then put [[END_CALL]] alone on the last line.
- Do not end the call while you are still collecting a name, email, or project brief.`;

function hasToken(pattern: RegExp, text: string) {
  pattern.lastIndex = 0;
  return pattern.test(text);
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

function lastOfferedClose(history: ChatTurn[]) {
  const last = [...history].reverse().find((turn) => turn.role === "assistant");
  return Boolean(last && CLOSE_OFFER_RE.test(last.content));
}

function isCloseConfirm(text: string) {
  const trimmed = text.trim();
  return (
    isHangupRequest(trimmed) ||
    /^(yes|yeah|yep|sure|please|ok|okay)\b/i.test(trimmed) ||
    /\b(yes please|please do|go ahead|that'?s (it|all)|nothing else|i(?:'m| am) good|we(?:'re| are) done|end it)\b/i.test(
      trimmed,
    )
  );
}

function isCloseDecline(text: string) {
  return /\b(no|nope|not yet|don'?t(?: you)? (?:end|hang)|wait|hold on|something else|another (question|thing)|keep going)\b/i.test(
    text,
  );
}

function isNewWorkIntent(intent: Intent) {
  return intent === "quote" || intent === "tour" || intent === "navigate" || intent === "handoff";
}

function assistantStillCollecting(raw: string) {
  return /(?:share|send|leave|what(?:'s| is))\s+your\s+(?:name|email)|name and email|so the team can follow up/i.test(raw);
}

export function isHangupRequest(text: string) {
  return /\b(good\s?bye|bye now|hang up|end (the )?(call|conversation|chat)|that'?s all(?: for now)?|nothing else|i(?:'m| am) done)\b/i.test(
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
  let handoffSent = state.handoffSent || historyShowsHandoffSent(state.messages);
  let raw = "";

  await persistVisitor(input.visitorId, {
    leadName: cleanLeadName(state.leadName),
    leadEmail: state.leadEmail,
  });

  if (state.quote) send({ type: "quote", quote: state.quote });
  if (state.intent !== "tour" && state.navigateTo) send({ type: "navigate", target: state.navigateTo });

  let speakTail = Promise.resolve();
  const emitSpoken = (text: string, waitFor = true) => {
    const visible = sanitizeAssistantText(text, false).trim();
    if (!visible) return speakTail.then(() => 0);
    let duration = estimateSpeechMs(visible);
    if (!speak) {
      send({ type: "token", content: visible });
      return speakTail.then(() => duration);
    }
    const clipPromise = speak(visible);
    speakTail = speakTail.then(async () => {
      try {
        const clip = await clipPromise;
        if (clip) {
          duration = clipDurationMs(clip) || duration;
          send({ type: "audio", content: visible, ...clip });
        } else send({ type: "token", content: visible });
      } catch {
        send({ type: "token", content: visible });
      }
    });
    return (waitFor ? speakTail : Promise.resolve()).then(() => duration);
  };

  const shouldSubmitLeads = (spoken = raw) => {
    if (missingLead(state.leadName, state.leadEmail) || handoffSent) return false;
    return (
      state.handoffNeeded ||
      hasToken(HANDOFF_RE, spoken) ||
      hasToken(HANDOFF_CALL_RE, spoken) ||
      historyHasLeadAsk(state.messages) ||
      /(talk to (a )?human|contact (the )?team|hire|start a build)/i.test(message)
    );
  };

  const submitHandoffIfReady = async () => {
    if (!shouldSubmitLeads()) return false;
    try {
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
      return true;
    } catch (err) {
      console.error("Contact webhook failed", err);
      const fail =
        "\n\nI have your name and email, but I could not send the brief just now. You can also use the contact form on the site.";
      send({ type: "handoff", sent: false });
      await emitSpoken(fail);
      raw += fail;
      return false;
    }
  };

  const userConfirmedHangup = Boolean(
    input.allowHangup &&
      (isHangupRequest(message) ||
        (lastOfferedClose(state.messages) && isCloseConfirm(message) && !isCloseDecline(message) && !isNewWorkIntent(state.intent))),
  );

  if (userConfirmedHangup) {
    await submitHandoffIfReady();
    const closing = " Thanks for calling. I'll end the live conversation now.";
    await emitSpoken(closing);
    raw += closing;
    const assistantText = sanitizeAssistantText(raw, false) || closing.trim();
    await persistTurn(input.visitorId, { role: "user", content: message });
    await persistTurn(input.visitorId, { role: "assistant", content: assistantText });
    await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
    send({ type: "hangup" });
    send({ type: "done" });
    return;
  }

  const continueTour = isTourAdvance(message) && lastTourStopIndex(state.messages) >= 0;
  const playTour = state.intent === "tour" || isSiteTour(message) || continueTour;
  if (playTour) {
    const startAt =
      continueTour && !isSiteTour(message) ? Math.min(TOUR_STOPS.length, lastTourStopIndex(state.messages) + 1) : 0;
    const stops = TOUR_STOPS.slice(startAt);
    let spoken = startAt === 0 ? TOUR_INTRO : "";
    if (startAt === 0) {
      const introMs = await emitSpoken(TOUR_INTRO);
      if (!speak) await wait(introMs);
    }
    if (stops.length === 0) {
      spoken += TOUR_CLOSE;
      const closeMs = await emitSpoken(TOUR_CLOSE);
      if (!speak) await wait(closeMs);
    } else {
      for (const stop of stops) {
        send({ type: "navigate", target: stop.target });
        const step = tourStepMarkdown(stop);
        spoken += step;
        const stepMs = await emitSpoken(step);
        if (!speak) await wait(stepMs);
      }
      send({ type: "navigate", target: "/#top" });
      spoken += TOUR_CLOSE;
      const closeMs = await emitSpoken(TOUR_CLOSE);
      if (!speak) await wait(closeMs);
    }
    if (input.allowHangup && !CLOSE_OFFER_RE.test(spoken)) {
      spoken += CLOSE_OFFER;
      await emitSpoken(CLOSE_OFFER);
    }
    await persistTurn(input.visitorId, { role: "user", content: message });
    await persistTurn(input.visitorId, { role: "assistant", content: spoken });
    await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
    send({ type: "done" });
    return;
  }

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

  const wantsHandoff =
    state.handoffNeeded ||
    hasToken(HANDOFF_RE, raw) ||
    hasToken(HANDOFF_CALL_RE, raw) ||
    historyHasLeadAsk(state.messages);
  const justSentHandoff = await submitHandoffIfReady();
  if (wantsHandoff && !justSentHandoff && !handoffSent) {
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
    } else {
      send({ type: "handoff", sent: true });
    }
  } else if (handoffSent && wantsHandoff && !justSentHandoff) {
    send({ type: "handoff", sent: true });
  }

  const intentDone =
    Boolean(state.quote) ||
    justSentHandoff ||
    state.intent === "navigate" ||
    (state.intent === "handoff" && handoffSent && !assistantStillCollecting(raw)) ||
    (state.intent === "qa" && !assistantStillCollecting(raw) && !/\?\s*$/.test(sanitizeAssistantText(raw, false).trim()));
  if (
    input.allowHangup &&
    intentDone &&
    !assistantStillCollecting(raw) &&
    !CLOSE_OFFER_RE.test(raw)
  ) {
    await emitSpoken(CLOSE_OFFER);
    raw += CLOSE_OFFER;
  }

  const assistantText =
    sanitizeAssistantText(raw, false) || "I am here to help with RoyTech AI services, quotes, and site navigation.";
  await persistTurn(input.visitorId, { role: "user", content: message });
  await persistTurn(input.visitorId, { role: "assistant", content: assistantText });
  await persistVisitor(input.visitorId, { leadName: cleanLeadName(state.leadName), leadEmail: state.leadEmail });
  send({ type: "done" });
}
