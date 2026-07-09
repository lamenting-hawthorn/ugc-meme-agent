import manifest from "@/assets/manifest.json";
import type { AudioAsset, BackgroundAsset, ReactionAsset } from "@/lib/types";

export function loadManifest(): {
  backgrounds: BackgroundAsset[];
  reactions: ReactionAsset[];
  audio: AudioAsset[];
} {
  return manifest as {
    backgrounds: BackgroundAsset[];
    reactions: ReactionAsset[];
    audio: AudioAsset[];
  };
}
