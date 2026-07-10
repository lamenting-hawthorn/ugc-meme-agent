import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0", "metadata.google.internal"]);
const DNS_LOOKUP_TIMEOUT_MS = 2500;

export function validatePublicHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("A valid product URL is required.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS product URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Product URLs cannot contain credentials.");
  }

  if (isPrivateOrLocalHost(url.hostname)) {
    throw new Error("Local and private network URLs are not allowed.");
  }

  return url;
}

/**
 * Validate DNS answers as well as the URL text. This closes the common SSRF
 * gap where a public hostname resolves to a private address.
 */
export async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (isIP(normalizeHost(url.hostname))) return;

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Product URL DNS lookup timed out.")), DNS_LOOKUP_TIMEOUT_MS);
  });
  let addresses: Array<{ address: string; family: number }>;
  const lookupTask = lookup(url.hostname, { all: true, verbatim: true }) as Promise<Array<{ address: string; family: number }>>;
  try {
    addresses = await Promise.race([lookupTask, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrLocalHost(address))) {
    throw new Error("The product URL resolves to a local or private network.");
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) return true;

  const family = isIP(host);
  if (family === 4) {
    const octets = host.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  if (family === 6) {
    const compact = host.replace(/^::ffff:/, "");
    if (isIP(compact) === 4) return isPrivateOrLocalHost(compact);
    return (
      host === "::" ||
      host === "::1" ||
      /^f[cd]/.test(host) ||
      /^fe[89ab]/.test(host)
    );
  }

  return false;
}
