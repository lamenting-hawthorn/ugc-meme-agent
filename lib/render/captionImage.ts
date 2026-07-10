import { writeFile } from "fs/promises";

// Keep caption rendering independent of the deployment host's installed fonts.
// The output is PAM data despite the historical .png filename; FFmpeg detects
// it from the P7 magic header and handles it as an RGBA image.
const WIDTH = 512;
const HEIGHT = 250;
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
  const lines = fitLines(text.toLowerCase()).slice(0, 4);
  const scale = pickScale(lines);
  const glyphWidth = GLYPH_WIDTH * scale;
  const lineHeight = GLYPH_HEIGHT * scale + 12;
  const startY = Math.max(8, Math.floor((HEIGHT - lines.length * lineHeight) / 2));

  lines.forEach((line, lineIndex) => {
    const textWidth = measure(line, scale);
    let x = Math.max(28, Math.floor((WIDTH - textWidth) / 2));
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

  const header = Buffer.from(`P7\nWIDTH ${WIDTH}\nHEIGHT ${HEIGHT}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`);
  await writeFile(filePath, Buffer.concat([header, pixels]));
}

function fitLines(text: string): string[] {
  for (const maxChars of [18, 16, 14, 12]) {
    const lines = wrap(text, maxChars);
    if (lines.length <= 4) return lines;
  }
  return wrap(text, 12);
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.replace(/[^a-z0-9 .?!:'/-]+/g, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pickScale(lines: string[]): number {
  const maxTextWidth = WIDTH - 56;
  for (const scale of [5, 4, 3]) {
    const widestLine = Math.max(...lines.map((line) => measure(line, scale)), 0);
    if (widestLine <= maxTextWidth) return scale;
  }
  return 3;
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
