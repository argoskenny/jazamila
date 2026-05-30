import { createRestaurantPost } from "@/lib/domain/posts";
import { jsonValidationError, readRequestInput } from "@/lib/http";
import { publicWriteRateLimiter, rateLimitedJsonResponse, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = publicWriteRateLimiter.check(rateLimitKey("restaurant-post", request));
  if (!rateLimit.allowed) return rateLimitedJsonResponse(rateLimit);

  try {
    const input = await readRequestInput(request);
    await createRestaurantPost(input);
    return Response.json({ status: "success" });
  } catch (error) {
    return jsonValidationError(error);
  }
}
