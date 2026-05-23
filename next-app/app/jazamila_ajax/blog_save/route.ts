import { createBlogLinkSubmission } from "@/lib/domain/blogs";
import { jsonValidationError, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    await createBlogLinkSubmission(input);
    return Response.json({ status: "success" });
  } catch (error) {
    return jsonValidationError(error);
  }
}
