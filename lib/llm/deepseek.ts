type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekCallOptions = {
  timeoutMs?: number;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export type JsonLlmProvider = "openrouter" | "deepseek";

export type DeepSeekResult =
  | { ok: true; content: string; elapsedMs: number; provider: JsonLlmProvider; model: string }
  | {
      ok: false;
      reason: "missing_api_key" | "http_error" | "empty_content" | "timeout" | "network_error";
      detail?: string;
      elapsedMs: number;
      provider?: JsonLlmProvider;
      model?: string;
    };

export async function callDeepSeekJson(messages: DeepSeekMessage[], options?: DeepSeekCallOptions): Promise<string | null> {
  const result = await callDeepSeekJsonDetailed(messages, options);
  return result.ok ? result.content : null;
}

export async function callDeepSeekJsonDetailed(
  messages: DeepSeekMessage[],
  options?: DeepSeekCallOptions
): Promise<DeepSeekResult> {
  const providers = providerOrder();
  if (providers.length === 0) return { ok: false, reason: "missing_api_key", elapsedMs: 0 };

  let lastFailure: DeepSeekResult | null = null;
  for (const provider of providers) {
    const result = provider === "openrouter"
      ? await callOpenRouterJson(messages, options)
      : await callDeepSeekProvider(messages, options);
    if (result.ok) return result;
    lastFailure = result;
  }

  return lastFailure ?? { ok: false, reason: "network_error", elapsedMs: 0 };
}

async function callDeepSeekProvider(
  messages: DeepSeekMessage[],
  options?: DeepSeekCallOptions
): Promise<DeepSeekResult> {
  const startedAt = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_api_key", elapsedMs: Date.now() - startedAt, provider: "deepseek" };

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
  const controller = new AbortController();
  // 30 s default — reasoning models (e.g. deepseek-v4-pro when LLM_PROVIDER
  // does not pin deepseek-chat) often burn 10-20 s in chain-of-thought; the
  // old 4.5 s default aborted before any payload arrived, cascading to the
  // deterministic fallback and generic captions.
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        response_format: { type: "json_object" },
        max_tokens: 1200,
        temperature: 0.7
      })
    });
    const rawBody = await response.text();
    const data = (rawBody ? JSON.parse(rawBody) : {}) as DeepSeekChatResponse;
    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        detail: `${response.status} ${data.error?.code ?? data.error?.type ?? response.statusText}`,
        elapsedMs: Date.now() - startedAt,
        provider: "deepseek",
        model
      };
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        reason: "empty_content",
        detail: rawBody.slice(0, 300),
        elapsedMs: Date.now() - startedAt,
        provider: "deepseek",
        model
      };
    }
    return { ok: true, content, elapsedMs: Date.now() - startedAt, provider: "deepseek", model };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        reason: "timeout",
        detail: `aborted after ${timeoutMs}ms`,
        elapsedMs,
        provider: "deepseek",
        model
      };
    }
    return {
      ok: false,
      reason: "network_error",
      detail: error instanceof Error ? error.message : "unknown",
      elapsedMs,
      provider: "deepseek",
      model
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenRouterJson(
  messages: DeepSeekMessage[],
  options?: DeepSeekCallOptions
): Promise<DeepSeekResult> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_api_key", elapsedMs: Date.now() - startedAt, provider: "openrouter" };

  const model = process.env.OPENROUTER_TEXT_MODEL
    || process.env.OPENROUTER_VISION_MODEL
    || "qwen/qwen3-vl-30b-a3b-thinking";
  const timeoutMs = options?.timeoutMs ?? 6000;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_APP_URL ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL } : {}),
        ...(process.env.OPENROUTER_APP_TITLE ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE } : {})
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const rawBody = await response.text();
    const data = (rawBody ? JSON.parse(rawBody) : {}) as DeepSeekChatResponse;
    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        detail: `${response.status} ${data.error?.code ?? data.error?.message ?? response.statusText}`,
        elapsedMs: Date.now() - startedAt,
        provider: "openrouter",
        model
      };
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        reason: "empty_content",
        detail: rawBody.slice(0, 300),
        elapsedMs: Date.now() - startedAt,
        provider: "openrouter",
        model
      };
    }
    return { ok: true, content, elapsedMs: Date.now() - startedAt, provider: "openrouter", model };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        reason: "timeout",
        detail: `aborted after ${timeoutMs}ms`,
        elapsedMs,
        provider: "openrouter",
        model
      };
    }
    return {
      ok: false,
      reason: "network_error",
      detail: error instanceof Error ? error.message : "unknown",
      elapsedMs,
      provider: "openrouter",
      model
    };
  }
}

function providerOrder(): JsonLlmProvider[] {
  const configured = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (configured === "deepseek") return ["deepseek", "openrouter"];
  if (configured === "openrouter" || configured === "vl") return ["openrouter", "deepseek"];
  return ["openrouter", "deepseek"];
}
