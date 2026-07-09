type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export type DeepSeekResult =
  | { ok: true; content: string }
  | { ok: false; reason: "missing_api_key" | "http_error" | "empty_content" | "network_error"; detail?: string };

export async function callDeepSeekJson(messages: DeepSeekMessage[]): Promise<string | null> {
  const result = await callDeepSeekJsonDetailed(messages);
  return result.ok ? result.content : null;
}

export async function callDeepSeekJsonDetailed(messages: DeepSeekMessage[]): Promise<DeepSeekResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, reason: "missing_api_key" };

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const controller = new AbortController();
  // Keep the demo snappy when an optional provider is slow or misconfigured.
  // Deterministic planning is intentionally good enough to ship the cut.
  const timeout = setTimeout(() => controller.abort(), 4500);

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
    const data = (await response.json().catch(() => ({}))) as DeepSeekChatResponse;
    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        detail: `${response.status} ${data.error?.code ?? data.error?.type ?? response.statusText}`
      };
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, reason: "empty_content" };
    return { ok: true, content };
  } catch {
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}
