import { setMeetSession } from "@/lib/auth/meet";
import { loginMeetUser } from "@/lib/domain/meet";
import { jsonValidationError, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = await readRequestInput(request);
    const user = await loginMeetUser(input);
    if (!user) {
      return Response.json({ status: "fail" }, { status: 401 });
    }

    await setMeetSession(user.id);
    return Response.json({ status: "success", id: user.id });
  } catch (error) {
    return jsonValidationError(error);
  }
}
