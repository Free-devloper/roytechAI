import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnv() {
  if (typeof process === "undefined" || process.env.OPENROUTER_API_KEY) return;
  for (const name of [".env", ".dev.vars"]) {
    try {
      const text = readFileSync(join(process.cwd(), name), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // optional local files
    }
  }
}

loadLocalEnv();

export const VISITOR_COOKIE = "rt_vid";

export const DEFAULT_CONTACT_WEBHOOK =
  "https://n8n.roytechworkforce.com/webhook/9b6f37a2-7c09-47ba-b379-6f2554adb1f3";

export const NEED_OPTIONS = [
  "Build an MVP",
  "Add AI to a product",
  "Modernize existing software",
  "Build a custom platform",
  "Extend an engineering team",
  "Automation and integrations",
] as const;

export type NeedOption = (typeof NEED_OPTIONS)[number];

export function env(name: string, fallback = "") {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export function chatModel() {
  return env("OPENROUTER_CHAT_MODEL", "openrouter/free");
}

export function ttsModel() {
  return env("OPENROUTER_TTS_MODEL", "deepgram/flux-tts:free");
}

export function ttsVoice() {
  return env("OPENROUTER_TTS_VOICE", "flux-alexis-en");
}

export function sttModel() {
  return env("OPENROUTER_STT_MODEL", "openai/whisper-1");
}

export function embeddingModel() {
  return env("OPENROUTER_EMBEDDING_MODEL", "qwen/qwen3-embedding-8b");
}

export function openRouterKey() {
  return env("OPENROUTER_API_KEY");
}

export function contactWebhookUrl() {
  return env("CONTACT_WEBHOOK_URL", DEFAULT_CONTACT_WEBHOOK);
}

export function contactJwtSecret() {
  return env("CONTACT_JWT_SECRET", "Letmein@321");
}
