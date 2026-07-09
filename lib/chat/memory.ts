import type { ConversationMemoryEntry } from "@/lib/types";
import { extractFirstUrl } from "@/lib/scraping/extractUrl";

const MAX_MEMORY_ENTRIES = 5;
const MAX_SUMMARY_LENGTH = 140;
const MAX_RAW_TEXT_LENGTH = 260;

export function buildMemoryEntry(input: {
  role: "user" | "assistant";
  text: string;
  resultCaption?: string;
}): ConversationMemoryEntry | null {
  const normalized = normalize(input.text);
  if (!normalized) return null;

  const type = classifyMemoryType(input.role, normalized, Boolean(input.resultCaption));
  if (!type) return null;

  const summary = summarize(type, normalized, input.resultCaption);
  return {
    role: input.role,
    type,
    summary: truncate(summary, MAX_SUMMARY_LENGTH),
    rawText: truncate(normalized, MAX_RAW_TEXT_LENGTH)
  };
}

export function appendMemory(
  current: ConversationMemoryEntry[],
  candidate: ConversationMemoryEntry | null
): ConversationMemoryEntry[] {
  if (!candidate) return current;
  const next = [...current, candidate];
  return next.slice(-MAX_MEMORY_ENTRIES);
}

export function formatConversationMemory(memory: ConversationMemoryEntry[] | undefined): string {
  if (!memory?.length) return "Conversation memory: none";
  return [
    "Conversation memory:",
    ...memory.map((entry, index) => `${index + 1}. ${entry.role} | ${entry.type} | ${entry.summary}`)
  ].join("\n");
}

function classifyMemoryType(
  role: "user" | "assistant",
  text: string,
  hasResultCaption: boolean
): ConversationMemoryEntry["type"] | null {
  if (role === "assistant" && hasResultCaption) return "result_summary";
  if (extractFirstUrl(text)) return "product_input";
  if (/^(yes|yep|yeah|yes video|video|make video|make the video|generate video|go ahead|go on)$/i.test(text)) {
    return "generation_request";
  }
  if (/funnier|dramatic|less cringe|chaotic|genz|premium|cleaner|tone it down/.test(text)) {
    return "vibe_change";
  }
  if (/issue|wrong|bad|cut|cropped|sticker|gif|person|meme|celebrity|fix|change|better|not working|problem/.test(text)) {
    return "feedback";
  }
  if (role === "user" && text.split(/\s+/).length >= 5) return "clarification";
  return null;
}

function summarize(
  type: ConversationMemoryEntry["type"],
  text: string,
  resultCaption?: string
): string {
  if (type === "result_summary" && resultCaption) {
    return `Generated cut with caption: ${resultCaption}`;
  }
  return text;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}
