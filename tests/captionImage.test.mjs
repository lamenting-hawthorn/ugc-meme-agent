import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { layoutCaption, writeCaptionImage } from "../lib/render/captionImage.ts";

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

test("caption layout preserves the complete maximum-length caption inside the safe region", () => {
  const caption = "me when i spend 2 hours debugging a production issue and calai.app scans the whole meal before i have even finished explaining what went wrong";
  const layout = layoutCaption(caption);

  assert.equal(layout.lines.join(" "), caption);
  assert.ok(layout.scale >= 2, "caption must remain readable");
  assert.ok(layout.lines.length > 4, "regression requires more than the old four-line limit");
  assert.ok(layout.width <= 456, "caption must remain inside horizontal safe margins");
  assert.ok(layout.height <= 234, "caption must remain inside vertical safe margins");
});

test("caption layout splits an oversized word without clipping it", () => {
  const caption = "pov supercalifragilisticexpialidociousworkflow calai.app fixed it";
  const layout = layoutCaption(caption);

  assert.equal(layout.lines.join("").replaceAll(" ", ""), caption.replaceAll(" ", ""));
  assert.ok(layout.width <= 456);
  assert.ok(layout.height <= 234);
});

test("caption layout fits the schema maximum even with the widest glyphs", () => {
  const caption = "w".repeat(145);
  const layout = layoutCaption(caption);

  assert.equal(layout.lines.join(""), caption);
  assert.ok(layout.width <= 456);
  assert.ok(layout.height <= 234);
});
