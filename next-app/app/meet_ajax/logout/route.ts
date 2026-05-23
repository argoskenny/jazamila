import { clearMeetSession } from "@/lib/auth/meet";

export async function POST() {
  await clearMeetSession();
  return Response.json({ status: "success" });
}
