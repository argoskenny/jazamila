import { getMeetSession } from "@/lib/auth/meet";
import { updateMeetProfile } from "@/lib/domain/meet";
import { jsonValidationError, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getMeetSession();
  if (!user) {
    return Response.json({ status: "unauthorized" }, { status: 401 });
  }

  try {
    const input = await readRequestInput(request);
    const updated = await updateMeetProfile(user.id, input);
    return Response.json({ status: "success", id: updated.id });
  } catch (error) {
    return jsonValidationError(error);
  }
}
