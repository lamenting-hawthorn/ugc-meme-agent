import assert from "node:assert/strict";
import test from "node:test";
import {
  inferReactionMoodFromTitle,
  prioritizeReactionVisualCategories
} from "../lib/assets/reactionVisualCategory.ts";
import { appendRecentReactionId } from "../lib/chat/regenerationHistory.ts";
import { buildGiphySearches } from "../lib/assets/giphySearchPlan.ts";

function reaction(overrides) {
  return {
    id: overrides.id,
    source: "giphy",
    filePathOrUrl: "https://example.com/reaction.gif",
    previewImageUrl: "https://example.com/reaction.jpg",
    type: "gif",
    mood: "confused",
    energy: "medium",
    action: "staring",
    hasTransparentBackground: false,
    width: 360,
    height: 360,
    loopable: true,
    preferredPosition: "bottom-center",
    preferredScale: 1,
    tags: ["confused", "reaction"],
    ...overrides
  };
}

test("real human GIF outranks an animated transparent sticker", () => {
  const ranked = prioritizeReactionVisualCategories([
    reaction({ id: "llama", title: "Animated llama", hasTransparentBackground: true }),
    reaction({ id: "human", title: "Confused woman reaction" })
  ]);

  assert.equal(ranked[0].id, "human");
  assert.equal(ranked[0].visualCategory, "real_human");
});

test("provider titles contribute real mood evidence instead of inheriting the requested mood", () => {
  assert.equal(inferReactionMoodFromTitle("The Rock shocked reaction"), "shocked");
  assert.equal(inferReactionMoodFromTitle("Celebrity relief sigh GIF"), "relief");
  assert.equal(inferReactionMoodFromTitle("Generic celebrity sticker"), undefined);
});

test("recent reaction history is bounded and does not oscillate between two assets", () => {
  let history = [];
  for (const id of ["a", "b", "a", "c", "d", "e", "f", "g"]) {
    history = appendRecentReactionId(history, id);
  }

  assert.deepEqual(history, ["a", "c", "d", "e", "f", "g"]);
});

test("GIPHY search stays within three calls and rotates the celebrity query by caption", () => {
  const basePlan = {
    caption: "a",
    memeFormat: "me-when",
    humorStyle: "relatable",
    reactionMood: "confused",
    audioMood: "funny",
    backgroundCategory: "room",
    backgroundMood: "clean",
    durationSec: 10,
    template: "top-caption-bottom-reaction",
    giphyQueries: ["confused human reaction"]
  };
  const searches = buildGiphySearches(basePlan);
  const celebrityQueries = ["a", "b", "c"].map((caption) => buildGiphySearches({ ...basePlan, caption })[0].query);

  assert.equal(searches.length, 3);
  assert.deepEqual(searches.map((search) => search.mode), ["stickers", "gifs", "gifs"]);
  assert.equal(new Set(celebrityQueries).size, 3);
});
