import { createRestaurantPost } from "@/lib/domain/posts";
import { jsonValidationError, readRequestInput } from "@/lib/http";
import { publicWriteRateLimiter, rateLimitedJsonResponse, rateLimitKey } from "@/lib/rate-limit";
import { verifyRequestRecaptcha } from "@/lib/recaptcha";

export async function POST(request: Request) {
  const rateLimit = publicWriteRateLimiter.check(rateLimitKey("restaurant-post", request));
  if (!rateLimit.allowed) return rateLimitedJsonResponse(rateLimit);

  try {
    const input = await readRequestInput(request);
    const recaptcha = await verifyRequestRecaptcha(request, input, "restaurant_post");
    if (!recaptcha.ok) return Response.json({ status: "fail", error: "recaptcha" }, { status: 403 });

    await createRestaurantPost(input);
    return Response.json({ status: "success" });
  } catch (error) {
    return jsonValidationError(error);
  }
}
