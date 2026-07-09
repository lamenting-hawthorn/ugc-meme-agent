import type { AudioAsset, CreativePlan } from "@/lib/types";
import { logger } from "@/lib/utils/logger";
import { readProviderCache, writeProviderCache } from "@/lib/assets/providerCache";

type FreesoundResponse = {
  results?: Array<{
    id: number;
    name?: string;
    duration?: number;
    tags?: string[];
    license?: string;
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
  const cacheKey = queries.join("|");
  const cached = await readProviderCache<AudioAsset[]>("freesound", cacheKey);
  if (cached) return cached;

  try {
    const assetsById = new Map<string, AudioAsset>();

    for (const query of queries) {
      const params = new URLSearchParams({
        query,
        fields: "id,name,duration,tags,license,previews",
        page_size: String(RESULT_LIMIT),
        filter: `duration:[5 TO 12] ${(filterByMood(plan.audioMood))}`.trim()
      });
      const response = await fetch(`https://freesound.org/apiv2/search/text/?${params.toString()}`, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: AbortSignal.timeout(5000)
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
  return termsByMood[plan.audioMood];
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
