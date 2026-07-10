import type { CreativePlan, ReactionAsset, SelectedAssets } from "@/lib/types";
import { fetchGiphyCandidates } from "@/lib/assets/giphy";
import { fetchPexelsBackgroundCandidates } from "@/lib/assets/pexels";
import { fetchFreesoundCandidates } from "@/lib/assets/freesound";
import { loadManifest } from "@/lib/assets/manifest";
import { rerankReactionCandidatesWithVision } from "@/lib/llm/openrouterVision";
import { scoreAudio, scoreBackground, scoreReaction } from "@/lib/assets/scoring";
import { logger } from "@/lib/utils/logger";

export async function selectAssets(plan: CreativePlan, excludeReactionIds?: string[]): Promise<SelectedAssets> {
  const manifest = loadManifest();
  const [giphyCandidates, pexelsBackgrounds, freesoundAudio] = await Promise.all([
    withDeadline(fetchGiphyCandidates(plan), 8500, "GIPHY"),
    withDeadline(fetchPexelsBackgroundCandidates(plan), 8500, "Pexels"),
    withDeadline(fetchFreesoundCandidates(plan), 8500, "Freesound")
  ]);
  const filteredGiphyCandidates = giphyCandidates.filter((candidate) => passesReactionQualityGate(candidate));

  let reactionPool: ReactionAsset[] = filteredGiphyCandidates;
  let usedLocalFallback = false;

  if (reactionPool.length > 0) {
    // Prefer transparent overlays because they preserve the background and
    // make the reaction feel like the reference creator edits. Full-frame GIFs
    // remain a fallback when GIPHY returns no usable sticker candidates.
    const stickerCandidates = reactionPool.filter((candidate) => candidate.hasTransparentBackground);
    reactionPool = stickerCandidates.length > 0 ? stickerCandidates : reactionPool;
  } else {
    // GIPHY returned no usable candidates — fall back to the local manifest
    // clips so the demo keeps working without an external reaction source.
    logger.warn("GIPHY returned no usable reaction candidates; using local fallback reactions", {
      giphyReturned: giphyCandidates.length
    });
    reactionPool = manifest.reactions;
    usedLocalFallback = true;
  }

  // Exclude reactions from a previous cut when the user asked for a different one.
  if (excludeReactionIds?.length) {
    reactionPool = reactionPool.filter((r) => !excludeReactionIds.includes(r.id));
  }
  // If exclusion emptied the pool, reset to the full local set.
  if (reactionPool.length === 0) {
    reactionPool = manifest.reactions;
  }

  const heuristicReactions = [...reactionPool].sort(
    (a, b) => scoreReaction(plan, b) - scoreReaction(plan, a)
  );

  // Vision reranking only helps for remote candidates. Skip it for local clips.
  const visionRerank = usedLocalFallback ? null : await rerankReactionCandidatesWithVision(plan, heuristicReactions);
  let reactions = visionRerank?.ranked ?? heuristicReactions;

  if (reactions.length === 0) {
    logger.warn("All reaction candidates rejected by vision rerank; using local fallback reactions");
    reactions = [...manifest.reactions].sort((a, b) => scoreReaction(plan, b) - scoreReaction(plan, a));
    usedLocalFallback = true;
  }

  const audio = [...freesoundAudio, ...manifest.audio].sort((a, b) => scoreAudio(plan, b) - scoreAudio(plan, a))[0];
  const staticPexelsBackgrounds = pexelsBackgrounds.filter((candidate) => candidate.type === "image");
  const backgroundCandidates = staticPexelsBackgrounds.length > 0 ? staticPexelsBackgrounds : manifest.backgrounds;
  const background = backgroundCandidates.sort((a, b) => scoreBackground(plan, b) - scoreBackground(plan, a))[0];

  const reaction = reactions[0];
  const runnerUpReaction = reactions.find((candidate) => candidate.id !== reaction.id);
  const reactionScore = scoreReaction(plan, reaction).toFixed(2);
  const runnerUpScore = runnerUpReaction ? scoreReaction(plan, runnerUpReaction).toFixed(2) : undefined;

  return {
    background,
    reaction,
    audio,
    runnerUpReaction,
    reasons: [
      `${reaction.id} matched ${plan.reactionMood} with score ${reactionScore}${reaction.hasTransparentBackground ? " and transparent/sticker preferred" : ""}${reaction.visionScore !== undefined ? `; vision rerank ${reaction.visionScore.toFixed(2)}` : ""}${usedLocalFallback ? " (local fallback — GIPHY did not return usable candidates)" : ""}`,
      runnerUpReaction ? `Runner-up ${runnerUpReaction.id} scored ${runnerUpScore} for quick regeneration` : "No reaction runner-up available",
      `${audio.id} matched ${plan.audioMood} with score ${scoreAudio(plan, audio).toFixed(2)}`,
      `${background.id} kept the top caption zone clean; static background enforced`,
      visionRerank?.overallReason ?? `Vision rerank ${usedLocalFallback ? "skipped (local fallback)" : "unavailable"}; heuristic reaction ranking used`
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
