import { openRouterKey, sttModel, ttsModel, ttsVoice } from "./config";
import { sanitizeAssistantText } from "./types";

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

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type SpeechClip = {
  mime: string;
  data: string;
  rate?: number;
};

export async function transcribeAudio(audioBase64: string, format: string) {
  const clean = audioBase64.replace(/^data:[^;]+;base64,/, "");
  const candidates = Array.from(new Set([sttModel(), "openai/whisper-1", "openai/gpt-4o-mini-transcribe"]));
  let lastError = "No transcription model succeeded.";
  for (const model of candidates) {
    const response = await fetch(`${OPENROUTER_URL}/audio/transcriptions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model,
        language: "en",
        input_audio: { data: clean, format },
      }),
    });
    if (response.ok) {
      const json = (await response.json()) as { text?: string };
      const text = json.text?.trim() ?? "";
      if (text) return text;
      lastError = "Transcription was empty.";
      continue;
    }
    lastError = `Transcription failed (${response.status}): ${await response.text()}`;
  }
  throw new Error(lastError);
}

export async function synthesizeSpeech(input: string): Promise<SpeechClip | null> {
  const text = speakableText(input);
  if (!text) return null;
  const formats: Array<{ response_format: "mp3" | "pcm"; mime: string; rate?: number }> = [
    { response_format: "mp3", mime: "audio/mpeg" },
    { response_format: "pcm", mime: "audio/pcm", rate: 24000 },
  ];
  let lastError = "Speech synthesis failed.";
  for (const format of formats) {
    const response = await fetch(`${OPENROUTER_URL}/audio/speech`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: ttsModel(),
        input: text,
        voice: ttsVoice(),
        response_format: format.response_format,
      }),
    });
    if (!response.ok) {
      lastError = `Speech request failed (${response.status}): ${await response.text()}`;
      continue;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 32) continue;
    const contentType = response.headers.get("content-type") || format.mime;
    const mime = contentType.includes("pcm") ? "audio/pcm" : contentType.includes("wav") ? "audio/wav" : "audio/mpeg";
    return {
      mime,
      data: bytesToBase64(bytes),
      rate: mime === "audio/pcm" ? format.rate : undefined,
    };
  }
  console.warn(lastError);
  return null;
}

export function speakableText(text: string) {
  return sanitizeAssistantText(text, false)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, ", ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function takeSentences(buffer: string) {
  const ready: string[] = [];
  const re = /[.!?]["')\]]*(?:\s+|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(buffer))) {
    const sentence = buffer.slice(last, match.index + 1).trim();
    last = match.index + match[0].length;
    if (sentence.length < 8) {
      if (ready.length) ready[ready.length - 1] += ` ${sentence}`;
      continue;
    }
    ready.push(sentence);
  }
  return { ready, rest: buffer.slice(last) };
}
