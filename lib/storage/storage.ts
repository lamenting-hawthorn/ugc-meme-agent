import { readFile, stat } from "fs/promises";
import os from "os";
import path from "path";
import { logger } from "@/lib/utils/logger";

export type PublishResult = {
  url: string;
  bytes: number;
};

export function storageMode(): "local" | "blob" {
  const configured = (process.env.STORAGE_MODE || "").trim().toLowerCase();
  if (configured === "blob") return "blob";
  return "local";
}

/**
 * Where renderVideo should write its working files (caption PNG, downloaded
 * remotes, output MP4, poster JPG). In local dev this is public/generated/
 * so /generated/job.mp4 serves directly via Next's static handler. On Vercel
 * the filesystem outside /tmp is read-only, so we use os.tmpdir().
 */
export function workingDir(jobId: string): string {
  if (storageMode() === "blob") {
    return path.join(os.tmpdir(), "render", jobId);
  }
  return path.join(process.cwd(), "public", "generated");
}

export async function persistArtifact(
  filePath: string,
  key: string,
  contentType: string
): Promise<PublishResult> {
  const bytes = (await stat(filePath)).size;
  if (storageMode() === "blob") {
    return publishToBlob(filePath, key, contentType, bytes);
  }
  return { url: `/generated/${key}`, bytes };
}

async function publishToBlob(
  filePath: string,
  key: string,
  contentType: string,
  bytes: number
): Promise<PublishResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("STORAGE_MODE=blob requires BLOB_READ_WRITE_TOKEN. Add it in Vercel → Storage → Blob → Copy token.");
  }
  const { put } = await import("@vercel/blob");
  const body = await readFile(filePath);
  const blobPath = `generated/${key}`;
  const result = await put(blobPath, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    token
  });
  logger.info("Uploaded artifact to Vercel Blob", { key: blobPath, bytes, url: result.url.slice(0, 80) });
  return { url: result.url, bytes };
}