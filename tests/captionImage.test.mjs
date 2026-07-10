import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeCaptionImage } from "../lib/render/captionImage.ts";

test("caption rasterization is font-independent and produces visible glyph pixels", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "caption-image-test-"));
  const outputPath = path.join(directory, "caption.png");

  try {
    await writeCaptionImage(outputPath, "ME when result.dev handles it 🚀");
    const output = await readFile(outputPath);
    const headerEnd = output.indexOf(Buffer.from("ENDHDR\n")) + "ENDHDR\n".length;
    const pixels = output.subarray(headerEnd);

    assert.match(output.subarray(0, headerEnd).toString("ascii"), /P7\nWIDTH 512\nHEIGHT 250\nDEPTH 4/);
    assert.equal(pixels.length, 512 * 250 * 4);

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
