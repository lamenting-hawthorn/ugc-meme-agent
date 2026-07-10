import type { CreativePlan, ReactionAsset, ReactionVisualCategory } from "@/lib/types";

export const REACTION_VISUAL_CATEGORY_PRIORITY: Record<ReactionVisualCategory, number> = {
  real_human: 3,
  animated_figure: 2,
  generic: 1
};

export function formatReactionVisualCategory(category: ReactionVisualCategory): string {
  return category.replace("_", " ");
}

export function inferReactionVisualCategoryFromTitle(title?: string): ReactionVisualCategory | undefined {
  const descriptor = (title ?? "").toLowerCase();
  if (!descriptor) return undefined;
  if (/\b(cartoon|anime|animated|animation|illustration|illustrated|character|emoji|sheep|llama|alpaca|dog|cat|bear|rabbit|bunny|duck|bird|frog|monkey|animal)\b/.test(descriptor)) {
    return "animated_figure";
  }
  if (/\b(human|person|people|celebrity|actor|actress|man|woman|guy|girl|boy|travolta|garfield|holland|rock|hart|snoop|ishowspeed|speed)\b/.test(descriptor)) {
    return "real_human";
  }
  if (/\b(text|word|quote|logo|icon|symbol|shape|object|effect|good morning|sale|promo|subscribe|follow)\b/.test(descriptor)) {
    return "generic";
  }
  return undefined;
}

export function titleSignalsDisallowedVisual(title?: string): boolean {
  return /\b(text|word|quote|logo|watermark|good morning|sale|promo|subscribe|follow)\b/i.test(title ?? "");
}

export function prioritizeReactionVisualCategories(candidates: ReactionAsset[]): ReactionAsset[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      visualCategory: candidate.visualCategory ?? inferReactionVisualCategoryFromTitle(candidate.title) ?? "generic"
    }))
    .sort(compareReactionVisualPriority);
}

export function compareReactionVisualPriority(a: ReactionAsset, b: ReactionAsset): number {
  const categoryDifference = REACTION_VISUAL_CATEGORY_PRIORITY[b.visualCategory ?? "generic"]
    - REACTION_VISUAL_CATEGORY_PRIORITY[a.visualCategory ?? "generic"];
  return categoryDifference;
}

export function inferReactionMoodFromTitle(title?: string): CreativePlan["reactionMood"] | undefined {
  const descriptor = (title ?? "").toLowerCase();
  if (/\b(cry|crying|tears|sad|defeated|heartbroken)\b/.test(descriptor)) return "crying";
  if (/\b(panic|panicked|scared|nervous|stressed|freaking out|anxious)\b/.test(descriptor)) return "panic";
  if (/\b(shock|shocked|surprise|surprised|disbelief|gasp|wow)\b/.test(descriptor)) return "shocked";
  if (/\b(relief|relieved|sigh|finally|calm|feel better)\b/.test(descriptor)) return "relief";
  if (/\b(smug|confident|eyebrow|side eye|winning)\b/.test(descriptor)) return "smug";
  if (/\b(celebrate|celebrating|celebration|happy dance|laughing|victory|cheering)\b/.test(descriptor)) return "celebrating";
  if (/\b(confused|confusion|what|huh|thinking|unsure|puzzled)\b/.test(descriptor)) return "confused";
  return undefined;
}
