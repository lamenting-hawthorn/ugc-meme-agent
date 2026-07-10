import type { CreativePlan, ReactionAsset, SelectedAssets } from "@/lib/types";
import { fetchGiphyCandidates } from "@/lib/assets/giphy";
import { fetchPexelsBackgroundCandidates } from "@/lib/assets/pexels";
import { fetchFreesoundCandidates } from "@/lib/assets/freesound";
import { loadManifest } from "@/lib/assets/manifest";
import { rerankReactionCandidatesWithVision } from "@/lib/llm/openrouterVision";
import { scoreAudio, scoreBackground, scoreReaction } from "@/lib/assets/scoring";

export async function selectAssets(plan: CreativePlan): Promise<SelectedAssets> {
  const manifest = loadManifest();
  const [giphyCandidates, pexelsBackgrounds, freesoundAudio] = await Promise.all([
    withDeadline(fetchGiphyCandidates(plan), 8500, "GIPHY"),
    withDeadline(fetchPexelsBackgroundCandidates(plan), 8500, "Pexels"),
    withDeadline(fetchFreesoundCandidates(plan), 8500, "Freesound")
  ]);
  const filteredGiphyCandidates = giphyCandidates.filter((candidate) => passesReactionQualityGate(candidate));
  // The checked-in clips are intentionally only development placeholders and
  // are geometric, not human reactions. Do not render them into a user-facing
  // ad; a clear provider error is better than shipping the purple box.
  if (filteredGiphyCandidates.length === 0) {
    throw new Error("No usable human reaction assets were returned by GIPHY");
  }
  // Prefer transparent overlays because they preserve the background and
  // make the reaction feel like the reference creator edits. Full-frame GIFs
  // remain a fallback when GIPHY returns no usable sticker candidates.
  const humanCandidates = filteredGiphyCandidates.filter((candidate) => hasHumanSignal(candidate));
  const qualityCandidates = humanCandidates.length > 0 ? humanCandidates : filteredGiphyCandidates;
  const stickerCandidates = qualityCandidates.filter((candidate) => candidate.hasTransparentBackground);
  const reactionCandidates = stickerCandidates.length > 0 ? stickerCandidates : qualityCandidates;
  const heuristicReactions = reactionCandidates.sort(
    (a, b) => scoreReaction(plan, b) - scoreReaction(plan, a)
  );
  const visionRerank = await rerankReactionCandidatesWithVision(plan, heuristicReactions);
  const reactions = visionRerank?.ranked ?? heuristicReactions;
  if (reactions.length === 0) {
    throw new Error("Qwen VL rejected every reaction candidate");
  }
  const audio = [...freesoundAudio, ...manifest.audio].sort((a, b) => scoreAudio(plan, b) - scoreAudio(plan, a))[0];
  const staticPexelsBackgrounds = pexelsBackgrounds.filter((candidate) => candidate.type === "image");
  const backgroundCandidates = staticPexelsBackgrounds.length > 0 ? staticPexelsBackgrounds : manifest.backgrounds;
  const background = backgroundCandidates.sort((a, b) => scoreBackground(plan, b) - scoreBackground(plan, a))[0];
  const reaction = reactions[0] ?? manifest.reactions[0];
  const runnerUpReaction = reactions.find((candidate) => candidate.id !== reaction.id);
  const reactionScore = scoreReaction(plan, reaction).toFixed(2);
  const runnerUpScore = runnerUpReaction ? scoreReaction(plan, runnerUpReaction).toFixed(2) : undefined;

  return {
    background,
    reaction,
    audio,
    runnerUpReaction,
    reasons: [
      `${reaction.id} matched ${plan.reactionMood} with score ${reactionScore}${reaction.hasTransparentBackground ? " and transparent/sticker preferred" : "; no usable sticker was returned"}${reaction.visionScore !== undefined ? `; vision rerank ${reaction.visionScore.toFixed(2)}` : ""}`,
      runnerUpReaction ? `Runner-up ${runnerUpReaction.id} scored ${runnerUpScore} for quick regeneration` : "No reaction runner-up available",
      `${audio.id} matched ${plan.audioMood} with score ${scoreAudio(plan, audio).toFixed(2)}`,
      `${background.id} kept the top caption zone clean; static background enforced`,
      visionRerank?.overallReason ?? "Vision rerank unavailable; heuristic reaction ranking used"
    ]
  };
}

async function withDeadline<T extends unknown[]>(task: Promise<T>, timeoutMs: number, provider: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${provider} asset search timed out`)), timeoutMs);
  });
  try {
    return (await Promise.race([task, fallback])) as T;
  } catch {
    return [] as unknown as T;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function passesReactionQualityGate(asset: ReactionAsset): boolean {
  if (asset.source !== "giphy") return true;
  const descriptor = `${asset.title ?? ""} ${asset.tags.join(" ")}`.toLowerCase();
  if (/logo|icon|symbol|geometric|pattern|abstract|scribble|sketch|doodle|line art|text|word art|typography/.test(descriptor)) {
    return false;
  }
  if (asset.width < 180 || asset.height < 180) return false;
  return true;
}

function hasHumanSignal(asset: ReactionAsset): boolean {
  const descriptor = `${asset.title ?? ""} ${asset.tags.join(" ")} ${asset.queryUsed ?? ""}`.toLowerCase();
  return /human|person|people|celebrity|actor|actress|man|woman|guy|girl|boy|face|travolta|rock|garfield|holland/.test(descriptor);
}
