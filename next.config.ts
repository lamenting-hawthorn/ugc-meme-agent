import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname
  },
  // The installer resolves a platform-specific native package at runtime.
  // Keep it outside Turbopack's server bundle so Node can load it normally.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
  // Ensure the bundled @ffmpeg-installer/ffmpeg platform binary is included in
  // the serverless function bundle. nft traces require() calls but the binary's
  // platform-specific subdir may be optimised out; the include forces it.
  outputFileTracingIncludes: {
    "/api/*": [
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*",
      "./node_modules/@ffmpeg-installer/darwin-arm64/**/*",
      "./node_modules/@ffprobe-installer/ffprobe/**/*",
      "./node_modules/@ffprobe-installer/linux-x64/**/*",
      "./node_modules/@ffprobe-installer/darwin-arm64/**/*",
      "./node_modules/@ffprobe-installer/darwin-x64/**/*"
    ]
  }
};

export default nextConfig;
