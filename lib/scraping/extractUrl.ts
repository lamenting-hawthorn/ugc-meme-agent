const URL_PATTERN = /((https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/[^\s]*)?)/i;

export function extractFirstUrl(message: string): string | null {
  const match = message.match(URL_PATTERN);
  if (!match) return null;

  const raw = match[1].replace(/[),.]+$/, "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
