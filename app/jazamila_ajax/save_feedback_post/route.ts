import { createFeedback } from "@/lib/domain/feedback";
import { htmlResponse, readRequestInput } from "@/lib/http";
import { publicWriteRateLimiter, rateLimitedHtmlResponse, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = publicWriteRateLimiter.check(rateLimitKey("feedback", request));
  if (!rateLimit.allowed) return rateLimitedHtmlResponse(rateLimit);

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
