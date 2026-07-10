import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { RenderPlan } from "@/lib/types";
import { getFfmpegPath } from "@/lib/render/ffmpegBinary";
import { writeCaptionImage } from "@/lib/render/captionImage";
import { prepareReactionInput } from "@/lib/render/normalizeReaction";
import { prepareRemoteInput, type PreparedInput } from "@/lib/render/prepareRemoteInput";
import { validateOutput } from "@/lib/render/validateOutput";
import { persistArtifact, workingDir } from "@/lib/storage/storage";

const execFileAsync = promisify(execFile);
const FFMPEG_TIMEOUT_MS = 45_000;

type RenderResult = {
  filePath: string;
  videoUrl: string;
  posterUrl: string;
};

export async function renderVideo(jobId: string, renderPlan: RenderPlan): Promise<RenderResult> {
  const outputDir = workingDir(jobId);
  await mkdir(outputDir, { recursive: true });

  const captionImage = path.join(outputDir, `${jobId}.caption.png`);
  await writeCaptionImage(captionImage, renderPlan.caption.text);
  const outputPath = path.join(outputDir, `${jobId}.mp4`);
  const preparedInputs = await prepareRenderInputs(jobId, outputDir, renderPlan);

  const filter = [
    `[0:v]scale=${renderPlan.output.width}:${renderPlan.output.height}:force_original_aspect_ratio=increase,crop=${renderPlan.output.width}:${renderPlan.output.height},setsar=1[bg]`,
    "[1:v]scale=360:-2,format=rgba[rx]",
    "[bg][rx]overlay=(W-w)/2:H-h-54:shortest=0[comp]",
    "[comp][2:v]overlay=0:70:shortest=0[v]"
  ].join(";");

  try {
    await runFfmpeg([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      ...backgroundInputArgs(renderPlan.background.type, preparedInputs.background.path),
      "-stream_loop",
      "-1",
      "-i",
      preparedInputs.reaction.path,
      "-i",
      captionImage,
      "-stream_loop",
      "-1",
      "-i",
      preparedInputs.audio.path,
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
  } finally {
    await preparedInputs.cleanup();
  }

  await access(outputPath);
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
  ], 15_000, "extract poster");

  const video = await persistArtifact(outputPath, `${jobId}.mp4`, "video/mp4");
  const poster = await persistArtifact(posterPath, `${jobId}.jpg`, "image/jpeg");

  return {
    filePath: outputPath,
    videoUrl: video.url,
    posterUrl: poster.url
  };
}

async function prepareRenderInputs(
  jobId: string,
  outputDir: string,
  renderPlan: RenderPlan
): Promise<{ background: PreparedInput; reaction: PreparedInput; audio: PreparedInput; cleanup: () => Promise<void> }> {
  const backgroundPath = resolveAssetPath(renderPlan.background.filePath);
  const reactionPath = resolveAssetPath(renderPlan.reaction.filePathOrUrl);
  const audioPath = resolveAssetPath(renderPlan.audio.filePath);
  const results = await Promise.allSettled([
    prepareRemoteInput(
      backgroundPath,
      jobId,
      outputDir,
      renderPlan.background.type === "video" ? "background-video" : "background-image"
    ),
    prepareReactionInput({
      filePathOrUrl: reactionPath,
      previewImageUrl: renderPlan.reaction.previewImageUrl
    }, jobId, outputDir),
    prepareRemoteInput(audioPath, jobId, outputDir, "audio")
  ]);
  const prepared = results
    .filter((result): result is PromiseFulfilledResult<PreparedInput> => result.status === "fulfilled")
    .map((result) => result.value);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) {
    await Promise.allSettled(prepared.map((input) => input.cleanup()));
    throw failure.reason;
  }

  const [background, reaction, audio] = prepared;
  return {
    background,
    reaction,
    audio,
    cleanup: async () => {
      await Promise.allSettled(prepared.map((input) => input.cleanup()));
    }
  };
}

async function runFfmpeg(args: string[], timeout: number, action: string): Promise<void> {
  try {
    await execFileAsync(getFfmpegPath(), args, {
      maxBuffer: 64 * 1024 * 1024,
      timeout,
      killSignal: "SIGKILL"
    });
  } catch (error) {
    const stderr = isExecError(error) ? error.stderr.trim() : "";
    const detail = stderr
      ? stderr.split("\n").slice(-8).join("\n")
      : error instanceof Error
        ? error.message
        : "unknown FFmpeg error";
    throw new Error(`FFmpeg failed to ${action}: ${detail}`, { cause: error });
  }
}

function isExecError(error: unknown): error is { stderr: string } {
  return typeof error === "object" && error !== null && "stderr" in error && typeof error.stderr === "string";
}

function resolveAssetPath(filePathOrUrl: string): string {
  if (/^https?:\/\//.test(filePathOrUrl) || path.isAbsolute(filePathOrUrl)) return filePathOrUrl;
  const resolved = path.resolve(process.cwd(), filePathOrUrl);
  const allowedRoots = [path.resolve(process.cwd(), "assets"), path.resolve(process.cwd(), "public")];
  if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error(`Unsupported local asset path: ${filePathOrUrl}`);
  }
  return resolved;
}

function backgroundInputArgs(type: RenderPlan["background"]["type"], filePath: string): string[] {
  if (type === "video") return ["-stream_loop", "-1", "-i", filePath];
  return ["-loop", "1", "-i", filePath];
}
