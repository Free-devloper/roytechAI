import { chatModel, embeddingModel, openRouterKey } from "./config";
import type { ChatTurn } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1";

function headers() {
  const key = openRouterKey();
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://www.roytechworkforce.com",
    "X-Title": "RoytechAI Assistant",
  };
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const candidates = Array.from(
    new Set([
      embeddingModel(),
      "qwen/qwen3-embedding-8b",
      "qwen/qwen3-embedding-4b",
      "openai/text-embedding-3-small",
    ]),
  );
  let lastError = "No embedding model succeeded.";
  for (const model of candidates) {
    const response = await fetch(`${OPENROUTER_URL}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model, input: inputs }),
    });
    if (response.ok) {
      const json = (await response.json()) as { data: Array<{ embedding: number[]; index: number }> };
      return json.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
    }
    lastError = `Embedding request failed (${response.status}): ${await response.text()}`;
  }
  throw new Error(lastError);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

type ChatChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

export async function* streamChat(messages: Array<{ role: string; content: string }>) {
  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: chatModel(),
      stream: true,
      messages,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed (${response.status}): ${await response.text()}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as ChatChunk;
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // ignore keepalives
      }
    }
  }
}

export function toOpenRouterMessages(system: string, history: ChatTurn[]) {
  return [
    { role: "system", content: system },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];
}
