const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function sleepFor(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function responseStatus(response) {
  return Number(response?.status ?? (response?.ok ? 200 : 500));
}

async function readResponseBody(response) {
  if (response && typeof response.json === "function") {
    try {
      return await response.json();
    } catch {
      // Some providers return a non-JSON body for a transient gateway error.
    }
  }
  if (response && typeof response.text === "function") {
    try {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return { rawText: text };
      }
    } catch {
      return null;
    }
  }
  return null;
}

function extractMessage(body) {
  return body?.choices?.[0]?.message ?? null;
}

function parseContent(message) {
  if (typeof message?.content !== "string") {
    return { ok: false, error: "provider response has no JSON content" };
  }
  try {
    return { ok: true, value: JSON.parse(message.content) };
  } catch {
    return { ok: false, error: "provider content is not valid JSON" };
  }
}

class OpenAIChatCompletionsProviderAdapter {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    modelVersion,
    endpoint = DEFAULT_ENDPOINT,
    fetchImpl = globalThis.fetch,
    maxAttempts = 3,
    backoffMs = 250,
    sleep = sleepFor,
  } = {}) {
    this.apiKey = apiKey;
    this.modelVersion = modelVersion;
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.maxAttempts = Number(maxAttempts);
    this.backoffMs = Number(backoffMs);
    this.sleep = sleep;
    if (!this.modelVersion) throw new Error("modelVersion is required");
    if (typeof this.fetchImpl !== "function") throw new Error("fetchImpl is required");
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 5) {
      throw new Error("maxAttempts must be an integer between 1 and 5");
    }
  }

  buildRequestBody({ customId, systemPrompt, userPrompt, responseSchema }) {
    return {
      model: this.modelVersion,
      user: customId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "restaurant_cuisine_classification",
          strict: true,
          schema: responseSchema,
        },
      },
    };
  }

  async classify({
    customId,
    promptVersion,
    systemPrompt,
    userPrompt,
    responseSchema,
    validationContext,
    validateResult,
  }) {
    if (!customId) throw new Error("customId is required");
    if (typeof validateResult !== "function") throw new Error("validateResult callback is required");
    const requestBody = this.buildRequestBody({ customId, systemPrompt, userPrompt, responseSchema });
    let lastError = "provider request failed";

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(requestBody),
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "provider network error";
        if (attempt < this.maxAttempts) {
          await this.sleep(this.backoffMs * (2 ** (attempt - 1)));
          continue;
        }
        return {
          status: "error",
          customId,
          promptVersion,
          modelVersion: this.modelVersion,
          attempts: attempt,
          errorCode: "NETWORK_ERROR",
          errorMessage: lastError,
        };
      }

      const status = responseStatus(response);
      const body = await readResponseBody(response);
      if (status < 200 || status >= 300) {
        lastError = body?.error?.message || `provider returned HTTP ${status}`;
        const retryable = status === 408 || status === 409 || status === 429 || status >= 500;
        if (retryable && attempt < this.maxAttempts) {
          await this.sleep(this.backoffMs * (2 ** (attempt - 1)));
          continue;
        }
        return {
          status: "error",
          customId,
          promptVersion,
          modelVersion: this.modelVersion,
          attempts: attempt,
          providerRequestId: response.headers?.get?.("x-request-id") ?? body?.id ?? null,
          errorCode: `HTTP_${status}`,
          errorMessage: lastError,
        };
      }

      const message = extractMessage(body);
      if (message?.refusal) {
        return {
          status: "refusal",
          customId,
          promptVersion,
          modelVersion: this.modelVersion,
          attempts: attempt,
          providerRequestId: body?.id ?? null,
          refusal: String(message.refusal),
        };
      }

      const content = parseContent(message);
      if (!content.ok) {
        lastError = content.error;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.backoffMs * (2 ** (attempt - 1)));
          continue;
        }
        return {
          status: "invalid",
          customId,
          promptVersion,
          modelVersion: this.modelVersion,
          attempts: attempt,
          providerRequestId: body?.id ?? null,
          errorCode: "INVALID_JSON",
          errorMessage: lastError,
        };
      }

      let validation;
      try {
        validation = validateResult(content.value, validationContext);
      } catch (error) {
        validation = {
          success: false,
          error: {
            issues: [{
              message: error instanceof Error ? error.message : "validation callback failed",
            }],
          },
        };
      }
      if (validation?.success) {
        return {
          status: "ok",
          customId,
          promptVersion,
          modelVersion: this.modelVersion,
          attempts: attempt,
          providerRequestId: body?.id ?? null,
          result: validation.data,
        };
      }

      lastError = validation?.error?.issues?.map((issue) => issue.message).join("; ") || "provider output failed schema validation";
      if (attempt < this.maxAttempts) {
        await this.sleep(this.backoffMs * (2 ** (attempt - 1)));
        continue;
      }
      return {
        status: "invalid",
        customId,
        promptVersion,
        modelVersion: this.modelVersion,
        attempts: attempt,
        providerRequestId: body?.id ?? null,
        errorCode: "SCHEMA_VALIDATION_FAILED",
        errorMessage: lastError,
      };
    }

    return {
      status: "error",
      customId,
      promptVersion,
      modelVersion: this.modelVersion,
      attempts: this.maxAttempts,
      errorCode: "RETRY_EXHAUSTED",
      errorMessage: lastError,
    };
  }
}

module.exports = {
  DEFAULT_ENDPOINT,
  OpenAIChatCompletionsProviderAdapter,
  parseContent,
  readResponseBody,
};
