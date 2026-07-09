import type { CreativePlan, ReactionAsset } from "@/lib/types";
import { logger } from "@/lib/utils/logger";

type GiphyResponse = {
  data?: Array<{
    id: string;
    title?: string;
    rating?: string;
    images?: {
      fixed_height?: GiphyRendition;
      fixed_height_small?: GiphyRendition;
      fixed_width_still?: GiphyRendition;
      fixed_height_still?: GiphyRendition;
      original?: GiphyRendition;
      original_still?: GiphyRendition;
    };
  }>;
};

type GiphyRendition = {
  mp4?: string;
  webp?: string;
  url?: string;
  width?: string;
  height?: string;
};

type SearchMode = "gifs" | "stickers";

type CacheEntry = {
  expiresAt: number;
  assets: ReactionAsset[];
};

const SAFE_RATINGS = new Set(["g", "pg", "pg-13"]);
const CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_LIMIT = 6;
const RESULT_LIMIT = 8;
const cache = new Map<string, CacheEntry>();

export async function fetchGiphyCandidates(plan: CreativePlan): Promise<ReactionAsset[]> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return [];

  const candidates = new Map<string, ReactionAsset>();
  const queries = dedupeQueries([...plan.giphyQueries, ...curatedQueriesForMood(plan.reactionMood)]).slice(0, QUERY_LIMIT);

  const searches = queries.flatMap((query) => modesForQuery(query).map((mode) => ({ query, mode })));
  const results = await Promise.allSettled(
    searches.map(({ query, mode }) => fetchQueryMode({ apiKey, query, mode, mood: plan.reactionMood }))
  );
  results.forEach((result, index) => {
    const { query, mode } = searches[index];
    if (result.status === "fulfilled") {
      result.value.forEach((asset) => candidates.set(asset.id, asset));
      return;
    }
    logger.warn("GIPHY fetch failed; continuing with other reaction searches", {
      query,
      mode,
      error: result.reason instanceof Error ? result.reason.message : "unknown"
    });
  });

  return [...candidates.values()];
}

async function fetchQueryMode(input: {
  apiKey: string;
  query: string;
  mode: SearchMode;
  mood: CreativePlan["reactionMood"];
}): Promise<ReactionAsset[]> {
  const cacheKey = `${input.mode}:${input.query}:${input.mood}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.assets;
  }

  const params = new URLSearchParams({
    api_key: input.apiKey,
    q: input.query,
    limit: String(RESULT_LIMIT),
    rating: "pg-13",
    lang: "en"
  });
  const response = await fetch(`https://api.giphy.com/v1/${input.mode}/search?${params.toString()}`, {
    signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) {
    throw new Error(`GIPHY ${input.mode} search failed with ${response.status}`);
  }

  const payload = (await response.json()) as GiphyResponse;
  const assets = (payload.data ?? [])
    .map((item) => toReactionAsset(item, input))
    .filter((asset): asset is ReactionAsset => Boolean(asset));

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    assets
  });

  return assets;
}

function toReactionAsset(
  item: NonNullable<GiphyResponse["data"]>[number],
  input: { query: string; mode: SearchMode; mood: CreativePlan["reactionMood"] }
): ReactionAsset | null {
  const rating = item.rating?.toLowerCase() ?? "pg";
  if (!SAFE_RATINGS.has(rating)) return null;

  const title = item.title?.trim();
  const transparent = input.mode === "stickers" || /sticker|transparent/i.test(`${input.query} ${title ?? ""}`);
  const rendition = pickBestRendition(
    item.images?.fixed_height,
    item.images?.fixed_height_small,
    item.images?.original,
    transparent
  );
  if (!rendition?.url || !rendition.type) return null;

  return {
    id: `giphy-${input.mode}-${item.id}`,
    source: "giphy",
    filePathOrUrl: rendition.url,
    previewImageUrl: pickPreviewImageUrl(item.images),
    type: rendition.type,
    mood: input.mood,
    energy: energyForMood(input.mood),
    action: actionForMood(input.mood),
    hasTransparentBackground: transparent,
    width: Number(rendition.width ?? 360),
    height: Number(rendition.height ?? 360),
    loopable: true,
    preferredPosition: "bottom-center",
    preferredScale: transparent ? 0.92 : 1,
    rating: rating as ReactionAsset["rating"],
    tags: tokenize(`${input.query} ${title ?? ""} ${input.mode}`),
    title,
    queryUsed: input.query
  };
}

function pickPreviewImageUrl(
  images: NonNullable<GiphyResponse["data"]>[number]["images"]
): string | undefined {
  return (
    images?.fixed_height_still?.url ??
    images?.fixed_width_still?.url ??
    images?.original_still?.url ??
    images?.fixed_height?.url ??
    images?.fixed_height_small?.url ??
    images?.original?.url
  );
}

function pickBestRendition(
  ...input: Array<GiphyRendition | boolean | undefined>
): { url?: string; type?: ReactionAsset["type"]; width?: string; height?: string } | null {
  const preferAlpha = input.at(-1) === true;
  const renditions = input.filter((value): value is GiphyRendition => typeof value === "object" && value !== null);
  if (preferAlpha) {
    for (const rendition of renditions) {
      if (rendition.webp) {
        return { url: rendition.webp, type: "gif", width: rendition.width, height: rendition.height };
      }
    }
  }
  for (const rendition of renditions) {
    if (!rendition) continue;
    if (rendition.mp4) {
      return { url: rendition.mp4, type: "mp4", width: rendition.width, height: rendition.height };
    }
    if (rendition.url) {
      return { url: rendition.url, type: "gif", width: rendition.width, height: rendition.height };
    }
  }
  return null;
}

function modesForQuery(query: string): SearchMode[] {
  if (/sticker|transparent|overlay|cutout/i.test(query)) return ["stickers", "gifs"];
  return ["gifs", "stickers"];
}

function curatedQueriesForMood(mood: CreativePlan["reactionMood"]): string[] {
  const common = ["celebrity reaction", "funny celebrity reaction", "side eye reaction", "envy reaction"];
  const byMood: Partial<Record<CreativePlan["reactionMood"], string[]>> = {
    confused: ["Andrew Garfield reaction", "confused celebrity reaction", "what reaction"],
    shocked: ["The Rock reaction", "Tom Holland shocked reaction", "disbelief reaction"],
    panic: ["Tom Holland panic reaction", "celebrity panic reaction", "stressed reaction"],
    relief: ["celebrity relief reaction", "smug reaction", "finally reaction"],
    smug: ["Andrew Garfield smug reaction", "winning reaction", "side eye celebrity"],
    crying: ["celebrity crying reaction", "sad reaction", "defeated reaction"],
    celebrating: ["The Rock celebration reaction", "celebrity laughing reaction", "happy dance reaction"]
  };
  return [...(byMood[mood] ?? []), ...common];
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const query of queries) {
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(query.trim());
  }
  return result;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function energyForMood(mood: CreativePlan["reactionMood"]): ReactionAsset["energy"] {
  if (mood === "panic" || mood === "shocked" || mood === "celebrating") return "high";
  if (mood === "relief" || mood === "smug") return "low";
  return "medium";
}

function actionForMood(mood: CreativePlan["reactionMood"]): ReactionAsset["action"] {
  if (mood === "celebrating") return "celebrating";
  if (mood === "crying") return "crying";
  if (mood === "relief") return "thinking";
  return "staring";
}
