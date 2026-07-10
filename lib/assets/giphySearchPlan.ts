import type { CreativePlan } from "@/lib/types";

export type GiphySearch = { query: string; mode: "gifs" | "stickers" };

export function buildGiphySearches(plan: CreativePlan): GiphySearch[] {
  const curated = curatedQueriesForMood(plan.reactionMood);
  const celebrityQuery = curated[stableHash(plan.caption) % curated.length];
  const planQuery = plan.giphyQueries.find((query) => query.trim().toLowerCase() !== celebrityQuery.toLowerCase());
  return [
    { query: celebrityQuery, mode: "stickers" },
    { query: celebrityQuery, mode: "gifs" },
    ...(planQuery ? [{ query: planQuery, mode: "gifs" as const }] : [])
  ];
}

function curatedQueriesForMood(mood: CreativePlan["reactionMood"]): string[] {
  const byMood: Record<CreativePlan["reactionMood"], string[]> = {
    confused: ["The Rock eyebrow", "Kevin Hart confused", "Andrew Garfield confused"],
    shocked: ["IShowSpeed shocked", "Kevin Hart shocked", "The Rock shocked"],
    panic: ["Kevin Hart scared", "Tom Holland panic", "celebrity stressed"],
    relief: ["Snoop Dogg smile", "Kevin Hart relieved", "celebrity relief"],
    smug: ["The Rock eyebrow", "Andrew Garfield smug", "celebrity side eye"],
    crying: ["Kevin Hart crying", "celebrity crying", "defeated reaction"],
    celebrating: ["The Rock celebration", "Kevin Hart laughing", "happy dance reaction"]
  };
  return byMood[mood];
}

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}
