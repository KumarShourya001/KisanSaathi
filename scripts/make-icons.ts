/**
 * Generates the PWA icons.
 *
 * Written against node:zlib rather than adding an image library, because the
 * mark is geometry and a PNG encoder is about forty lines once zlib is doing
 * the compression. The install footprint of sharp is not worth two files.
 *
 *   npx tsx scripts/make-icons.ts
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ------------------------------------------------------------- PNG encoding

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size: number, rgba: Uint8Array): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type. Zero throughout: the image
  // is flat colour regions, so deflate handles it well without prediction.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ the mark

const FOREST: [number, number, number] = [0x2f, 0x5d, 0x3f];
const BONE: [number, number, number] = [0xf6, 0xf8, 0xf3];

/**
 * A bridge: deck, two towers, and a suspension arc. Drawn in a 512 unit space
 * and scaled, with everything inside the maskable safe zone so Android can
 * crop it to a circle without cutting the mark.
 */
function drawIcon(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const s = size / 512;
  const radius = 110 * s;

  const put = (x: number, y: number, c: [number, number, number], a = 255) => {
    const i = (y * size + x) * 4;
    // Source-over, so the arc antialiasing blends onto the background.
    const alpha = a / 255;
    px[i] = Math.round(px[i] * (1 - alpha) + c[0] * alpha);
    px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + c[1] * alpha);
    px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + c[2] * alpha);
    px[i + 3] = 255;
  };

  const inRoundedSquare = (x: number, y: number) => {
    const dx = Math.max(radius - x, 0, x - (size - radius));
    const dy = Math.max(radius - y, 0, y - (size - radius));
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRoundedSquare(x + 0.5, y + 0.5)) put(x, y, FOREST);
    }
  }

  const L = 110 * s;
  const R = 402 * s;
  const deckTop = 268 * s;
  const deckBottom = 292 * s;
  const towerTop = 150 * s;
  const towerW = 20 * s;
  const towers = [176 * s, 336 * s];
  const archHeight = 104 * s;
  const cableW = 15 * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (!inRoundedSquare(cx, cy)) continue;

      // Deck.
      if (cx >= L && cx <= R && cy >= deckTop && cy <= deckBottom) {
        put(x, y, BONE);
        continue;
      }

      // Towers.
      let onTower = false;
      for (const t of towers) {
        if (cx >= t - towerW / 2 && cx <= t + towerW / 2 && cy >= towerTop && cy <= deckBottom) {
          onTower = true;
          break;
        }
      }
      if (onTower) {
        put(x, y, BONE);
        continue;
      }

      // Suspension cable: a sine arc hung between the deck ends.
      if (cx >= L && cx <= R) {
        const phase = (cx - L) / (R - L);
        const cableY = deckTop - archHeight * Math.sin(Math.PI * phase);
        const dist = Math.abs(cy - cableY);
        if (dist <= cableW / 2) {
          // Feather the last pixel so the curve does not stair-step.
          const edge = cableW / 2 - dist;
          put(x, y, BONE, Math.min(255, Math.round(edge * 255 * 1.6)));
        }
      }
    }
  }

  return px;
}

// ---------------------------------------------------------------------- run

const out = resolve(process.cwd(), "public");
mkdirSync(out, { recursive: true });

for (const size of [192, 512]) {
  const file = resolve(out, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log(`wrote ${file}`);
}

// Favicon as SVG: same mark, no rasterisation needed.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#2F5D3F"/>
  <path d="M110 280 Q256 150 402 280" fill="none" stroke="#F6F8F3" stroke-width="15" stroke-linecap="round"/>
  <rect x="166" y="150" width="20" height="142" fill="#F6F8F3"/>
  <rect x="326" y="150" width="20" height="142" fill="#F6F8F3"/>
  <rect x="110" y="268" width="292" height="24" fill="#F6F8F3"/>
</svg>
`;
writeFileSync(resolve(out, "favicon.svg"), favicon);
console.log(`wrote ${resolve(out, "favicon.svg")}`);
