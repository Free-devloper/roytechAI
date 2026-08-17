import { handleContactRequest } from "@/lib/assistant/handler";

export async function POST(request: Request) {
  return handleContactRequest(request);
}

export async function OPTIONS() {
  return handleContactRequest(new Request("http://local/api/contact", { method: "OPTIONS" }));
}
