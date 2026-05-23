import { ZodError } from "zod";

export async function readRequestInput(request: Request): Promise<Record<string, FormDataEntryValue | string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, string>;
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export function htmlResponse(content: string, init?: ResponseInit): Response {
  return new Response(content, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

export function jsonValidationError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ status: "fail", errors: error.flatten().fieldErrors }, { status: 422 });
  }

  return Response.json({ status: "fail" }, { status: 500 });
}
