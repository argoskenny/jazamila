import { ZodError } from "zod";

export const defaultMaxBodyBytes = 64 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

async function readLimitedBody(request: Request, maxBodyBytes: number): Promise<ArrayBuffer> {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer as ArrayBuffer;
}

export async function readRequestInput(
  request: Request,
  { maxBodyBytes = defaultMaxBodyBytes }: { maxBodyBytes?: number } = {}
): Promise<Record<string, FormDataEntryValue | string>> {
  const contentType = request.headers.get("content-type") ?? "";
  const body = await readLimitedBody(request, maxBodyBytes);

  if (contentType.includes("application/json")) {
    const text = new TextDecoder().decode(body);
    return (text ? JSON.parse(text) : {}) as Record<string, string>;
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const bufferedRequest = new Request(request.url, {
    method: request.method,
    headers,
    body: new Blob([body])
  });
  const formData = await bufferedRequest.formData();
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
