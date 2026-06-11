import { ZodError } from "zod";

export const defaultMaxBodyBytes = 64 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readRequestInput(
  request: Request,
  { maxBodyBytes = defaultMaxBodyBytes }: { maxBodyBytes?: number } = {}
): Promise<Record<string, FormDataEntryValue | string>> {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new RequestBodyTooLargeError();
  }

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
  if (error instanceof RequestBodyTooLargeError) {
    return Response.json({ status: "fail", error: "request_too_large" }, { status: 413 });
  }

  if (error instanceof ZodError) {
    return Response.json({ status: "fail", errors: error.flatten().fieldErrors }, { status: 422 });
  }

  return Response.json({ status: "fail" }, { status: 500 });
}

export function htmlRequestError(error: unknown): Response {
  if (error instanceof RequestBodyTooLargeError) {
    return htmlResponse("fail", { status: 413 });
  }

  return htmlResponse("fail", { status: 422 });
}
