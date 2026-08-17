"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeAssistantText, type QuoteResult } from "../../lib/assistant/types";
import AssistantMarkdown from "./AssistantMarkdown";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  quote?: QuoteResult;
  handoffSent?: boolean;
  action?: { kind: "navigate"; label: string; target: string };
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatTurn[];
};

type ChatStore = {
  activeId: string;
  conversations: Conversation[];
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

function storeKey(visitorId: string) {
  return `rt_chats_${visitorId}`;
}

function legacyKey(visitorId: string) {
  return `rt_chat_${visitorId}`;
}

function readVisitorId() {
  try {
    return localStorage.getItem("rt_vid");
  } catch {
    return null;
  }
}

function emptyConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function titleFromMessages(messages: ChatTurn[]) {
  const first = messages.find((turn) => turn.role === "user" && turn.content.trim());
  if (!first) return "New conversation";
  const text = first.content.trim().replace(/\s+/g, " ");
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function loadStore(visitorId: string): ChatStore {
  try {
    const raw = localStorage.getItem(storeKey(visitorId));
    if (raw) {
      const parsed = JSON.parse(raw) as ChatStore;
      if (parsed.conversations?.length) {
        const activeId = parsed.conversations.some((item) => item.id === parsed.activeId)
          ? parsed.activeId
          : parsed.conversations[0].id;
        return { activeId, conversations: parsed.conversations };
      }
    }
  } catch {
    // ignore
  }
  try {
    const legacy = localStorage.getItem(legacyKey(visitorId));
    if (legacy) {
      const messages = JSON.parse(legacy) as ChatTurn[];
      const conversation = {
        id: crypto.randomUUID(),
        title: titleFromMessages(messages),
        updatedAt: new Date().toISOString(),
        messages,
      };
      return { activeId: conversation.id, conversations: [conversation] };
    }
  } catch {
    // ignore
  }
  const conversation = emptyConversation();
  return { activeId: conversation.id, conversations: [conversation] };
}

function saveStore(visitorId: string, store: ChatStore) {
  localStorage.setItem("rt_vid", visitorId);
  localStorage.setItem(storeKey(visitorId), JSON.stringify(store));
}

function sectionLabel(target: string) {
  const key = target.replace(/^\/#/, "#").replace(/^\//, "");
  const labels: Record<string, string> = {
    "#top": "Home",
    "#why": "Why RoyTech AI",
    "#services": "Capabilities",
    "#method": "Delivery model",
    "#estimator": "Estimator",
    "#solutions": "Solutions",
    "#contact": "Contact",
    blog: "Blog",
  };
  return labels[key] || labels[`#${key}`] || "this section";
}

function navigateTo(target: string) {
  if (target.startsWith("/blog") || target === "blog") {
    if (window.location.pathname !== "/blog") window.location.href = "/blog";
    return;
  }
  const hash = target.includes("#") ? target.slice(target.indexOf("#") + 1) : "";
  if (window.location.pathname !== "/" && target.includes("#")) {
    window.location.href = target.startsWith("/") ? target : `/${target}`;
    return;
  }
  if (!hash) return;
  const element = document.getElementById(hash);
  if (!element) return;
  const headerOffset = 85;
  const offsetPosition = element.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
}

function patchLastAssistant(prev: ChatTurn[], patch: Partial<ChatTurn>) {
  const next = [...prev];
  const last = next[next.length - 1];
  if (last?.role === "assistant") {
    next[next.length - 1] = { ...last, ...patch, content: patch.content ?? last.content };
  }
  return next;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
  const [view, setView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => conversations.find((item) => item.id === activeId)?.messages ?? [],
    [conversations, activeId],
  );

  useEffect(() => {
    const id = readVisitorId() ?? crypto.randomUUID();
    const store = loadStore(id);
    setVisitorId(id);
    setActiveId(store.activeId);
    setConversations(store.conversations);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !visitorId || !activeId) return;
    try {
      saveStore(visitorId, { activeId, conversations });
    } catch {
      // ignore
    }
  }, [ready, visitorId, activeId, conversations]);

  useEffect(() => {
    if (view === "chat") {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open, pending, view]);

  const greeting = messages.length === 0
    ? "I am RoytechAI Assistant. I can walk you through the studio, answer build questions, sketch an indicative quote, and pass a brief to the team when a human should take over."
    : null;

  const startNewConversation = () => {
    if (pending) return;
    const current = conversations.find((item) => item.id === activeId);
    if (current && current.messages.length === 0) {
      setError(null);
      setView("chat");
      return;
    }
    const conversation = emptyConversation();
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setError(null);
    setView("chat");
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setError(null);
    setView("chat");
  };

  const deleteConversation = (id: string) => {
    if (pending && id === activeId) return;
    const target = conversations.find((item) => item.id === id);
    const label = target?.title || "this conversation";
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    setConversations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        const created = emptyConversation();
        setActiveId(created.id);
        setView("chat");
        return [created];
      }
      if (id === activeId) {
        setActiveId(next[0].id);
      }
      return next;
    });
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setError(null);
    setPending(true);
    setView("chat");
    const conversationId = activeId;
    const updateThis = (updater: (current: ChatTurn[]) => ChatTurn[]) => {
      setConversations((prev) =>
        prev.map((item) => {
          if (item.id !== conversationId) return item;
          const nextMessages = updater(item.messages);
          return {
            ...item,
            messages: nextMessages,
            title: titleFromMessages(nextMessages),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    };
    const history = messages.map((turn) => ({
      role: turn.role,
      content: turn.role === "assistant" ? sanitizeAssistantText(turn.content) : turn.content,
    }));
    updateThis((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
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
          updateThis((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") return prev;
            return patchLastAssistant(prev, {
              content: sanitizeAssistantText(last.content + event.content),
            });
          });
        }
        if (event.type === "navigate") {
          navigateTo(event.target);
          updateThis((prev) =>
            patchLastAssistant(prev, {
              action: { kind: "navigate", label: sectionLabel(event.target), target: event.target },
            }),
          );
        }
        if (event.type === "quote") {
          updateThis((prev) => patchLastAssistant(prev, { quote: event.quote }));
        }
        if (event.type === "handoff") {
          updateThis((prev) => patchLastAssistant(prev, { handoffSent: event.sent }));
        }
        if (event.type === "error") setError(event.message);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach RoytechAI Assistant.");
      updateThis((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) next.pop();
        return next;
      });
    } finally {
      setPending(false);
    }
  };

  const applyQuote = (quote: QuoteResult) => {
    window.dispatchEvent(
      new CustomEvent("roytech-apply-brief", {
        detail: `${quote.summary}\nScope: ${quote.scope}\nTimeline: ${quote.timeline}`,
      }),
    );
    navigateTo("/#contact");
  };

  const historyItems = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className={`rt-assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="rt-assistant-panel" aria-label="RoytechAI Assistant conversation">
          <header className="rt-assistant-head">
            <div>
              <small>ON-SITE GUIDE</small>
              <strong>{view === "history" ? "Chat history" : "RoytechAI Assistant"}</strong>
              {view === "chat" && (
                <span className="rt-assistant-thread-title">
                  {conversations.find((item) => item.id === activeId)?.title || "New conversation"}
                </span>
              )}
            </div>
            <button type="button" className="rt-assistant-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </header>
          <nav className="rt-assistant-nav" aria-label="Conversation controls">
            <button
              type="button"
              className={view === "history" ? "active" : ""}
              onClick={() => setView(view === "history" ? "chat" : "history")}
            >
              {view === "history" ? "Back to chat" : "History"}
            </button>
            <button type="button" onClick={startNewConversation} disabled={pending}>
              New chat
            </button>
          </nav>
          {view === "history" ? (
            <div className="rt-history">
              {historyItems.length === 0 && <p className="rt-history-empty">No saved conversations yet.</p>}
              {historyItems.map((item) => (
                <div className={`rt-history-item ${item.id === activeId ? "active" : ""}`} key={item.id}>
                  <button type="button" className="rt-history-open" onClick={() => openConversation(item.id)}>
                    <b>{item.title}</b>
                    <small>
                      {item.id === activeId ? "Current · " : ""}
                      {formatWhen(item.updatedAt)} · {item.messages.length} messages
                    </small>
                  </button>
                  <button
                    type="button"
                    className="rt-history-delete"
                    onClick={() => deleteConversation(item.id)}
                    disabled={pending && item.id === activeId}
                    aria-label={`Delete ${item.title}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="rt-assistant-thread" ref={listRef}>
                {greeting && (
                  <article className="rt-bubble assistant">
                    <AssistantMarkdown text={greeting} />
                  </article>
                )}
                {messages.map((turn, index) => {
                  const content =
                    turn.role === "assistant" ? sanitizeAssistantText(turn.content) : turn.content;
                  const waiting = pending && index === messages.length - 1 && turn.role === "assistant" && !content;
                  return (
                    <article className={`rt-bubble ${turn.role}`} key={`${turn.role}-${index}`}>
                    {waiting ? (
                      <p className="rt-thinking">Thinking…</p>
                    ) : turn.role === "assistant" ? (
                      <AssistantMarkdown text={content} />
                    ) : (
                      <p>{content}</p>
                    )}
                    {turn.action?.kind === "navigate" && (
                      <button type="button" className="rt-action-chip" onClick={() => navigateTo(turn.action!.target)}>
                        Showing {turn.action.label}
                      </button>
                    )}
                    {turn.quote && (
                      <div className="rt-quote-card">
                        <small>INDICATIVE RANGE</small>
                        <b>
                          {money.format(turn.quote.low)} – {money.format(turn.quote.high)}
                        </b>
                        <span>
                          {turn.quote.scope} · {turn.quote.timeline}
                        </span>
                        <button type="button" onClick={() => applyQuote(turn.quote!)}>
                          Add this to the contact brief
                        </button>
                      </div>
                    )}
                    {turn.handoffSent && <p className="rt-handoff-note">Brief sent to the RoyTech AI team.</p>}
                    </article>
                  );
                })}
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
            </>
          )}
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
