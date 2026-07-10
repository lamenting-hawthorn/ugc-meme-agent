import type { ReactionVisualCategory } from "@/lib/types";

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
  if (/\b(human|person|people|celebrity|actor|actress|man|woman|guy|girl|boy|travolta|garfield|holland)\b/.test(descriptor)) {
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
