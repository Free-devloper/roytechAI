import { handleAssistantRequest } from "@/lib/assistant/handler";

export async function POST(request: Request) {
  return handleAssistantRequest(request);
}

export async function OPTIONS() {
  return handleAssistantRequest(new Request("http://local/api/assistant/chat", { method: "OPTIONS" }));
}
