import { callDeepSeekJsonDetailed } from "@/lib/llm/deepseek";
import { formatConversationMemory } from "@/lib/chat/memory";
import type { ProductUnderstanding } from "@/lib/types";
import { logger } from "@/lib/utils/logger";
import type { ConversationMemoryEntry } from "@/lib/types";

type ChatReply = {
  reply: string;
};

export async function replyConversationally(
  message: string,
  previousProduct?: ProductUnderstanding,
  conversationMemory?: ConversationMemoryEntry[]
): Promise<string> {
  const fallback = deterministicReply(message, previousProduct);
  const result = await callDeepSeekJsonDetailed([
    {
      role: "system",
      content:
        "You are the chat layer for a startup UGC meme video generator. Reply naturally and briefly in JSON. Do not force every message into a URL request. If the user is just greeting you, greet them. If they ask what you do, explain in one sentence. If they want a video but gave no product URL or product description, ask for the missing info. Return JSON like {\"reply\":\"...\"}."
    },
    {
      role: "user",
      content: [
        `User message: ${message}`,
        previousProduct ? `Previous product context: ${JSON.stringify(previousProduct)}` : "Previous product context: none",
        formatConversationMemory(conversationMemory),
        "Return only JSON with a reply field."
      ].join("\n")
    }
  ]);

  if (!result.ok) {
    logger.warn("DeepSeek chat reply unavailable; using deterministic fallback", {
      reason: result.reason,
      detail: result.detail
    });
    return fallback;
  }

  try {
    const parsed = JSON.parse(result.content) as Partial<ChatReply>;
    return sanitizeReply(parsed.reply) || fallback;
  } catch (error) {
    logger.warn("DeepSeek chat reply returned invalid JSON; using deterministic fallback", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return fallback;
  }
}

function deterministicReply(message: string, previousProduct?: ProductUnderstanding): string {
  const normalized = message.trim().toLowerCase();
  if (/^(hi|hey|hello|yo|gm|good morning|sup)[!. ]*$/.test(normalized)) {
    return "hey - tell me what you're building, or paste a product URL when you want me to make the ad.";
  }
  if (/what can you do|how does this work|capabilit|help/.test(normalized)) {
    return "I can chat normally, read a product URL, write a meme-native caption, match assets, and render a short vertical MP4.";
  }
  if (previousProduct && /caption|idea|angle|better|change|edit/.test(normalized)) {
    return `I can revise the ${previousProduct.productName} cut. Try “make it funnier”, “less cringe”, or paste a more specific direction.`;
  }
  return "Got it. When you're ready for a video, send a product URL plus one line about what it does.";
}

function sanitizeReply(reply: unknown): string | null {
  if (typeof reply !== "string") return null;
  const clean = reply.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 500) return null;
  return clean;
}
