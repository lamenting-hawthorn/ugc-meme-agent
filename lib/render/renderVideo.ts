import { execFile } from "child_process";
import { access, mkdir, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { RenderPlan } from "@/lib/types";
import { writeCaptionImage } from "@/lib/render/captionImage";
import { validateOutput } from "@/lib/render/validateOutput";
import { persistArtifact, workingDir } from "@/lib/storage/storage";
import { getFfmpegPath } from "@/lib/render/ffmpegBinary";
import { logger } from "@/lib/utils/logger";

const execFileAsync = promisify(execFile);
const FFMPEG_TIMEOUT_MS = 25_000;
const REMOTE_FETCH_TIMEOUT_MS = 15_000;

export async function renderVideo(jobId: string, renderPlan: RenderPlan): Promise<{ filePath: string; videoUrl: string; posterUrl: string }> {
  const outputDir = workingDir(jobId);
  await mkdir(outputDir, { recursive: true });
  const tmpDir = path.join(os.tmpdir(), "render-tmp", jobId);
  await mkdir(tmpDir, { recursive: true });

  const captionImage = path.join(outputDir, `${jobId}.caption.png`);
  await writeCaptionImage(captionImage, renderPlan.caption.text);

  // Pre-fetch remote inputs to local tmp files. FFmpeg's built-in HTTP/TLS
  // support is flaky under concurrent remote reads (TLS "Unknown error",
  // silent zero-byte output, 25 s timeout) — materializing the inputs on
  // disk first makes the render deterministic and debuggable.
  const backgroundPath = await materialize(renderPlan.background.filePath, jobId, tmpDir, "bg");
  const reactionPath = await materialize(renderPlan.reaction.filePathOrUrl, jobId, tmpDir, "rx");
  const audioPath = await materialize(renderPlan.audio.filePath, jobId, tmpDir, "au");

  const outputPath = path.join(outputDir, `${jobId}.mp4`);

  const filter = [
    `[0:v]scale=${renderPlan.output.width}:${renderPlan.output.height}:force_original_aspect_ratio=increase,crop=${renderPlan.output.width}:${renderPlan.output.height},setsar=1[bg]`,
    "[1:v]scale=360:-2,format=rgba[rx]",
    "[bg][rx]overlay=(W-w)/2:H-h-54:shortest=0[comp]",
    "[comp][2:v]overlay=0:70:shortest=0[v]"
  ].join(";");

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-xerror",
    ...backgroundInputArgs(renderPlan.background.type, backgroundPath),
    "-stream_loop",
    "-1",
    "-i",
    reactionPath,
    "-i",
    captionImage,
    "-stream_loop",
    "-1",
    "-i",
    audioPath,
    "-t",
    String(renderPlan.output.durationSec),
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "3:a",
    "-r",
    String(renderPlan.output.fps),
    "-c:v",
    "libx264",
    "-profile:v",
    "baseline",
    "-level",
    "3.1",
    "-pix_fmt",
    "yuv420p",
    "-color_range",
    "tv",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-shortest",
    outputPath
  ], FFMPEG_TIMEOUT_MS, "render video");

  try {
    await access(outputPath);
  } catch {
    throw new Error(
      [
        "FFmpeg finished without creating the output MP4.",
        `background=${describeAsset(renderPlan.background.id, backgroundPath)}`,
        `reaction=${describeAsset(renderPlan.reaction.id, reactionPath)}`,
        `audio=${describeAsset(renderPlan.audio.id, audioPath)}`
      ].join(" ")
    );
  }

  await validateOutput(outputPath, renderPlan.output.durationSec);
  const posterPath = path.join(outputDir, `${jobId}.jpg`);
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-ss",
    "2",
    "-i",
    outputPath,
    "-frames:v",
    "1",
    "-update",
    "1",
    "-q:v",
    "3",
    posterPath
  ], 10_000, "extract poster");

  // Publish: local mode returns /generated/<id> URLs (files already on disk);
  // blob mode uploads to Vercel Blob and returns CDN URLs.
  const video = await persistArtifact(outputPath, `${jobId}.mp4`, "video/mp4");
  const poster = await persistArtifact(posterPath, `${jobId}.jpg`, "image/jpeg");

  return {
    filePath: outputPath,
    videoUrl: video.url,
    posterUrl: poster.url
  };
}

async function materialize(filePathOrUrl: string, jobId: string, tmpDir: string, prefix: string): Promise<string> {
  // Local assets — resolve and pass through.
  if (!/^https?:\/\//.test(filePathOrUrl)) {
    if (filePathOrUrl.startsWith("assets/")) {
      return path.join(process.cwd(), "assets", filePathOrUrl.slice("assets/".length));
    }
    if (filePathOrUrl.startsWith("public/")) {
      return path.join(process.cwd(), "public", filePathOrUrl.slice("public/".length));
    }
    throw new Error(`Unsupported local asset path: ${filePathOrUrl}`);
  }

  // Remote asset — download to a stable tmp path so ffmpeg reads from disk.
  const url = new URL(filePathOrUrl);
  const ext = path.extname(url.pathname) || inferExtFromUrl(filePathOrUrl) || ".bin";
  const tmpPath = path.join(tmpDir, `${prefix}${ext}`);
  try {
    const response = await fetch(filePathOrUrl, { signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength < 1000) throw new Error(`downloaded only ${buf.byteLength} bytes`);
    await writeFile(tmpPath, buf);
    logger.info("Downloaded remote asset for render", { url: filePathOrUrl.slice(0, 80), bytes: buf.byteLength, to: tmpPath });
    return tmpPath;
  } catch (error) {
    throw new Error(`Failed to download render asset ${filePathOrUrl.slice(0, 120)}: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

function inferExtFromUrl(url: string): string | null {
  const m = url.match(/\.(mp4|gif|webp|webm|mp3|wav|ogg|jpg|jpeg|png)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : null;
}

async function runFfmpeg(args: string[], timeout: number, action: string): Promise<void> {
  try {
    await execFileAsync(getFfmpegPath(), args, { maxBuffer: 1024 * 1024 * 16, timeout });
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? error.stderr.trim().slice(0, 1200)
      : error instanceof Error
        ? error.message
        : "unknown error";
    throw new Error(`FFmpeg failed to ${action}: ${detail || "no stderr"}`);
  }
}

function describeAsset(id: string, input: string): string {
  const label = /^https?:\/\//.test(input) && input.length > 4
    ? new URL(input).hostname
    : input.length > 100
      ? `${input.slice(0, 60)}...`
      : input;
  return `${id}:${label}`;
}

function backgroundInputArgs(type: RenderPlan["background"]["type"], filePath: string): string[] {
  if (type === "video") {
    return ["-stream_loop", "-1", "-i", filePath];
  }
  return ["-loop", "1", "-i", filePath];
}