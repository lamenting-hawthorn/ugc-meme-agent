import { access, stat } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function validateOutput(filePath: string, expectedDurationSec: number): Promise<void> {
  await access(filePath);
  const file = await stat(filePath);
  if (file.size < 20_000) throw new Error("rendered file is unexpectedly small");

  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      filePath
    ]);
    const probe = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const duration = Number(probe.format?.duration ?? 0);
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (!video || !audio) throw new Error("rendered output is missing video or audio");
    if ((video.width ?? 0) >= (video.height ?? 0)) throw new Error("rendered output is not vertical");
    if (duration < 5 || duration > Math.max(12, expectedDurationSec + 2)) {
      throw new Error(`rendered duration ${duration.toFixed(2)}s is outside expected bounds`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("ffprobe returned invalid output");
    throw error;
  }
}
