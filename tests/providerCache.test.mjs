import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { providerCacheDir } from "../lib/assets/providerCachePath.ts";

test("provider cache uses Vercel's writable temporary directory", () => {
  const originalVercel = process.env.VERCEL;
  process.env.VERCEL = "1";

  try {
    assert.equal(providerCacheDir(), path.join(os.tmpdir(), ".cache", "asset-provider"));
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

test("provider cache uses the project directory outside Vercel", () => {
  const originalVercel = process.env.VERCEL;
  delete process.env.VERCEL;

  try {
    assert.equal(providerCacheDir(), path.join(process.cwd(), ".cache", "asset-provider"));
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});
