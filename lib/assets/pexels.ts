import type { BackgroundAsset, CreativePlan } from "@/lib/types";
import { readProviderCache, writeProviderCache } from "@/lib/assets/providerCache";
import { logger } from "@/lib/utils/logger";

type PexelsPhotoResponse = {
  photos?: Array<{
    id: number;
    width?: number;
    height?: number;
    alt?: string;
    url?: string;
    photographer?: string;
    src?: {
      portrait?: string;
      large2x?: string;
      large?: string;
    };
  }>;
};

type PexelsVideoResponse = {
  videos?: Array<{
    id: number;
    width?: number;
    height?: number;
    url?: string;
    duration?: number;
    user?: {
      name?: string;
      url?: string;
    };
    video_files?: Array<{
      quality?: "hd" | "sd";
      file_type?: string;
      width?: number;
      height?: number;
      link?: string;
    }>;
  }>;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RESULT_LIMIT = 8;

export async function fetchPexelsBackgroundCandidates(plan: CreativePlan): Promise<BackgroundAsset[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  const queries = backgroundQueries(plan);
  const candidates = new Map<string, BackgroundAsset>();

  for (const query of queries) {
    for (const mode of ["image", "video"] as const) {
      try {
        const assets = await fetchQueryMode(apiKey, plan, query, mode);
        for (const asset of assets) {
          candidates.set(asset.id, asset);
        }
      } catch (error) {
        logger.warn("Pexels fetch failed; continuing with local backgrounds", {
          query,
          mode,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }
  }

  return [...candidates.values()];
}

async function fetchQueryMode(
  apiKey: string,
  plan: CreativePlan,
  query: string,
  mode: "image" | "video"
): Promise<BackgroundAsset[]> {
  const cacheKey = JSON.stringify({ query, mode, category: plan.backgroundCategory, mood: plan.backgroundMood });
  const cached = await readProviderCache<BackgroundAsset[]>("pexels", cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    query,
    per_page: String(RESULT_LIMIT)
  });

  const url =
    mode === "image"
      ? "https://api.pexels.com/v1/search"
      : "https://api.pexels.com/v1/videos/search";

  if (mode === "image") {
    params.set("orientation", "portrait");
  } else {
    params.set("orientation", "portrait");
    params.set("size", "medium");
  }

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    throw new Error(`Pexels ${mode} search failed with ${response.status}`);
  }

  if (mode === "image") {
    const payload = (await response.json()) as PexelsPhotoResponse;
    const assets = (payload.photos ?? [])
      .map((photo) => toImageAsset(photo, plan))
      .filter((asset): asset is BackgroundAsset => Boolean(asset));
    await writeProviderCache("pexels", cacheKey, assets, CACHE_TTL_MS);
    return assets;
  }

  const payload = (await response.json()) as PexelsVideoResponse;
  const assets = (payload.videos ?? [])
    .map((video) => toVideoAsset(video, plan))
    .filter((asset): asset is BackgroundAsset => Boolean(asset));
  await writeProviderCache("pexels", cacheKey, assets, CACHE_TTL_MS);
  return assets;
}

function toImageAsset(
  photo: NonNullable<PexelsPhotoResponse["photos"]>[number],
  plan: CreativePlan
): BackgroundAsset | null {
  const width = photo.width ?? 0;
  const height = photo.height ?? 0;
  const filePath = photo.src?.portrait ?? photo.src?.large2x ?? photo.src?.large;
  if (!filePath || !width || !height || height <= width) return null;

  return {
    id: `pexels-image-${photo.id}`,
    source: "pexels",
    filePath,
    type: "image",
    category: plan.backgroundCategory,
    mood: plan.backgroundMood,
    busyTopArea: false,
    busyCenterArea: false,
    safeTextZone: "top",
    tags: tokenize(`${photo.alt ?? ""} ${photo.photographer ?? ""} still photo`)
  };
}

function toVideoAsset(
  video: NonNullable<PexelsVideoResponse["videos"]>[number],
  plan: CreativePlan
): BackgroundAsset | null {
  const rendition = pickBestVideoFile(video.video_files ?? []);
  if (!rendition?.link || !rendition.width || !rendition.height || rendition.height <= rendition.width) {
    return null;
  }

  return {
    id: `pexels-video-${video.id}`,
    source: "pexels",
    filePath: rendition.link,
    type: "video",
    category: plan.backgroundCategory,
    mood: plan.backgroundMood,
    busyTopArea: false,
    busyCenterArea: false,
    safeTextZone: "top",
    tags: tokenize(`${video.user?.name ?? ""} portrait motion background`)
  };
}

function pickBestVideoFile(files: NonNullable<NonNullable<PexelsVideoResponse["videos"]>[number]["video_files"]>) {
  return [...files]
    .filter((file) => file.file_type === "video/mp4" && (file.height ?? 0) > (file.width ?? 0))
    .sort((a, b) => scoreVideoFile(b) - scoreVideoFile(a))[0];
}

function scoreVideoFile(file: { quality?: "hd" | "sd"; width?: number; height?: number }) {
  const qualityScore = file.quality === "hd" ? 2 : 1;
  const pixelScore = (file.width ?? 0) * (file.height ?? 0);
  return qualityScore * 1_000_000 + pixelScore;
}

function backgroundQueries(plan: CreativePlan): string[] {
  const base = `${plan.backgroundMood} ${plan.backgroundCategory}`.trim();
  return dedupe([
    `${base} workspace`,
    `${base} aesthetic`,
    `${plan.backgroundCategory} ambient portrait`,
    `${plan.backgroundCategory} clean portrait`
  ]);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
