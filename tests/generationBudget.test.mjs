import assert from "node:assert/strict";
import test from "node:test";
import { GenerationBudget, runWithinBudget } from "../lib/generate/generationBudget.ts";

test("generation budget exposes a bounded absolute deadline", () => {
  const budget = new GenerationBudget(Date.now(), 50);
  assert.ok(budget.remainingMs() <= 50);
  assert.equal(budget.exhausted(), false);
});

test("runWithinBudget rejects work that outlives the remaining budget", async () => {
  const budget = new GenerationBudget(Date.now(), 20);
  await assert.rejects(
    runWithinBudget(new Promise((resolve) => setTimeout(resolve, 100)), budget, "slow stage", 0),
    /slow stage exceeded generation budget/
  );
});
