import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDistinctFallbackCaption,
  lacksConcreteProductAnchor,
  wasCaptionPreviouslyUsed
} from "../lib/llm/captionPolicy.ts";

const resultProduct = {
  productName: "Result",
  productUrl: "https://result.dev",
  category: "business operating system / startup toolkit",
  oneLineSummary: "An operating system for starting and running an online business.",
  targetUser: "solo founders",
  userPain: "juggling disconnected tools",
  oldWorkflow: "using separate tools for GitHub, payments, marketing, support, and analytics",
  productBenefit: "unifies building, payments, marketing, support, and analytics",
  emotionalBeforeState: "overwhelmed",
  emotionalAfterState: "relieved",
  memeAngles: []
};

function resultMemory(caption) {
  return [{
    role: "assistant",
    type: "result_summary",
    summary: `Generated cut with caption: ${caption}`,
    rawText: caption
  }];
}

test("detects a caption already used by a previous generated cut", () => {
  const caption = "me when result.dev does the boring part and i take the credit";
  assert.equal(wasCaptionPreviouslyUsed(caption, resultMemory(caption)), true);
});

test("quick-action fallback never repeats the prior caption", () => {
  const previous = "me taking credit after result.dev handles the business";
  const next = buildDistinctFallbackCaption(resultProduct, "funny", resultMemory(previous));
  assert.notEqual(next, previous);
  assert.match(next, /result\.dev/);
  assert.match(next, /^me switching between github, payments, marketing, and support before i found result\.dev$/);
});

test("broad products use a concrete website capability instead of tab juggling", () => {
  const caption = buildDistinctFallbackCaption(resultProduct);
  assert.doesNotMatch(caption, /tabs?/i);
  assert.match(caption, /github|payments|marketing|support|app|business/i);
});

test("rejects generic broad-platform captions without a concrete product capability", () => {
  assert.equal(
    lacksConcreteProductAnchor("me juggling 12 subscriptions instead of using result.dev", resultProduct),
    true
  );
  assert.equal(
    lacksConcreteProductAnchor("me switching between github and payments before result.dev", resultProduct),
    false
  );
  assert.equal(
    lacksConcreteProductAnchor(
      "me juggling 12 tabs instead of using result.dev",
      { ...resultProduct, category: "business / startup OS" }
    ),
    true
  );
});
