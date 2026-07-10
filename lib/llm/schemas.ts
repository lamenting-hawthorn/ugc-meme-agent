import { z } from "zod";

function enumValue<T extends string>(values: readonly T[]) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const normalized = value.toLowerCase();
    const alias = enumAlias(normalized);
    if (alias && values.includes(alias as T)) return alias;
    return values.find((option) => normalized.includes(option)) ?? normalized;
  }, z.enum(values as [T, ...T[]]));
}

function enumAlias(value: string): string | null {
  if (/frustrated|irritated|fed up/.test(value)) return "annoyed";
  if (/anxious|worried|tense/.test(value)) return "stressed";
  if (/kitchen|bedroom|home|desk/.test(value)) return "room";
  if (/messy|plain|simple/.test(value)) return "neutral";
  if (/entertained|amused/.test(value)) return "happy";
  if (/effortless|at ease|easy|unburdened/.test(value)) return "relieved";
  if (/empowered/.test(value)) return "confident";
  if (/self-deprecating|self deprecating/.test(value)) return "relatable";
  if (/excited|win|winning/.test(value)) return "celebrating";
  if (/surprised|amazed/.test(value)) return "shocked";
  return null;
}

export const productUnderstandingSchema = z.object({
  productName: z.string().min(1),
  productUrl: z.string().url(),
  category: z.string().min(1),
  oneLineSummary: z.string().min(1),
  targetUser: z.string().min(1),
  userPain: z.string().min(1),
  oldWorkflow: z.string().min(1),
  productBenefit: z.string().min(1),
  emotionalBeforeState: enumValue(["confused", "stressed", "annoyed", "bored", "overwhelmed", "embarrassed"] as const),
  emotionalAfterState: enumValue(["relieved", "confident", "smug", "happy", "calm"] as const),
  memeAngles: z.array(z.string()).min(1).max(6),
  source: z.enum(["openrouter", "deepseek", "deterministic"]).optional()
});

export const creativePlanSchema = z.object({
  caption: z.string().min(12).max(145),
  memeFormat: enumValue(["me-when", "pov", "before-after", "pretending-to-know", "manual-vs-automated", "realization"] as const),
  humorStyle: enumValue(["relatable", "absurd", "dry", "genz", "dramatic"] as const),
  reactionMood: enumValue(["confused", "panic", "shocked", "relief", "smug", "crying", "celebrating"] as const),
  audioMood: enumValue(["funny", "dramatic", "chill", "chaotic", "victory"] as const),
  backgroundCategory: enumValue(["room", "office", "sky", "phone", "gradient", "lifestyle"] as const),
  backgroundMood: enumValue(["clean", "premium", "neutral", "dramatic", "funny"] as const),
  durationSec: z.number().min(7).max(15),
  template: z.literal("top-caption-bottom-reaction"),
  giphyQueries: z.array(z.string()).min(3).max(8),
  source: z.enum(["openrouter", "deepseek", "deterministic"]).optional(),
  appliedSkillId: z.literal("reaction-app-ugc-shorts").optional()
});
