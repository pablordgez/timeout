/** Each character is one hand-placed pixel; dots are transparent. */
export type Sprite = readonly string[];
export type Palette = Record<string, string>;

export function pixels(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  palette: Palette,
  x: number,
  y: number,
  size = 1,
) {
  const ox = Math.round(x),
    oy = Math.round(y);
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length;) {
      const pixel = sprite[row][col],
        start = col;
      while (col < sprite[row].length && sprite[row][col] === pixel) col++;
      const color = palette[pixel];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(
        ox + start * size,
        oy + row * size,
        (col - start) * size,
        size,
      );
    }
  }
}

export function pixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Bresenham steps keep even diagonal guides and cue sticks on the pixel grid. */
export function pixelLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  color: string,
  size = 2,
  dashed = false,
) {
  let x = Math.round(ax / size),
    y = Math.round(ay / size);
  const endX = Math.round(bx / size),
    endY = Math.round(by / size);
  const dx = Math.abs(endX - x),
    dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1,
    sy = y < endY ? 1 : -1;
  let error = dx + dy,
    step = 0;
  ctx.fillStyle = color;
  for (;;) {
    if (!dashed || step % 6 < 3) ctx.fillRect(x * size, y * size, size, size);
    if (x === endX && y === endY) break;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
    step++;
  }
}

const font: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001111",
  A: "010101111101101",
  B: "110101110101110",
  C: "111100100100111",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "111100101101111",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101111",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "101111111111101",
  O: "111101101101111",
  P: "111101111100100",
  Q: "111101101111001",
  R: "110101110101101",
  S: "111100111001111",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  "-": "000000111000000",
  "+": "000010111010000",
  ":": "000010000010000",
  ".": "000000000000010",
  "/": "001001010100100",
  "!": "010010010000010",
  "?": "111001010000010",
  "×": "000101010101000",
};
export function pixelText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  color: string,
  size = 2,
) {
  ctx.fillStyle = color;
  const text = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  [...text].forEach((char, i) => {
    const glyph = font[char];
    if (!glyph) return;
    for (let p = 0; p < 15; p++)
      if (glyph[p] === "1")
        ctx.fillRect(
          Math.round(x) + (i * 4 + (p % 3)) * size,
          Math.round(y) + Math.floor(p / 3) * size,
          size,
          size,
        );
  });
}

export const apple = [
  ".....gg....",
  "....gg.....",
  ".....k.....",
  "..rrr.rrr..",
  ".rrrrrrrrr.",
  "rrhhrrrrrrr",
  "rrhrrrrrrrr",
  "rrrrrrrrrrr",
  ".rrrrrrrrr.",
  "..rrrrrrr..",
  "...rr.rr...",
];
export const cloud = [
  "......hhhh......",
  ".....hwwwwh.....",
  "..hhhwwwwwwhh...",
  ".hwwwwwwwwwwwh..",
  "hwwwwwwwwwwwwwh.",
  "hwwwwwwwwwwwwwwh",
  ".ssssssssssssss.",
];
export const sun = [
  "....aaaa....",
  "..aaaaaaaa..",
  ".aaaaaaaaaa.",
  ".aahhaaaaaa.",
  "aaahhhaaaaaa",
  "aaahhaaaaaaa",
  "aaaaaaaaaaaa",
  "aaaaaaaaaaaa",
  ".aaaaaaaaaa.",
  ".aaaaaaaaaa.",
  "..aaaaaaaa..",
  "....aaaa....",
];
export const ballMask = [
  ".....kkkkkk.....",
  "...kkbbbbbbkk...",
  "..kbhhbbbbbbbk..",
  ".kbhhbbbbbbbbbk.",
  ".kbhbbbbbbbbbbk.",
  "kbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbk",
  "kbbbbbbbbbbbbbbk",
  ".kbbbbbbbbbbbsk.",
  ".kbbbbbbbbbbssk.",
  "..kbbbbbbbsssk..",
  "...kksssssskk...",
  ".....kkkkkk.....",
];
export const suits: Sprite[] = [
  [
    "....k....",
    "...kkk...",
    "..kkkkk..",
    ".kkkkkkk.",
    "kkkkkkkkk",
    "kkkkkkkkk",
    ".kkk.kkk.",
    "....k....",
    "...kkk...",
  ],
  [
    ".kk...kk.",
    "kkkk.kkkk",
    "kkkkkkkkk",
    "kkkkkkkkk",
    ".kkkkkkk.",
    "..kkkkk..",
    "...kkk...",
    "....k....",
    ".........",
  ],
  [
    "....k....",
    "...kkk...",
    "..kkkkk..",
    ".kkkkkkk.",
    "kkkkkkkkk",
    ".kkkkkkk.",
    "..kkkkk..",
    "...kkk...",
    "....k....",
  ],
  [
    "...kkk...",
    "..kkkkk..",
    "...kkk...",
    ".kk.k.kk.",
    "kkkkkkkkk",
    "kkkkkkkkk",
    ".kkk.kkk.",
    "....k....",
    "...kkk...",
  ],
];
