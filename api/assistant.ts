import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAssistantRequest } from "../lib/assistant/handler";

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

async function toWebRequest(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const url = `https://${host}${req.url ?? "/api/assistant"}`;
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
  const request = await toWebRequest(req);
  const response = await handleAssistantRequest(request);
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
}
