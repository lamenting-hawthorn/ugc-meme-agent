import type { CreativePlan, RenderPlan, SelectedAssets } from "@/lib/types";

export function buildRenderPlan(plan: CreativePlan, selectedAssets: SelectedAssets): RenderPlan {
  return {
    output: {
      width: 512,
      height: 910,
      fps: 30,
      durationSec: plan.durationSec
    },
    caption: {
      text: clampCaption(plan.caption),
      fontSize: plan.caption.length > 100 ? 26 : 31,
      maxWidth: 430
    },
    background: selectedAssets.background,
    reaction: selectedAssets.reaction,
    audio: selectedAssets.audio
  };
}

function clampCaption(caption: string): string {
  const cleaned = caption.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 145) return cleaned;
  return `${cleaned.slice(0, 134).replace(/\s+\S*$/, "")}...`;
}
