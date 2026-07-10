import { formatConversationMemory } from "@/lib/chat/memory";
import type { ConversationMemoryEntry, ProductUnderstanding } from "@/lib/types";
import { callDeepSeekJsonDetailed } from "@/lib/llm/deepseek";
import type { ProductPageSnapshot } from "@/lib/scraping/fetchProductPage";
import { productUnderstandingSchema } from "@/lib/llm/schemas";
import { logger } from "@/lib/utils/logger";

export async function analyzeProduct(
  message: string,
  productUrl: string,
  page: ProductPageSnapshot,
  conversationMemory?: ConversationMemoryEntry[]
): Promise<ProductUnderstanding> {
  const llmResult = await analyzeWithDeepSeek(message, productUrl, page, conversationMemory);
  if (llmResult) return llmResult;
  return analyzeDeterministically(message, productUrl, page);
}

async function analyzeWithDeepSeek(
  message: string,
  productUrl: string,
  page: ProductPageSnapshot,
  conversationMemory?: ConversationMemoryEntry[]
): Promise<ProductUnderstanding | null> {
  try {
    const result = await callDeepSeekJsonDetailed([
      {
        role: "system",
        content:
          "You are a product and meme-ad strategist for short-form UGC videos. Return only valid JSON. Focus on the painful old workflow and emotional contrast. Use these exact enum values: emotionalBeforeState = confused | stressed | annoyed | bored | overwhelmed | embarrassed; emotionalAfterState = relieved | confident | smug | happy | calm."
      },
      {
        role: "user",
        content: [
          `User message: ${message}`,
          `Product URL: ${productUrl}`,
          `Website title: ${page.title}`,
          `Website description: ${page.description}`,
          `Extracted website text: ${page.text.slice(0, 3500)}`,
          formatConversationMemory(conversationMemory),
          "",
          "Return JSON with productName, productUrl, category, oneLineSummary, targetUser, userPain, oldWorkflow, productBenefit, emotionalBeforeState, emotionalAfterState, memeAngles.",
          "Example JSON shape:",
          JSON.stringify({
            productName: "calai.app",
            productUrl,
            category: "fitness / calorie tracking",
            oneLineSummary: "CalAI helps users track calories and macros with less manual work.",
            targetUser: "people tracking food and macros",
            userPain: "manual calorie and macro logging is tedious and confusing",
            oldWorkflow: "guessing calories and manually entering food items",
            productBenefit: "handles calorie and macro tracking more automatically",
            emotionalBeforeState: "confused",
            emotionalAfterState: "relieved",
            memeAngles: ["pretending to understand macros", "still logging calories manually"]
          })
        ].join("\n")
      }
    ]);
    if (!result.ok) {
      logger.warn("Structured product analysis unavailable; using deterministic fallback", {
        provider: result.provider,
        model: result.model,
        reason: result.reason,
        detail: result.detail,
        elapsedMs: result.elapsedMs
      });
      return null;
    }
    return { ...productUnderstandingSchema.parse(JSON.parse(result.content)), source: result.provider };
  } catch (error) {
    logger.warn("Structured product analysis returned invalid JSON; using deterministic fallback", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

function analyzeDeterministically(message: string, productUrl: string, page: ProductPageSnapshot): ProductUnderstanding {
  const host = new URL(productUrl).hostname.replace(/^www\./, "");
  const productName = cleanName(page.title) || host;
  const source = `${message} ${page.title} ${page.description} ${page.text}`.toLowerCase();
  const category = inferCategory(source);
  const pain = inferPain(category);
  const benefit = inferBenefit(category);

  return {
    productName,
    productUrl,
    category,
    oneLineSummary: page.description || `${productName} helps ${benefit}.`,
    targetUser: inferTargetUser(category),
    userPain: pain,
    oldWorkflow: inferOldWorkflow(category),
    productBenefit: benefit,
    emotionalBeforeState: category.includes("finance") ? "stressed" : "confused",
    emotionalAfterState: "relieved",
    memeAngles: [
      `pretending to understand ${shortPain(pain)}`,
      `still doing ${shortPain(pain)} manually`,
      `${shortPain(pain)} feeling like homework`
    ],
    source: "deterministic"
  };
}

function cleanName(title: string): string {
  return title.split(/[|-]/)[0]?.trim().slice(0, 36) ?? "";
}

function inferCategory(source: string): string {
  if (/calorie|macro|fitness|nutrition|diet/.test(source)) return "fitness / nutrition";
  if (/calendar|schedule|meeting|booking/.test(source)) return "calendar / scheduling";
  if (/invoice|finance|accounting|tax|expense/.test(source)) return "finance / operations";
  if (/developer|api|code|deploy|github/.test(source)) return "developer tools";
  if (/sales|crm|lead|customer/.test(source)) return "sales / CRM";
  if (/design|video|creative|content|social/.test(source)) return "creative tools";
  return "startup productivity";
}

function inferPain(category: string): string {
  if (category.includes("fitness")) return "manual calorie and macro tracking is tedious and confusing";
  if (category.includes("calendar")) return "scheduling people across calendars turns into tab juggling";
  if (category.includes("finance")) return "manual finance admin feels like doing homework with consequences";
  if (category.includes("developer")) return "shipping software gets slowed down by repetitive setup and debugging";
  if (category.includes("sales")) return "keeping track of leads manually gets messy fast";
  if (category.includes("creative")) return "making good content takes too many tools and too much blank-page energy";
  return "the old workflow is manual, slow, and weirdly stressful";
}

function inferOldWorkflow(category: string): string {
  if (category.includes("fitness")) return "guessing calories, searching foods, and logging every item";
  if (category.includes("calendar")) return "sending five messages just to find one meeting slot";
  if (category.includes("finance")) return "copying numbers between spreadsheets and hoping nothing breaks";
  if (category.includes("developer")) return "rewriting boilerplate and chasing tiny errors";
  if (category.includes("sales")) return "updating notes, spreadsheets, and follow-ups by hand";
  if (category.includes("creative")) return "jumping between tools until the idea stops being funny";
  return "doing the job manually across too many tabs";
}

function inferBenefit(category: string): string {
  if (category.includes("fitness")) return "track food and macros with less manual effort";
  if (category.includes("calendar")) return "find the right time without calendar chaos";
  if (category.includes("finance")) return "clean up finance admin with less manual checking";
  if (category.includes("developer")) return "move faster through setup, debugging, and delivery";
  if (category.includes("sales")) return "keep customer follow-up organized automatically";
  if (category.includes("creative")) return "turn an idea into usable content faster";
  return "turn the messy manual workflow into something calmer";
}

function inferTargetUser(category: string): string {
  if (category.includes("developer")) return "builders and technical teams";
  if (category.includes("sales")) return "founders and go-to-market teams";
  if (category.includes("fitness")) return "people tracking food, calories, and macros";
  return "busy operators who want fewer manual steps";
}

function shortPain(pain: string): string {
  return pain.replace(/ is .*/, "").replace(/^manual /, "");
}
