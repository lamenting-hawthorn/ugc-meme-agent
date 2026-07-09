import type { Intent, VibeOverride } from "@/lib/types";
import { extractFirstUrl } from "@/lib/scraping/extractUrl";

export function classifyIntent(message: string): { intent: Intent; vibeOverride?: VibeOverride } {
  const normalized = message.trim().toLowerCase();
  const hasUrl = Boolean(extractFirstUrl(message));

  if (hasUrl) return { intent: "generate_video" };
  if (/^(yes|yep|yeah|yes video|video|make video|make the video|generate video|go ahead|go on)$/i.test(normalized)) {
    return { intent: "generate_video" };
  }
  if (/less\s+cringe|cleaner|tone\s+it\s+down/.test(normalized)) {
    return { intent: "change_vibe", vibeOverride: "less-cringe" };
  }
  if (/dramatic|cinematic|intense/.test(normalized)) {
    return { intent: "change_vibe", vibeOverride: "dramatic" };
  }
  if (/funnier|funny|more\s+gen\s*z|genz|chaotic/.test(normalized)) {
    return { intent: "change_vibe", vibeOverride: normalized.includes("chaotic") ? "chaotic" : "funny" };
  }
  if (/again|another|regenerate|try another|different gif|new version/.test(normalized)) {
    return { intent: "regenerate" };
  }
  if (/what can you do|how does this work|capabilit|help/.test(normalized)) {
    return { intent: "capability" };
  }
  if (/^(hi|hey|hello|yo|gm|good morning|sup)[!. ]*$/.test(normalized)) {
    return { intent: "small_talk" };
  }
  return { intent: "needs_url" };
}

export function replyForIntent(intent: Intent): string {
  if (intent === "small_talk") return "hey - send me a product URL and I'll turn it into a short UGC-style meme ad.";
  if (intent === "capability") {
    return "I read a product URL, find the user pain point, write a meme-native caption, match reaction/audio/background assets, and render a vertical MP4.";
  }
  return "Send me a product URL plus one line about what it does, and I'll make the first meme ad version.";
}
