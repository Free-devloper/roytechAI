import { handleVoiceRequest } from "@/lib/assistant/voice";

export async function GET(request: Request) {
  return handleVoiceRequest(request);
}

export async function POST(request: Request) {
  return handleVoiceRequest(request);
}

export async function OPTIONS() {
  return handleVoiceRequest(new Request("http://local/api/assistant/voice", { method: "OPTIONS" }));
}
