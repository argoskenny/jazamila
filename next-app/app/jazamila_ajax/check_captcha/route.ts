import { htmlResponse, readRequestInput } from "@/lib/http";

export async function POST(request: Request) {
  const input = await readRequestInput(request);
  const captcha = String(input.captcha ?? "");
  return htmlResponse(captcha === "1234" ? "success" : "fail");
}
