const MAX_RECENT_REACTIONS = 6;

export function appendRecentReactionId(current: string[], candidate?: string): string[] {
  if (!candidate) return current;
  return [...current.filter((id) => id !== candidate), candidate].slice(-MAX_RECENT_REACTIONS);
}
