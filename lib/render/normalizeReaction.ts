import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const REACTION_SIZE = 360;
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_ATTEMPTS = 2;

type ReactionInput = {
  filePathOrUrl: string;
  previewImageUrl?: string;
};

export async function prepareReactionInput(
  reaction: ReactionInput,
  jobId: string,
  outputDir: string
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  if (!/^https?:\/\//.test(reaction.filePathOrUrl)) {
    return { path: reaction.filePathOrUrl, cleanup: async () => undefined };
  }

  const urls = [reaction.filePathOrUrl, reaction.previewImageUrl]
    .filter((value): value is string => Boolean(value && /^https?:\/\//.test(value)))
    .filter((value, index, values) => values.indexOf(value) === index);
  const failures: string[] = [];

  for (const url of urls) {
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      try {
        return await downloadAndNormalize(url, jobId, outputDir);
      } catch (error) {
        failures.push(`${new URL(url).hostname} attempt ${attempt}: ${errorMessage(error)}`);
      }
    }
  }

  throw new Error(`Reaction asset preparation failed: ${failures.join("; ")}`);
}

async function downloadAndNormalize(
  url: string,
  jobId: string,
  outputDir: string
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`download returned ${response.status}`);

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_ASSET_BYTES) throw new Error("asset exceeds 25 MB limit");

  const input = Buffer.from(await response.arrayBuffer());
  if (input.byteLength > MAX_ASSET_BYTES) throw new Error("asset exceeds 25 MB limit");

  const isVideo = contentType.startsWith("video/") || /\.mp4(?:$|\?)/i.test(url);
  // FFmpeg builds commonly fail to decode animated WebP even when the file is
  // valid. GIF is larger but is a dependable local interchange format and
  // retains animation/transparency for the short reaction overlays.
  const extension = isVideo ? ".mp4" : ".gif";
  const normalizedPath = path.join(outputDir, `${jobId}.reaction${extension}`);
  const output = isVideo
    ? input
    : await sharp(input, { animated: true })
      .resize({ width: REACTION_SIZE, height: REACTION_SIZE, fit: "inside" })
      .gif({ effort: 3 })
      .toBuffer();
  await writeFile(normalizedPath, output, { mode: 0o600 });

  return {
    path: normalizedPath,
    cleanup: async () => {
      await rm(normalizedPath, { force: true });
    }
  };
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`;
}
