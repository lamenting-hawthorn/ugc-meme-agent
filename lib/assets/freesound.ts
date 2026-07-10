import type { AudioAsset, CreativePlan } from "@/lib/types";
import { logger } from "@/lib/utils/logger";
import { readProviderCache, writeProviderCache } from "@/lib/assets/providerCache";

type FreesoundResponse = {
  results?: Array<{
    id: number;
    name?: string;
    username?: string;
    duration?: number;
    tags?: string[];
    license?: string;
    url?: string;
    score?: number;
    avg_rating?: number;
    num_ratings?: number;
    num_downloads?: number;
    previews?: {
      "preview-hq-mp3"?: string;
      "preview-lq-mp3"?: string;
    };
  }>;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const RESULT_LIMIT = 6;

export async function fetchFreesoundCandidates(plan: CreativePlan): Promise<AudioAsset[]> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) return [];

  const queries = audioQueries(plan);
  const cacheKey = `quality-v3|${queries.join("|")}`;
  const cached = await readProviderCache<AudioAsset[]>("freesound", cacheKey);
  if (cached) return cached;

  try {
    const assetsById = new Map<string, AudioAsset>();

    const results = await Promise.allSettled(queries.map(async (query) => {
      const params = new URLSearchParams({
        query,
        fields: "id,name,username,duration,tags,license,url,previews,score,avg_rating,num_ratings,num_downloads",
        page_size: String(RESULT_LIMIT),
        filter: `duration:[5 TO 12] ${(filterByMood(plan.audioMood))}`.trim(),
        sort: "downloads_desc",
        group_by_pack: "1"
      });
      const response = await fetch(`https://freesound.org/apiv2/search/?${params.toString()}`, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: AbortSignal.timeout(4500)
      });
      if (!response.ok) {
        throw new Error(`Freesound search failed with ${response.status}`);
      }
      const payload = (await response.json()) as FreesoundResponse;
      const assets = (payload.results ?? [])
        .map((item) => toAudioAsset(item, plan))
        .filter((asset): asset is AudioAsset => Boolean(asset));
      for (const asset of assets) {
        assetsById.set(asset.id, asset);
      }
    }));

    if (results.every((result) => result.status === "rejected")) {
      const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      throw failure?.reason ?? new Error("All Freesound searches failed");
    }

    const assets = [...assetsById.values()];
    await writeProviderCache("freesound", cacheKey, assets, CACHE_TTL_MS);
    return assets;
  } catch (error) {
    logger.warn("Freesound fetch failed; continuing with local audio", {
      queries: queries.join(", "),
      error: error instanceof Error ? error.message : "unknown"
    });
    return [];
  }
}

function toAudioAsset(
  item: NonNullable<FreesoundResponse["results"]>[number],
  plan: CreativePlan
): AudioAsset | null {
  const preview = item.previews?.["preview-hq-mp3"] ?? item.previews?.["preview-lq-mp3"];
  if (!preview || !item.duration) return null;
  if (/by-nc|sampling\+/i.test(item.license ?? "")) return null;
  return {
    id: `freesound-${item.id}`,
    filePath: preview,
    source: "freesound",
    mood: plan.audioMood,
    energy: energyForAudioMood(plan.audioMood),
    durationSec: Math.round(item.duration),
    hasBeatDrop: /drop|impact|hit|bass/i.test(`${item.name ?? ""} ${(item.tags ?? []).join(" ")}`),
    beatDropAtSec: undefined,
    license: "freesound",
    providerQuality: providerQuality(item),
    title: item.name,
    creator: item.username,
    licenseUrl: safeHttpUrl(item.license),
    sourceUrl: safeHttpUrl(item.url),
    tags: tokenize(`${item.name ?? ""} ${(item.tags ?? []).join(" ")} ${item.license ?? ""}`)
  };
}

function audioQueries(plan: CreativePlan): string[] {
  const termsByMood: Record<CreativePlan["audioMood"], string[]> = {
    funny: ["comedy background music", "quirky loop", "cartoon comedy loop", "funny ukulele loop"],
    dramatic: ["dramatic cinematic hit", "tense trailer loop", "dramatic background music", "impact sting"],
    chill: ["chill ambient loop", "soft background music", "lofi calm loop", "minimal ambient pad"],
    chaotic: ["glitch tension loop", "chaotic electronic loop", "panic synth loop", "intense stinger"],
    victory: ["celebration loop", "uplifting victory music", "triumphant background music", "success sting"]
  };
  return termsByMood[plan.audioMood].slice(0, 2);
}

function providerQuality(item: NonNullable<FreesoundResponse["results"]>[number]): number {
  const rating = Math.min(1, Math.max(0, (item.avg_rating ?? 0) / 5));
  const ratingConfidence = Math.min(1, Math.log10((item.num_ratings ?? 0) + 1) / 2);
  const popularity = Math.min(1, Math.log10((item.num_downloads ?? 0) + 1) / 5);
  const relevance = Math.min(1, Math.max(0, item.score ?? 0));
  return rating * ratingConfidence * 0.35 + popularity * 0.4 + relevance * 0.25;
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function filterByMood(mood: CreativePlan["audioMood"]): string {
  const filters: Record<CreativePlan["audioMood"], string> = {
    funny: 'tag:(funny OR comedy OR cartoon OR quirky OR ukulele)',
    dramatic: 'tag:(dramatic OR cinematic OR trailer OR suspense)',
    chill: 'tag:(ambient OR chill OR soft OR calm)',
    chaotic: 'tag:(glitch OR chaos OR tense OR electronic)',
    victory: 'tag:(uplifting OR victory OR triumph OR celebration)'
  };
  return filters[mood];
}

function energyForAudioMood(mood: CreativePlan["audioMood"]): AudioAsset["energy"] {
  if (mood === "dramatic" || mood === "chaotic" || mood === "victory") return "high";
  if (mood === "chill") return "low";
  return "medium";
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
