import { createFeedback } from "@/lib/domain/feedback";
import { htmlResponse, readRequestInput } from "@/lib/http";
import { publicWriteRateLimiter, rateLimitedHtmlResponse, rateLimitKey } from "@/lib/rate-limit";
import { verifyRequestRecaptcha } from "@/lib/recaptcha";

export async function POST(request: Request) {
  const rateLimit = publicWriteRateLimiter.check(rateLimitKey("feedback", request));
  if (!rateLimit.allowed) return rateLimitedHtmlResponse(rateLimit);

  try {
    const input = await readRequestInput(request);
    const recaptcha = await verifyRequestRecaptcha(request, input, "feedback");
    if (!recaptcha.ok) return htmlResponse("fail", { status: 403 });

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
