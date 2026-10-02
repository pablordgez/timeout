import {
  cloud,
  pixels,
  pixelRect as rect,
  sun,
  type Sprite,
} from "../../ui/pixel-art";
type C = Record<string, string>;
const dark = (c: C) => {
  const rgb = c.bg.match(/[\da-f]{2}/gi)?.map((v) => parseInt(v, 16));
  return (
    !!rgb &&
    rgb.length === 3 &&
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 100
  );
};
const wrap = (x: number, width: number) => ((x % width) + width) % width;

// Hand-drawn T-rex, with two alternating running frames.
export const dinoBody: Sprite = [
  "...............kkkkkkkk..",
  "..............kggggggggk.",
  "..............kgghkkgggk.",
  "..............kgghkkgggk.",
  "..............kggggggggk.",
  "..............kggggkkkk..",
  "..............kggggkhhk..",
  "..............kggggkkkk..",
  ".............kgggggk.....",
  "k...........kggggggk.....",
  "kgk........kgggggggk.....",
  "kggkk.....kggggggggkkkk..",
  ".kgggkkkkkggggghhgggggk.",
  ".kggggggggggggghhggkkkk.",
  "..kgggggggggggghhggk....",
  "...kkgggsgggggghhggk....",
  ".....kkgsggggghhhgk.....",
  ".......kkggggghhhk......",
  ".........kkgggkkk.......",
];
const feet: Sprite[] = [
  [
    ".........kgkkgk.........",
    ".........kgk.kgk........",
    ".........kggkkggk.......",
    ".........kkkkkkkk.......",
  ],
  [
    ".........kgkkgk.........",
    "........kgk..kgk........",
    "........kggk..kgk.......",
    "........kkkk..kkk.......",
  ],
  [
    ".........kgkkgk.........",
    ".........kgk..kgk.......",
    ".........kgk.kggk.......",
    ".........kkk.kkkk.......",
  ],
];
export const birdBody: Sprite = [
  "........kkk.........",
  ".......kgggkk.......",
  ".....kkggggggkk.....",
  "....kggggggghhhk....",
  "...kggggggghwwwhk...",
  "..kgggggggghwkkhk...",
  ".kkgggggggghwkkhk...",
  "kssgggggggghwwwhkk..",
  "kssggggggggghhhkoook",
  ".kkggggggggghhhkooook",
  "..kgggggggghhhhkkkk.",
  "...kgggggghhhhk.....",
  "....kksshhhhhkk.....",
  "......kkkkkkk.......",
];
const wings: Sprite[] = [
  [".kkkk...", "ksssskk.", "kshhsssk", ".kshhssk", "..kkkkk."],
  ["..kkkk..", ".ksssssk", "kshhhssk", ".ksssssk", "..kkkk.."],
];
function sky(
  ctx: CanvasRenderingContext2D,
  c: C,
  distance: number,
  water: boolean,
) {
  const night = dark(c);
  const bands = water
    ? night
      ? ["#122e42", "#20485a", "#386c73"]
      : ["#91c9db", "#b9e0df", "#dfead0"]
    : night
      ? ["#172638", "#344059", "#69566b"]
      : ["#b6d7de", "#ead9bd", "#f2c58f"];
  bands.forEach((color, i) =>
    rect(ctx, 0, i * 80, 720, i === 2 ? 280 : 80, color),
  );
  pixels(
    ctx,
    sun,
    { a: night ? "#e8e5bb" : "#fff0b8", h: night ? "#b4baa6" : "#fff8da" },
    558,
    64,
    4,
  );
  if (night)
    for (let i = 0; i < 21; i++)
      rect(ctx, (i * 137 + 18) % 720, (i * 43 + 12) % 150, 2, 2, "#dbe6dc");
  for (let i = 0; i < 4; i++)
    pixels(
      ctx,
      cloud,
      {
        h: night ? "#577487" : "#fff7e7",
        w: night ? "#79919c" : "#fff7e7",
        s: night ? "#426171" : "#d4e4dc",
      },
      Math.floor((wrap(i * 220 - distance * 0.035, 940) - 96) / 4) * 4,
      56 + (i % 3) * 32,
      4,
    );
}
export function desert(ctx: CanvasRenderingContext2D, c: C, distance: number) {
  const night = dark(c);
  sky(ctx, c, distance, false);
  for (let layer = 0; layer < 3; layer++) {
    const drift = Math.floor((distance * (0.025 + layer * 0.04)) / 4) * 4;
    const base = 240 + layer * 40,
      colors = night
        ? ["#4e4d66", "#75606a", "#9b7867"]
        : ["#bda6a1", "#ccac8b", "#c6946f"];
    for (let i = -1; i < 5; i++) {
      const x = i * 240 - (drift % 240),
        crest = base - (i % 2 ? 36 : 20);
      rect(ctx, x, base + 16, 240, 380 - base, colors[layer]);
      rect(ctx, x + 24, base, 184, 24, colors[layer]);
      rect(ctx, x + 48, crest + 8, 72, base - crest, colors[layer]);
      rect(ctx, x + 56, crest, 56, 8, colors[layer]);
      rect(ctx, x + 124, base + 4, 56, 12, colors[layer]);
      for (let stripe = 0; stripe < 3; stripe++)
        rect(
          ctx,
          x + 56 + stripe * 8,
          crest + 12 + stripe * 16,
          48 - stripe * 8,
          4,
          night ? "#baa08a" : "#dfba91",
        );
    }
  }
  for (let i = -1; i < 7; i++)
    cactus(
      ctx,
      i * 140 - wrap(distance * 0.16, 140),
      372,
      8,
      20 + (i % 2) * 12,
      night ? "#626454" : "#9b976a",
      2,
      false,
    );
  rect(ctx, 0, 376, 720, 4, night ? "#d2b58a" : "#ffdda5");
  rect(ctx, 0, 380, 720, 60, night ? "#574c49" : "#c9956c");
  rect(ctx, 0, 384, 720, 4, night ? "#8d7360" : "#dfa676");
  for (let i = 0; i < 45; i++) {
    const x = Math.floor(wrap(i * 83 - distance, 760) / 4) * 4;
    rect(
      ctx,
      x,
      396 + (i % 5) * 8,
      i % 3 === 0 ? 12 : 4,
      4,
      night ? "#887062" : "#a77858",
    );
  }
}
const tree: Sprite = [
  "....gggg....",
  "..gggggggg..",
  ".ggghhggggg.",
  "ggghhhgggggg",
  "gggggggggggg",
  ".gggggggggg.",
  "..gggggggg..",
  ".....kk.....",
  ".....kk.....",
  ".....kk.....",
];
export function wetland(ctx: CanvasRenderingContext2D, c: C, distance: number) {
  const night = dark(c);
  sky(ctx, c, distance, true);
  for (let layer = 0; layer < 3; layer++) {
    const drift = Math.floor((distance * (0.025 + layer * 0.04)) / 4) * 4,
      y = 228 + layer * 48;
    const color = night
      ? ["#305664", "#386b6b", "#42816e"][layer]
      : ["#96bbac", "#6fa38f", "#4d8778"][layer];
    rect(ctx, 0, y + 48, 720, 180, color);
    for (let i = -1; i < 9; i++) {
      const x = i * 112 - (drift % 112);
      pixels(
        ctx,
        tree,
        { g: color, h: night ? "#4b8b78" : "#9abd96", k: color },
        x,
        y + (i % 2) * 8,
        4,
      );
      rect(ctx, x + 12, y + 40, 80, 24, color);
    }
  }
  rect(ctx, 0, 364, 720, 76, night ? "#214654" : "#539ba5");
  for (let i = 0; i < 24; i++)
    rect(
      ctx,
      Math.floor(wrap(i * 117 - distance * 0.3, 780) / 4) * 4,
      372 + (i % 8) * 8,
      12 + (i % 3) * 8,
      4,
      night ? "#3c7180" : "#8dc7c6",
    );
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(wrap(i * 141 - distance * 0.4, 840) / 4) * 4;
    rect(ctx, x, 420, 24, 4, "#376958");
    rect(ctx, x + 4, 416, 16, 4, "#659d72");
    rect(ctx, x + 28, 400, 4, 40, "#376958");
    rect(ctx, x + 24, 392, 8, 12, "#a39763");
  }
}
export function cactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  h: number,
  color = "#55896b",
  variant = 0,
  outline = true,
) {
  x = Math.round(x);
  ground = Math.round(ground);
  w = Math.round(w);
  h = Math.round(h);
  const edge = outline ? "#254b3d" : color,
    stem = Math.max(4, Math.round(w * 0.45));
  rect(ctx, x + 2, ground - h, w - 4, h, edge);
  rect(ctx, x, ground - h + 4, w, h - 4, edge);
  rect(ctx, x + 2, ground - h + 4, w - 4, h - 4, color);
  rect(ctx, x + 4, ground - h + 4, 2, h - 8, "#8bb28a");
  if (variant !== 2) {
    rect(ctx, x - stem, ground - h * 0.68, stem, h * 0.35, edge);
    rect(
      ctx,
      x - stem + 2,
      ground - h * 0.68 + 2,
      stem - 2,
      h * 0.35 - 4,
      color,
    );
    rect(ctx, x - stem, ground - h * 0.38, stem + 2, 4, edge);
  }
  if (variant !== 1) {
    rect(ctx, x + w, ground - h * 0.82, stem, h * 0.36, edge);
    rect(ctx, x + w, ground - h * 0.82 + 2, stem - 2, h * 0.36 - 4, color);
    rect(ctx, x + w - 2, ground - h * 0.49, stem + 2, 4, edge);
  }
  if (outline && variant === 1) {
    rect(ctx, x + w / 2 - 3, ground - h - 4, 6, 4, "#d87973");
    rect(ctx, x + w / 2 - 1, ground - h - 6, 2, 2, "#ffe1ac");
  }
}
export function dinosaur(
  ctx: CanvasRenderingContext2D,
  time: number,
  height: number,
  _landing: number,
  reduced: boolean,
) {
  const palette = { k: "#213f3f", g: "#66a68c", s: "#448570", h: "#bfdbab" };
  const x = 74,
    y = 334 - Math.round(height);
  pixels(ctx, dinoBody, palette, x, y, 2);
  pixels(
    ctx,
    feet[reduced || height > 0 ? 0 : 1 + (Math.floor(time * 12) % 2)],
    palette,
    x,
    y + 38,
    2,
  );
}
export function bird(
  ctx: CanvasRenderingContext2D,
  y: number,
  _vy: number,
  time: number,
  flap: boolean,
  reduced: boolean,
) {
  const palette = {
    k: "#513b37",
    g: "#edbd58",
    s: "#c78347",
    h: "#ffe2a3",
    w: "#fff8e3",
    o: "#e78246",
  };
  pixels(ctx, birdBody, palette, 130, y - 14, 2);
  pixels(
    ctx,
    wings[reduced ? 1 : flap ? 0 : Math.floor(time * 8) % 2],
    palette,
    134,
    y - (flap && !reduced ? 10 : 2),
    2,
  );
}
export function reedPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  gap: number,
  half: number,
  c: C,
) {
  x = Math.round(x);
  gap = Math.round(gap);
  half = Math.round(half);
  const night = dark(c),
    edge = "#284e48",
    base = night ? "#467c6d" : "#61976f",
    highlight = night ? "#78a17b" : "#a8c88a";
  const section = (y: number, h: number, capY: number) => {
    rect(ctx, x, y, 58, h, edge);
    rect(ctx, x + 2, y, 52, h, base);
    rect(ctx, x + 6, y, 8, h, highlight);
    rect(ctx, x + 46, y, 8, h, edge);
    for (let yy = y + 28; yy < y + h - 14; yy += 40) {
      rect(ctx, x + 2, yy, 52, 4, edge);
      rect(ctx, x + 16, yy + 4, 26, 2, highlight);
    }
    rect(ctx, x - 3, capY, 64, 14, edge);
    rect(ctx, x - 1, capY + 2, 60, 8, base);
    rect(ctx, x + 3, capY + 2, 50, 2, highlight);
  };
  section(0, gap - half, gap - half - 14);
  section(gap + half, 440 - gap - half, gap + half);
}
