export type Intent = "small_talk" | "capability" | "generate_video" | "regenerate" | "change_vibe" | "needs_url";

export type VibeOverride = "funny" | "dramatic" | "genz" | "premium" | "chaotic" | "less-cringe";

export type ConversationMemoryEntry = {
  role: "user" | "assistant";
  type: "product_input" | "generation_request" | "feedback" | "vibe_change" | "clarification" | "result_summary";
  summary: string;
  rawText: string;
};

export type ProductUnderstanding = {
  productName: string;
  productUrl: string;
  category: string;
  oneLineSummary: string;
  targetUser: string;
  userPain: string;
  oldWorkflow: string;
  productBenefit: string;
  emotionalBeforeState: "confused" | "stressed" | "annoyed" | "bored" | "overwhelmed" | "embarrassed";
  emotionalAfterState: "relieved" | "confident" | "smug" | "happy" | "calm";
  memeAngles: string[];
  source?: "openrouter" | "deepseek" | "deterministic";
};

export type CreativePlan = {
  caption: string;
  memeFormat: "me-when" | "pov" | "before-after" | "pretending-to-know" | "manual-vs-automated" | "realization";
  humorStyle: "relatable" | "absurd" | "dry" | "genz" | "dramatic";
  reactionMood: "confused" | "panic" | "shocked" | "relief" | "smug" | "crying" | "celebrating";
  audioMood: "funny" | "dramatic" | "chill" | "chaotic" | "victory";
  backgroundCategory: "room" | "office" | "sky" | "phone" | "gradient" | "lifestyle";
  backgroundMood: "clean" | "premium" | "neutral" | "dramatic" | "funny";
  durationSec: number;
  template: "top-caption-bottom-reaction";
  giphyQueries: string[];
  source?: "openrouter" | "deepseek" | "deterministic";
  appliedSkillId?: "reaction-app-ugc-shorts";
};

export type ReactionAsset = {
  id: string;
  source: "local" | "giphy";
  filePathOrUrl: string;
  previewImageUrl?: string;
  type: "gif" | "mp4" | "webm";
  mood: CreativePlan["reactionMood"];
  energy: "low" | "medium" | "high";
  action: "thinking" | "dancing" | "crying" | "staring" | "celebrating" | "pointing";
  hasTransparentBackground: boolean;
  width: number;
  height: number;
  durationSec?: number;
  loopable: boolean;
  preferredPosition: "bottom-center" | "center" | "bottom-right";
  preferredScale: number;
  rating?: "g" | "pg" | "pg-13";
  tags: string[];
  title?: string;
  queryUsed?: string;
  visionScore?: number;
  visionReason?: string;
};

export type AudioAsset = {
  id: string;
  filePath: string;
  source?: "local" | "freesound";
  mood: CreativePlan["audioMood"];
  energy: "low" | "medium" | "high";
  durationSec: number;
  hasBeatDrop: boolean;
  beatDropAtSec?: number;
  license: "demo-local" | "royalty-free" | "licensed" | "freesound";
  tags: string[];
};

export type BackgroundAsset = {
  id: string;
  filePath: string;
  source?: "local" | "pexels";
  type: "image" | "video";
  category: CreativePlan["backgroundCategory"];
  mood: CreativePlan["backgroundMood"];
  busyTopArea: boolean;
  busyCenterArea: boolean;
  safeTextZone: "top" | "middle" | "bottom";
  tags: string[];
};

export type SelectedAssets = {
  background: BackgroundAsset;
  reaction: ReactionAsset;
  audio: AudioAsset;
  runnerUpReaction?: ReactionAsset;
  reasons: string[];
};

export type RenderPlan = {
  output: {
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  };
  caption: {
    text: string;
    fontSize: number;
    maxWidth: number;
  };
  background: BackgroundAsset;
  reaction: ReactionAsset;
  audio: AudioAsset;
};

export type GenerateVideoRequest = {
  message: string;
  vibeOverride?: VibeOverride;
  regenerateReactionOnly?: boolean;
  previousContext?: {
    productUnderstanding?: ProductUnderstanding;
    lastCreativePlan?: CreativePlan;
    lastReactionAssetId?: string;
    conversationMemory?: ConversationMemoryEntry[];
  };
};

export type GenerateVideoResponse = {
  status: "success" | "error";
  jobId?: string;
  videoUrl?: string;
  posterUrl?: string;
  caption?: string;
  productUnderstanding?: ProductUnderstanding;
  creativePlan?: CreativePlan;
  selectedAssets?: SelectedAssets;
  progress?: string[];
  error?: string;
  fallbackUsed?: boolean;
  llmProvider?: "openrouter" | "deepseek" | "deterministic";
  appliedSkillId?: "reaction-app-ugc-shorts";
};
