import type { IncomingMessage, ServerResponse } from "node:http";
import { handleContactRequest } from "../lib/assistant/handler";

export const config = {
  api: { bodyParser: false },
  maxDuration: 15,
};

async function toWebRequest(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const url = `https://${host}${req.url ?? "/api/contact"}`;
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
  const response = await handleContactRequest(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const text = await response.text();
  res.end(text);
}
