import { contactJwtSecret, contactWebhookUrl } from "./config";

function base64UrlEncode(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function strToBase64Url(str: string) {
  return base64UrlEncode(new TextEncoder().encode(str));
}

export async function createContactJwt(secret: string): Promise<string> {
  const header = strToBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = strToBase64Url(JSON.stringify({ iss: "roytech", iat: Math.floor(Date.now() / 1000) }));
  const dataToSign = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataToSign));
  return `${dataToSign}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;
}

export type ContactPayload = {
  name: string;
  email: string;
  need: string;
  brief: string;
  timestamp: string;
  source?: string;
};

export async function sendContactBrief(payload: ContactPayload) {
  const secret = contactJwtSecret();
  if (!secret) {
    throw new Error("CONTACT_JWT_SECRET is not configured.");
  }
  const jwtToken = await createContactJwt(secret);
  const response = await fetch(contactWebhookUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Contact webhook failed (${response.status}) ${detail}`.trim());
  }
  return true;
}
