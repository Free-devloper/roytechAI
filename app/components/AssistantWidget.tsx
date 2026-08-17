"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatTurn = { role: "user" | "assistant"; content: string };

type QuoteResult = {
  scope: string;
  timeline: string;
  low: number;
  high: number;
  summary: string;
};

type SseEvent =
  | { type: "session"; visitorId: string }
  | { type: "token"; content: string }
  | { type: "navigate"; target: string }
  | { type: "quote"; quote: QuoteResult }
  | { type: "handoff"; sent: boolean; missing?: "name" | "email" | "both" }
  | { type: "done" }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "Tour the site",
  "Who is Rehan?",
  "Estimate an AI agent build",
  "How do you deliver?",
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function storageKey(id: string) {
  return `rt_chat_${id}`;
}

function readVisitorId() {
  try {
    return localStorage.getItem("rt_vid");
  } catch {
    return null;
  }
}

function navigateTo(target: string) {
  if (target.startsWith("/blog")) {
    if (window.location.pathname !== "/blog") window.location.href = target;
    return;
  }
  const hash = target.includes("#") ? target.slice(target.indexOf("#") + 1) : "";
  if (window.location.pathname !== "/" && target.startsWith("/#")) {
    window.location.href = target;
    return;
  }
  if (!hash) return;
  const element = document.getElementById(hash);
  if (!element) return;
  const headerOffset = 85;
  const offsetPosition = element.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
}

async function parseSse(response: Response, onEvent: (event: SseEvent) => void) {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as SseEvent);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [handoffSent, setHandoffSent] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = readVisitorId();
    if (!id) return;
    setVisitorId(id);
    try {
      const saved = localStorage.getItem(storageKey(id));
      if (saved) setMessages(JSON.parse(saved) as ChatTurn[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!visitorId) return;
    try {
      localStorage.setItem("rt_vid", visitorId);
      localStorage.setItem(storageKey(visitorId), JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
  }, [visitorId, messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, pending]);

  const greeting = useMemo(
    () =>
      messages.length === 0
        ? "I am RoytechAI Assistant. I can walk you through the studio, answer build questions, sketch an indicative quote, and pass a brief to the team when a human should take over."
        : null,
    [messages.length],
  );

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setError(null);
    setPending(true);
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          leadName: null,
          leadEmail: null,
        }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Assistant request failed");
      }
      await parseSse(response, (event) => {
        if (event.type === "session") setVisitorId(event.visitorId);
        if (event.type === "token") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + event.content };
            }
            return next;
          });
        }
        if (event.type === "navigate") navigateTo(event.target);
        if (event.type === "quote") setQuote(event.quote);
        if (event.type === "handoff") setHandoffSent(event.sent);
        if (event.type === "error") setError(event.message);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach RoytechAI Assistant.");
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) next.pop();
        return next;
      });
    } finally {
      setPending(false);
    }
  };

  const applyQuote = () => {
    if (!quote) return;
    window.dispatchEvent(
      new CustomEvent("roytech-apply-brief", {
        detail: `${quote.summary}\nScope: ${quote.scope}\nTimeline: ${quote.timeline}`,
      }),
    );
    navigateTo("/#contact");
  };

  return (
    <div className={`rt-assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="rt-assistant-panel" aria-label="RoytechAI Assistant conversation">
          <header className="rt-assistant-head">
            <div>
              <small>ON-SITE GUIDE</small>
              <strong>RoytechAI Assistant</strong>
            </div>
            <button type="button" className="rt-assistant-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </header>
          <div className="rt-assistant-thread" ref={listRef}>
            {greeting && (
              <article className="rt-bubble assistant">
                <p>{greeting}</p>
              </article>
            )}
            {messages.map((turn, index) => (
              <article className={`rt-bubble ${turn.role}`} key={`${turn.role}-${index}`}>
                <p>{turn.content || (pending && index === messages.length - 1 ? "Thinking…" : "")}</p>
              </article>
            ))}
            {quote && (
              <div className="rt-quote-card">
                <small>INDICATIVE RANGE</small>
                <b>
                  {money.format(quote.low)} – {money.format(quote.high)}
                </b>
                <span>{quote.scope} · {quote.timeline}</span>
                <button type="button" onClick={applyQuote}>
                  Add this to the contact brief
                </button>
              </div>
            )}
            {handoffSent && <p className="rt-handoff-note">Brief sent to the RoyTech AI team.</p>}
            {error && <p className="rt-assistant-error">{error}</p>}
          </div>
          <div className="rt-suggestions">
            {SUGGESTIONS.map((item) => (
              <button type="button" key={item} onClick={() => send(item)} disabled={pending}>
                {item}
              </button>
            ))}
          </div>
          <form
            className="rt-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about agents, quotes, or a section…"
              aria-label="Message RoytechAI Assistant"
              disabled={pending}
            />
            <button type="submit" disabled={pending || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="rt-assistant-fab"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close RoytechAI Assistant" : "Open RoytechAI Assistant"}
      >
        <span className="mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
    </div>
  );
}
