import { accessSync } from "fs";
import { logger } from "@/lib/utils/logger";

let cached: string | undefined;

/**
 * Returns the path to the ffmpeg binary to invoke. Prefers the static binary
 * bundled by @ffmpeg-installer/ffmpeg (works on Vercel where no system ffmpeg
 * exists); falls back to `ffmpeg` on PATH for local dev where it's installed.
 */
export function getFfmpegPath(): string {
  if (cached !== undefined) return cached;
  try {
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    const bundled = ffmpegInstaller.path as string;
    accessSync(bundled);
    cached = bundled;
    logger.info("Using bundled ffmpeg", { path: bundled, version: ffmpegInstaller.version });
    return cached;
  } catch {
    cached = "ffmpeg";
    logger.info("Bundled ffmpeg unavailable; using system ffmpeg on PATH");
    return cached;
  }
}