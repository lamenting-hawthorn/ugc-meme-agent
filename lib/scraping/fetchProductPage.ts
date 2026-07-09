import { validatePublicHttpUrl } from "@/lib/scraping/validateUrl";

export type ProductPageSnapshot = {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  text: string;
  fetchOk: boolean;
  error?: string;
};

const MAX_TEXT_CHARS = 6000;

export async function fetchProductPage(url: string): Promise<ProductPageSnapshot> {
  const validatedUrl = validatePublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(validatedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "ugc-meme-agent/0.1 product-preview-bot"
      }
    });
    const html = await response.text();
    return {
      url: validatedUrl.toString(),
      finalUrl: response.url,
      title: readTag(html, "title") || readMeta(html, "og:title"),
      description: readMeta(html, "description") || readMeta(html, "og:description"),
      text: stripHtml(html).slice(0, MAX_TEXT_CHARS),
      fetchOk: response.ok
    };
  } catch (error) {
    return {
      url: validatedUrl.toString(),
      finalUrl: validatedUrl.toString(),
      title: "",
      description: "",
      text: "",
      fetchOk: false,
      error: error instanceof Error ? error.message : "unknown fetch error"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readTag(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decode(match?.[1] ?? "").trim();
}

function readMeta(html: string, name: string): string {
  const escaped = name.replace(":", "\\:");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]).trim();
  }
  return "";
}

function stripHtml(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
