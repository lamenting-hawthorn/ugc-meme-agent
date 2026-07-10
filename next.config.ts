import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Ensure the bundled @ffmpeg-installer/ffmpeg platform binary is included in
  // the serverless function bundle. nft traces require() calls but the binary's
  // platform-specific subdir may be optimised out; the include forces it.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/@ffmpeg-installer/**/*"]
  }
};

export default nextConfig;
