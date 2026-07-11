import { writeFile } from "fs/promises";
import sharp from "sharp";

// Keep caption rendering independent of the deployment host's installed fonts.
const WIDTH = 512;
const HEIGHT = 250;
const HORIZONTAL_MARGIN = 28;
const VERTICAL_MARGIN = 8;
const MIN_SCALE = 2;
const MAX_SCALE = 5;
const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

const GLYPHS: Record<string, string[]> = {
  a: ["01110", "10001", "11111", "10001", "10001", "10001", "10001"],
  b: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  c: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  d: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  e: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  f: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  g: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  h: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  i: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  j: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  k: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  l: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  m: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  n: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  o: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  p: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  r: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  s: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  t: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  u: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  v: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  w: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  x: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01111", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "11110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"]
};

export async function writeCaptionImage(filePath: string, text: string): Promise<void> {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const layout = layoutCaption(text);
  const { lines, scale, lineHeight } = layout;
  const glyphWidth = GLYPH_WIDTH * scale;
  const startY = Math.max(VERTICAL_MARGIN, Math.floor((HEIGHT - layout.height) / 2));

  lines.forEach((line, lineIndex) => {
    const textWidth = measure(line, scale);
    let x = Math.max(HORIZONTAL_MARGIN, Math.floor((WIDTH - textWidth) / 2));
    const y = startY + lineIndex * lineHeight;

    for (const char of line) {
      if (char === " ") {
        x += glyphWidth;
        continue;
      }
      drawGlyph(pixels, x, y, char, scale, [0, 0, 0, 255], 2);
      drawGlyph(pixels, x, y, char, scale, [255, 255, 255, 255], 0);
      x += glyphWidth + scale * 2;
    }
  });

  const png = await sharp(pixels, {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 }
  }).png().toBuffer();
  await writeFile(filePath, png);
}

export function layoutCaption(text: string): {
  lines: string[];
  scale: number;
  lineHeight: number;
  width: number;
  height: number;
} {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9 .?!:'/-]+/g, "").replace(/\s+/g, " ").trim();
  const maxWidth = WIDTH - HORIZONTAL_MARGIN * 2;
  const maxHeight = HEIGHT - VERTICAL_MARGIN * 2;

  for (let scale = MAX_SCALE; scale >= MIN_SCALE; scale -= 1) {
    const lines = wrapByWidth(cleaned, scale, maxWidth);
    const lineHeight = GLYPH_HEIGHT * scale + Math.max(6, scale * 2 + 2);
    const width = Math.max(...lines.map((line) => measure(line, scale)), 0);
    const height = lines.length === 0
      ? 0
      : GLYPH_HEIGHT * scale + (lines.length - 1) * lineHeight;
    if (width <= maxWidth && height <= maxHeight) {
      return { lines, scale, lineHeight, width, height };
    }
  }

  throw new Error("Caption cannot fit inside the configured safe region");
}

function wrapByWidth(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(" ").filter(Boolean).flatMap((word) => splitWord(word, scale, maxWidth));
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = `${line} ${word}`.trim();
    if (line && measure(candidate, scale) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function splitWord(word: string, scale: number, maxWidth: number): string[] {
  if (measure(word, scale) <= maxWidth) return [word];
  const chunks: string[] = [];
  let chunk = "";
  for (const character of word) {
    const candidate = `${chunk}${character}`;
    if (chunk && measure(candidate, scale) > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function measure(line: string, scale: number): number {
  return [...line].reduce((width, char) => width + (char === " " ? GLYPH_WIDTH * scale : 7 * scale), 0);
}

function drawGlyph(
  pixels: Buffer,
  x: number,
  y: number,
  char: string,
  scale: number,
  color: [number, number, number, number],
  stroke: number
) {
  const glyph = GLYPHS[char] ?? GLYPHS["?"];
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] !== "1") continue;
      fillRect(pixels, x + col * scale - stroke, y + row * scale - stroke, scale + stroke * 2, scale + stroke * 2, color);
    }
  }
}

function fillRect(
  pixels: Buffer,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: [number, number, number, number]
) {
  for (let yy = Math.max(0, y); yy < Math.min(HEIGHT, y + rectHeight); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(WIDTH, x + rectWidth); xx += 1) {
      const index = (yy * WIDTH + xx) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }
}
