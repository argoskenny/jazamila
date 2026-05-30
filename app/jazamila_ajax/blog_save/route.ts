import { createBlogLinkSubmission } from "@/lib/domain/blogs";
import { jsonValidationError, readRequestInput } from "@/lib/http";
import { publicWriteRateLimiter, rateLimitedJsonResponse, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = publicWriteRateLimiter.check(rateLimitKey("blog-save", request));
  if (!rateLimit.allowed) return rateLimitedJsonResponse(rateLimit);

  try {
    const input = await readRequestInput(request);
    await createBlogLinkSubmission(input);
    return Response.json({ status: "success" });
  } catch (error) {
    return jsonValidationError(error);
  }
}
