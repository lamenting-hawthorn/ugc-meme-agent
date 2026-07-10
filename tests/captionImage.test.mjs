import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { writeCaptionImage } from "../lib/render/captionImage.ts";

test("caption rasterization is font-independent and produces visible glyph pixels", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "caption-image-test-"));
  const outputPath = path.join(directory, "caption.png");

  try {
    await writeCaptionImage(outputPath, "ME when result.dev handles it 🚀");
    const output = await readFile(outputPath);
    assert.deepEqual([...output.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const { data: pixels, info } = await sharp(outputPath).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual({ width: info.width, height: info.height, channels: info.channels }, { width: 512, height: 250, channels: 4 });

    let visiblePixels = 0;
    let whitePixels = 0;
    let blackPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      visiblePixels += 1;
      if (pixels[index] === 255 && pixels[index + 1] === 255 && pixels[index + 2] === 255) whitePixels += 1;
      if (pixels[index] === 0 && pixels[index + 1] === 0 && pixels[index + 2] === 0) blackPixels += 1;
    }

    assert.ok(visiblePixels > 1_000, "caption should contain visible pixels");
    assert.ok(whitePixels > 100, "caption should contain white glyph pixels");
    assert.ok(blackPixels > 100, "caption should contain black outline pixels");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
