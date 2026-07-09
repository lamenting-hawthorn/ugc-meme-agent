import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dirs = ["assets/backgrounds", "assets/audio", "assets/reactions-fallback"];
for (const dir of dirs) mkdirSync(path.join(root, dir), { recursive: true });

function run(args) {
  execFileSync("ffmpeg", ["-y", ...args], { stdio: "ignore" });
}

function createBackground(file, colorA, colorB, label) {
  const output = path.join(root, "assets/backgrounds", file);
  if (existsSync(output)) return;
  run([
    "-f", "lavfi",
    "-i", `color=${colorA}:s=512x910:d=1`,
    "-vf", `drawbox=x=0:y=455:w=512:h=455:color=${colorB}:t=fill,drawbox=x=48:y=620:w=416:h=170:color=white@0.08:t=fill`,
    "-frames:v", "1",
    output
  ]);
}

function createReaction(file, color) {
  const output = path.join(root, "assets/reactions-fallback", file);
  if (existsSync(output)) return;
  run([
    "-f", "lavfi",
    "-i", `color=${color}:s=360x360:d=4:r=30`,
    "-vf", "drawbox=x=35:y=35:w=290:h=290:color=black@0.25:t=8,drawbox=x=112:y=108:w=48:h=48:color=white@0.9:t=fill,drawbox=x=200:y=108:w=48:h=48:color=white@0.9:t=fill,drawbox=x=116:y=116:w=20:h=20:color=black@0.8:t=fill,drawbox=x=204:y=116:w=20:h=20:color=black@0.8:t=fill,drawbox=x=120:y=230:w=120:h=16:color=white@0.9:t=fill",
    "-an",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    output
  ]);
}

function createTone(file, frequency) {
  const output = path.join(root, "assets/audio", file);
  if (existsSync(output)) return;
  run([
    "-f", "lavfi",
    "-i", `sine=frequency=${frequency}:duration=8`,
    "-filter:a", "volume=0.18",
    "-q:a", "4",
    output
  ]);
}

createBackground("room-clean-01.jpg", "0x6f7f72", "0x2f493f");
createBackground("office-premium-01.jpg", "0x34424f", "0x1e2932");
createReaction("confused-local-01.mp4", "0x725ac1");
createReaction("panic-local-01.mp4", "0xd94848");
createReaction("relief-local-01.mp4", "0x3e8f68");
createReaction("shocked-local-01.mp4", "0xf59e0b");
createTone("funny-bounce-01.mp3", 520);
createTone("dramatic-hit-01.mp3", 180);
createTone("chill-loop-01.mp3", 330);
createTone("chaotic-beep-01.mp3", 760);

console.log("Seeded local demo assets.");
