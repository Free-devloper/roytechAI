import type { IncomingMessage, ServerResponse } from "node:http";
import { handleVoiceRequest } from "../lib/assistant/voice";

export const config = {
  maxDuration: 60,
};

async function toWebRequest(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const url = `https://${host}${req.url ?? "/api/voice"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  return new Request(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (String(req.headers.upgrade || "").toLowerCase() === "websocket") {
    res.statusCode = 426;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Connection", "close");
    res.end(JSON.stringify({ error: "WebSocket upgrades are not available on this host." }));
    return;
  }
  try {
    const request = await toWebRequest(req);
    const response = await handleVoiceRequest(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    if (!response.body) {
      res.end();
      return;
    }
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice invocation failed";
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
    }
    res.end(JSON.stringify({ error: message }));
  }
}
