import { writeFile } from "fs/promises";
import sharp from "sharp";

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 250;

export async function writeCaptionImage(filePath: string, text: string): Promise<void> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    await writeFile(filePath, Buffer.from(buildEmptyPng()));
    return;
  }

  const lines = wrapText(cleaned);
  const fontSize = pickFontSize(lines);
  const svg = buildSvg(lines, fontSize);

  const png = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  await writeFile(filePath, png);
}

function wrapText(text: string): string[] {
  const maxCharsOptions = [32, 28, 24, 20];
  for (const maxChars of maxCharsOptions) {
    const lines = wrap(text, maxChars);
    if (lines.length <= 4) return lines;
  }
  return wrap(text, 20);
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pickFontSize(lines: string[]): number {
  const longest = Math.max(...lines.map((l) => l.length), 0);
  if (lines.length >= 4 || longest > 28) return 22;
  if (lines.length === 3 || longest > 20) return 26;
  return 31;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvg(lines: string[], fontSize: number): string {
  const lineHeight = Math.round(fontSize * 1.32);
  const totalTextHeight = lines.length * lineHeight;
  const startY = Math.max(46, Math.floor((CANVAS_HEIGHT - totalTextHeight) / 2));
  const halfWidth = CANVAS_WIDTH / 2;

  const textElements = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `      <text x="${halfWidth}" y="${y}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" font-family="'Arial','Helvetica Neue',sans-serif" font-weight="900" fill="white" stroke="black" stroke-width="5" paint-order="stroke fill" stroke-linejoin="round">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">${textElements}\n</svg>`;
}

function buildEmptyPng(): Uint8Array {
  // Minimal 1x1 transparent PNG
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);
}