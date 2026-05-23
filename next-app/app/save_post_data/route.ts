import { createRestaurantPost } from "@/lib/domain/posts";
import { jsonValidationError, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    await createRestaurantPost(input);
    return Response.json({ status: "success" });
  } catch (error) {
    return jsonValidationError(error);
  }
}
