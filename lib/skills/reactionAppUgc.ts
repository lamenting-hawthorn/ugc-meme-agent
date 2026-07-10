import type { ProductUnderstanding } from "@/lib/types";
import { REACTION_APP_UGC_SKILL_INSTRUCTIONS } from "@/lib/skills/reactionAppUgcInstructions";

export const REACTION_APP_UGC_SKILL_ID = "reaction-app-ugc-shorts";

export type AppliedVideoSkill = {
  id: typeof REACTION_APP_UGC_SKILL_ID;
  instructions: string;
  targetDurationSec: number;
  durationRangeSec: { min: number; max: number };
};

export function resolveVideoSkill(message: string, previousProduct?: ProductUnderstanding): AppliedVideoSkill | null {
  if (!shouldUseReactionAppUgc(message, previousProduct)) return null;
  return {
    id: REACTION_APP_UGC_SKILL_ID,
    instructions: "",
    targetDurationSec: 10,
    durationRangeSec: { min: 7, max: 15 }
  };
}

export async function hydrateVideoSkill(skill: AppliedVideoSkill): Promise<AppliedVideoSkill> {
  return {
    ...skill,
    instructions: REACTION_APP_UGC_SKILL_INSTRUCTIONS
  };
}

function shouldUseReactionAppUgc(message: string, previousProduct?: ProductUnderstanding): boolean {
  const normalized = message.trim().toLowerCase();
  if (previousProduct) return true;
  if (/https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(?:\/|$)/.test(normalized)) return true;
  return /video|ad|ugc|tiktok|reels|shorts|meme|reaction|caption|hook|script|concept/.test(normalized);
}
