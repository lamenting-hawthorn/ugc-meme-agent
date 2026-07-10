import os from "os";
import path from "path";

export function providerCacheDir(): string {
  // Vercel deploys application files under /var/task, which is read-only at
  // runtime. /tmp is writable but ephemeral, so this remains an optimization
  // rather than durable shared storage.
  const root = process.env.VERCEL === "1" ? os.tmpdir() : process.cwd();
  return path.join(root, ".cache", "asset-provider");
}
