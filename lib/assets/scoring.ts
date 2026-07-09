import type { AudioAsset, BackgroundAsset, CreativePlan, ReactionAsset } from "@/lib/types";

const relatedMoods: Record<CreativePlan["reactionMood"], CreativePlan["reactionMood"][]> = {
  confused: ["panic", "shocked"],
  panic: ["confused", "crying", "shocked"],
  shocked: ["confused", "panic"],
  relief: ["smug", "celebrating"],
  smug: ["relief", "celebrating"],
  crying: ["panic", "confused"],
  celebrating: ["relief", "smug"]
};

export function scoreReaction(plan: CreativePlan, asset: ReactionAsset): number {
  const targetEnergy = energyForMood(plan.reactionMood);
  const mood = scoreMood(plan.reactionMood, asset.mood);
  const energy = scoreEnergy(targetEnergy, asset.energy);
  const semantic = scoreOverlap([...plan.giphyQueries, plan.caption], asset.tags);
  const layout = scoreLayout(asset);
  const sourceBoost = sourceReliability(asset);
  return weighted({ mood, energy, semantic, layout, sourceBoost });
}

export function scoreAudio(plan: CreativePlan, asset: AudioAsset): number {
  const mood = plan.audioMood === asset.mood ? 1 : 0.35;
  const energy = scoreEnergy(energyForAudio(plan.audioMood), asset.energy);
  const semantic = scoreOverlap([plan.caption, plan.reactionMood], asset.tags);
  const sourceBoost = asset.source === "local" ? 0.9 : 0.72;
  return mood * 0.45 + energy * 0.25 + semantic * 0.2 + sourceBoost * 0.1;
}

export function scoreBackground(plan: CreativePlan, asset: BackgroundAsset): number {
  const category = plan.backgroundCategory === asset.category ? 1 : 0.45;
  const mood = plan.backgroundMood === asset.mood ? 1 : 0.55;
  const layout = !asset.busyTopArea && asset.safeTextZone === "top" ? 1 : 0.25;
  const motionBoost = asset.type === "image" ? 0.9 : 0.45;
  const sourceBoost = asset.source === "local" ? 0.88 : 0.74;
  return category * 0.3 + mood * 0.25 + layout * 0.25 + motionBoost * 0.1 + sourceBoost * 0.1;
}

function scoreMood(target: CreativePlan["reactionMood"], candidate: CreativePlan["reactionMood"]): number {
  if (target === candidate) return 1;
  return relatedMoods[target]?.includes(candidate) ? 0.6 : 0.15;
}

function scoreEnergy(target: ReactionAsset["energy"], candidate: ReactionAsset["energy"]): number {
  if (target === candidate) return 1;
  if (target === "medium" || candidate === "medium") return 0.65;
  return 0.25;
}

function scoreLayout(asset: ReactionAsset): number {
  let score = 0.5;
  if (asset.type === "mp4" || asset.type === "webm") score += 0.2;
  if (asset.hasTransparentBackground) score += 0.15;
  const ratio = asset.width / asset.height;
  if (ratio > 0.6 && ratio < 1.6) score += 0.15;
  if (asset.width < 180 || asset.height < 180) score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

function sourceReliability(asset: ReactionAsset): number {
  if (asset.source === "local") return 0.9;
  if (asset.hasTransparentBackground) return 0.82;
  if (asset.type === "mp4") return 0.76;
  return 0.68;
}

function scoreOverlap(needles: string[], tags: string[]): number {
  const words = new Set(needles.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const hits = tags.filter((tag) => words.has(tag.toLowerCase())).length;
  return Math.min(1, hits / 3);
}

function weighted(scores: {
  mood: number;
  energy: number;
  semantic: number;
  layout: number;
  sourceBoost: number;
}): number {
  return scores.mood * 0.35 + scores.energy * 0.2 + scores.semantic * 0.2 + scores.layout * 0.15 + scores.sourceBoost * 0.1;
}

function energyForMood(mood: CreativePlan["reactionMood"]): ReactionAsset["energy"] {
  if (mood === "panic" || mood === "shocked" || mood === "celebrating") return "high";
  if (mood === "relief" || mood === "smug") return "low";
  return "medium";
}

function energyForAudio(mood: CreativePlan["audioMood"]): AudioAsset["energy"] {
  if (mood === "dramatic" || mood === "chaotic" || mood === "victory") return "high";
  if (mood === "chill") return "low";
  return "medium";
}
