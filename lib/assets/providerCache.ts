import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { providerCacheDir } from "./providerCachePath";
import { logger } from "@/lib/utils/logger";

type CacheEnvelope<T> = {
  expiresAt: number;
  value: T;
};

export async function readProviderCache<T>(namespace: string, key: string): Promise<T | null> {
  try {
    const filePath = cacheFile(namespace, key);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export async function writeProviderCache<T>(namespace: string, key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const filePath = cacheFile(namespace, key);
    const payload: CacheEnvelope<T> = {
      expiresAt: Date.now() + ttlMs,
      value
    };
    await mkdir(providerCacheDir(), { recursive: true });
    await writeFile(filePath, JSON.stringify(payload), "utf8");
  } catch (error) {
    logger.warn("Provider cache write failed; continuing without cache", {
      namespace,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
}

function cacheFile(namespace: string, key: string): string {
  const hash = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return path.join(providerCacheDir(), `${namespace}-${hash}.json`);
}
