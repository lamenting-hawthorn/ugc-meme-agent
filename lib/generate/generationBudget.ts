/**
 * A small absolute-deadline budget shared by every generation stage. Keeping
 * the deadline (rather than independent timers) prevents provider fallbacks
 * and render retries from extending a request past the platform limit.
 */
export const GENERATION_BUDGET_MS = 55_000;

export class GenerationBudget {
  readonly deadline: number;

  constructor(startedAt = Date.now(), budgetMs = GENERATION_BUDGET_MS) {
    this.deadline = startedAt + budgetMs;
  }

  remainingMs(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  exhausted(): boolean {
    return this.remainingMs() <= 0;
  }
}

export async function runWithinBudget<T>(
  task: Promise<T>,
  budget: GenerationBudget,
  label: string,
  safetyMarginMs = 500
): Promise<T> {
  const timeoutMs = budget.remainingMs() - safetyMarginMs;
  if (timeoutMs <= 0) throw new Error(`Generation budget exhausted before ${label}`);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded generation budget`)), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
