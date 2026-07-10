import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DOWNLOAD_TIMEOUT_MS = 10_000;
const DOWNLOAD_ATTEMPTS = 2;
const MAX_ASSET_BYTES = 40 * 1024 * 1024;

type RemoteInputKind = "background-image" | "background-video" | "audio";

export type PreparedInput = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function prepareRemoteInput(
  filePathOrUrl: string,
  jobId: string,
  outputDir: string,
  kind: RemoteInputKind
): Promise<PreparedInput> {
  if (!/^https?:\/\//.test(filePathOrUrl)) {
    return { path: filePathOrUrl, cleanup: async () => undefined };
  }

  const failures: string[] = [];
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await downloadInput(filePathOrUrl, jobId, outputDir, kind);
    } catch (error) {
      failures.push(`attempt ${attempt}: ${errorMessage(error)}`);
    }
  }
  throw new Error(`${kind} preparation failed for ${new URL(filePathOrUrl).hostname}: ${failures.join("; ")}`);
}

async function downloadInput(
  url: string,
  jobId: string,
  outputDir: string,
  kind: RemoteInputKind
): Promise<PreparedInput> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`download returned ${response.status}`);

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_ASSET_BYTES) throw new Error("asset exceeds 40 MB limit");
  const input = Buffer.from(await response.arrayBuffer());
  if (input.byteLength > MAX_ASSET_BYTES) throw new Error("asset exceeds 40 MB limit");

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  validateContentType(kind, contentType);
  const extension = kind === "background-image" ? ".jpg" : kind === "background-video" ? ".mp4" : ".mp3";
  const outputPath = path.join(outputDir, `${jobId}.${kind}${extension}`);
  const output = kind === "background-image"
    ? await sharp(input).rotate().jpeg({ quality: 90 }).toBuffer()
    : input;
  await writeFile(outputPath, output, { mode: 0o600 });

  return {
    path: outputPath,
    cleanup: async () => {
      await rm(outputPath, { force: true });
    }
  };
}

function validateContentType(kind: RemoteInputKind, contentType: string): void {
  const accepted = kind === "background-image"
    ? contentType.startsWith("image/")
    : kind === "background-video"
      ? contentType.startsWith("video/") || contentType === "application/octet-stream"
      : contentType.startsWith("audio/") || contentType === "application/octet-stream";
  if (!accepted) throw new Error(`unsupported content type ${contentType || "unknown"}`);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`;
}
