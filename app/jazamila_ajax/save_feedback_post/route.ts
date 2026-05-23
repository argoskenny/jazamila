import { createFeedback } from "@/lib/domain/feedback";
import { htmlResponse, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    await createFeedback({
      name: input.name,
      email: input.email,
      content: input.content
    });
    return htmlResponse("success");
  } catch {
    return htmlResponse("fail", { status: 422 });
  }
}
