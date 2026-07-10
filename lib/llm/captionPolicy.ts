import type { ConversationMemoryEntry, ProductUnderstanding, VibeOverride } from "@/lib/types";

const MAX_CAPTION_LENGTH = 145;

export function previousGeneratedCaptions(memory?: ConversationMemoryEntry[]): string[] {
  return (memory ?? [])
    .filter((entry) => entry.type === "result_summary")
    .map((entry) => entry.rawText.trim())
    .filter(Boolean);
}

export function wasCaptionPreviouslyUsed(caption: string, memory?: ConversationMemoryEntry[]): boolean {
  const normalizedCaption = normalizeCaption(caption);
  return previousGeneratedCaptions(memory).some((previous) => normalizeCaption(previous) === normalizedCaption);
}

export function lacksConcreteProductAnchor(caption: string, product: ProductUnderstanding): boolean {
  const category = product.category.toLowerCase();
  if (!/business.*(?:operating system|\bos\b)|startup.*(?:toolkit|\bos\b)|entrepreneur/.test(category)) return false;
  return !/github|app|product|payment|marketing|support|analytic|legal|finance|brand|design|research|seo|fundrais/i.test(caption);
}

export function buildDistinctFallbackCaption(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  memory?: ConversationMemoryEntry[]
): string {
  const previous = new Set(previousGeneratedCaptions(memory).map(normalizeCaption));
  const generationCount = previous.size;
  const variants = captionVariants(product, vibeOverride);

  for (let offset = 0; offset < variants.length; offset += 1) {
    const candidate = variants[(generationCount + offset) % variants.length];
    if (!previous.has(normalizeCaption(candidate))) return candidate;
  }

  // Conversation memory retains at most five entries while every vibe has six
  // variants, so this is defensive rather than an expected path.
  return variants[generationCount % variants.length];
}

function captionVariants(product: ProductUnderstanding, vibeOverride?: VibeOverride): string[] {
  const host = new URL(product.productUrl).hostname.replace(/^www\./, "").toLowerCase();
  const workflow = specificWorkflow(product);
  const benefit = specificBenefit(product);

  const variantsByVibe: Partial<Record<VibeOverride, string[]>> = {
    dramatic: [
      `pov: ${workflow} until ${host} enters the chat`,
      `the plot twist is ${host} replacing ${workflow}`,
      `me surviving ${workflow} before discovering ${host}`,
      `${workflow} was the villain / ${host} is the redemption arc`,
      `the final boss was ${workflow} until ${host} showed up`,
      `me realizing ${host} can ${benefit}`
    ],
    funny: [
      `me taking credit after ${host} handles ${benefit}`,
      `me ${workflow} before i found ${host}`,
      `me retiring my ${workflow} routine after finding ${host}`,
      `${host} doing the work while i call it founder mode`,
      `my old workflow watching me open ${host} instead`,
      `me discovering ${host} after making ${workflow} my personality`
    ],
    "less-cringe": [
      `${workflow} / ${host} handling it from one place`,
      `me after realizing ${host} can ${benefit}`,
      `${host}: one place to ${benefit}`,
      `replacing ${workflow} with ${host}`,
      `less time on ${workflow}, more time building with ${host}`,
      `${host} makes ${benefit} the simpler option`
    ],
    premium: [
      `${workflow} / ${host} handling it from one place`,
      `me after realizing ${host} can ${benefit}`,
      `${host}: one place to ${benefit}`,
      `replacing ${workflow} with ${host}`,
      `less time on ${workflow}, more time building with ${host}`,
      `${host} makes ${benefit} the simpler option`
    ],
    chaotic: [
      `me fighting ${workflow} / ${host} watching calmly`,
      `${workflow} chose violence so i chose ${host}`,
      `my workflow had twelve side quests before ${host}`,
      `me rage quitting ${workflow} and opening ${host}`,
      `${host} watching me finally stop ${workflow}`,
      `the chaos was ${workflow}; the fix was ${host}`
    ],
    genz: [
      `me fighting ${workflow} / ${host} watching calmly`,
      `${workflow} chose violence so i chose ${host}`,
      `my workflow had twelve side quests before ${host}`,
      `me rage quitting ${workflow} and opening ${host}`,
      `${host} watching me finally stop ${workflow}`,
      `the chaos was ${workflow}; the fix was ${host}`
    ]
  };

  const variants = (vibeOverride ? variantsByVibe[vibeOverride] : undefined) ?? [
    `me when i'm still ${workflow} instead of using ${host}`,
    `pov: ${workflow} until ${host} enters the chat`,
    `${workflow} manually / ${host} doing the boring part`,
    `me pretending ${workflow} is a normal way to work / ${host}`,
    `the relief of letting ${host} ${benefit}`,
    `me after replacing ${workflow} with ${host}`
  ];

  return variants.map(limitCaptionLength);
}

function specificWorkflow(product: ProductUnderstanding): string {
  const category = product.category.toLowerCase();
  if (/business operating system|startup toolkit|entrepreneur/.test(category)) {
    return "switching between github, payments, marketing, and support";
  }
  if (/fitness|nutrition/.test(category)) return "logging every calorie by hand";
  if (/calendar|scheduling/.test(category)) return "sending five messages to find one meeting time";
  if (/finance|operations/.test(category)) return "copying numbers between spreadsheets";
  if (/developer/.test(category)) return "rewriting setup and chasing deployment errors";
  if (/sales|crm/.test(category)) return "updating every lead and follow-up by hand";
  if (/creative/.test(category)) return "jumping between tools to make one post";
  return compactPhrase(product.oldWorkflow || product.userPain, 62);
}

function specificBenefit(product: ProductUnderstanding): string {
  const category = product.category.toLowerCase();
  if (/business operating system|startup toolkit|entrepreneur/.test(category)) {
    return "build the app, take payments, and run the business";
  }
  return compactPhrase(product.productBenefit, 58);
}

function compactPhrase(value: string, maxLength: number): string {
  const normalized = value.replace(/[.—]+$/, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return shortened || normalized.slice(0, maxLength);
}

function limitCaptionLength(caption: string): string {
  if (caption.length <= MAX_CAPTION_LENGTH) return caption;
  return `${caption.slice(0, MAX_CAPTION_LENGTH - 3).replace(/\s+\S*$/, "").trim()}...`;
}

function normalizeCaption(caption: string): string {
  return caption.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
