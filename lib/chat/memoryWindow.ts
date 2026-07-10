import type { ConversationMemoryEntry } from "@/lib/types";

const MAX_MEMORY_ENTRIES = 12;

export function appendMemory(
  current: ConversationMemoryEntry[],
  candidate: ConversationMemoryEntry | null
): ConversationMemoryEntry[] {
  if (!candidate) return current;
  return [...current, candidate].slice(-MAX_MEMORY_ENTRIES);
}
