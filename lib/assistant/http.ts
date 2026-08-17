import { VISITOR_COOKIE } from "./config";
import type { SseEvent } from "./types";

export function cookieValue(header: string | null, name: string) {
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function newVisitorId() {
  return crypto.randomUUID();
}

export function visitorCookie(id: string) {
  return `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
}

export function sseLine(event: SseEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

export function visitorFromRequest(request: Request) {
  const existingId = cookieValue(request.headers.get("cookie"), VISITOR_COOKIE);
  const visitorId = existingId || newVisitorId();
  return { visitorId, setCookie: existingId ? null : visitorCookie(visitorId) };
}
