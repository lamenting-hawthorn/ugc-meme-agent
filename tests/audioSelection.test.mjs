import assert from "node:assert/strict";
import test from "node:test";
import { scoreAudio } from "../lib/assets/scoring.ts";

const plan = {
  caption: "me when result.dev handles the boring part",
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

function audio(overrides) {
  return {
    id: overrides.id,
    filePath: "audio.mp3",
    mood: "funny",
    energy: "medium",
    durationSec: 10,
    hasBeatDrop: false,
    license: "freesound",
    tags: ["funny", "music", "loop"],
    ...overrides
  };
}

test("a popular music loop outranks a placeholder tone", () => {
  const placeholder = audio({ id: "placeholder", source: "local", providerQuality: 0.05 });
  const popularLoop = audio({ id: "popular", source: "freesound", providerQuality: 0.9 });

  assert.ok(scoreAudio(plan, popularLoop) > scoreAudio(plan, placeholder));
});
