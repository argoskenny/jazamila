import { setMeetSession } from "@/lib/auth/meet";
import { registerMeetUser } from "@/lib/domain/meet";
import { jsonValidationError, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    const user = await registerMeetUser(input);
    await setMeetSession(user.id);
    return Response.json({ status: "success", id: user.id });
  } catch (error) {
    return jsonValidationError(error);
  }
}
