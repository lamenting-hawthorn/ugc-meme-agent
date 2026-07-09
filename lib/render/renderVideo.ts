import { execFile } from "child_process";
import { mkdir } from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { RenderPlan } from "@/lib/types";
import { writeCaptionImage } from "@/lib/render/captionImage";
import { validateOutput } from "@/lib/render/validateOutput";

const execFileAsync = promisify(execFile);

export async function renderVideo(jobId: string, renderPlan: RenderPlan): Promise<{ filePath: string; videoUrl: string; posterUrl: string }> {
  const outputDir = path.join(process.cwd(), "public", "generated");
  await mkdir(outputDir, { recursive: true });

  const captionImage = path.join(outputDir, `${jobId}.caption.pam`);
  await writeCaptionImage(captionImage, renderPlan.caption.text);

  const outputPath = path.join(outputDir, `${jobId}.mp4`);
  const backgroundPath = resolveAssetPath(renderPlan.background.filePath);
  const reactionPath = resolveAssetPath(renderPlan.reaction.filePathOrUrl);
  const audioPath = resolveAssetPath(renderPlan.audio.filePath);

  const filter = [
    `[0:v]scale=${renderPlan.output.width}:${renderPlan.output.height}:force_original_aspect_ratio=increase,crop=${renderPlan.output.width}:${renderPlan.output.height},setsar=1[bg]`,
    "[1:v]scale=360:-2,format=rgba[rx]",
    "[bg][rx]overlay=(W-w)/2:H-h-54:shortest=0[comp]",
    "[comp][2:v]overlay=0:70:shortest=0[v]"
  ].join(";");

  await execFileAsync("ffmpeg", [
    "-y",
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
  ], { maxBuffer: 1024 * 1024 * 8 });

  await validateOutput(outputPath, renderPlan.output.durationSec);
  const posterPath = path.join(outputDir, `${jobId}.jpg`);
  await execFileAsync("ffmpeg", [
    "-y",
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
  ], { maxBuffer: 1024 * 1024 * 4 });

  return {
    filePath: outputPath,
    videoUrl: `/generated/${jobId}.mp4`,
    posterUrl: `/generated/${jobId}.jpg`
  };
}

function resolveAssetPath(filePathOrUrl: string): string {
  if (/^https?:\/\//.test(filePathOrUrl)) return filePathOrUrl;
  return path.join(process.cwd(), filePathOrUrl);
}

function backgroundInputArgs(type: RenderPlan["background"]["type"], filePath: string): string[] {
  if (type === "video") {
    return ["-stream_loop", "-1", "-i", filePath];
  }
  return ["-loop", "1", "-i", filePath];
}
