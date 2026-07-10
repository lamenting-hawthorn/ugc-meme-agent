import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicHttpUrl } from "../lib/scraping/validateUrl.ts";

test("rejects credentials and private IPv4/IPv6 product URLs", () => {
  for (const rawUrl of [
    "https://user:password@example.com/product",
    "http://10.0.0.8/product",
    "http://192.168.1.20/product",
    "http://[::1]/product",
    "http://[fd00::1]/product",
    "http://[fe80::1]/product"
  ]) {
    assert.throws(() => validatePublicHttpUrl(rawUrl), /not allowed|credentials/);
  }
});

test("redirect targets are validated before a follow-up request", () => {
  const redirectTarget = new URL("http://127.0.0.1:8080/admin", "https://example.com/product");
  assert.throws(() => validatePublicHttpUrl(redirectTarget.toString()), /Local and private network URLs/);
});
