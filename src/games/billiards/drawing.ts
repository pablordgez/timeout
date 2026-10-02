import {
  ballMask,
  pixels,
  pixelLine,
  pixelRect as rect,
  pixelText,
  sun,
} from "../../ui/pixel-art";
import {
  BOTTOM,
  HEAD,
  LEFT,
  R,
  RIGHT,
  TOP,
  pockets,
  type PoolState,
} from "./engine";
import { previewShot } from "./preview";
const names = [
  "white",
  "yellow",
  "blue",
  "red",
  "purple",
  "orange",
  "green",
  "maroon",
  "black",
  "yellow",
  "blue",
  "red",
  "purple",
  "orange",
  "green",
  "maroon",
];
const fallback = [
  "#f7f1d7",
  "#e4b950",
  "#5480cb",
  "#c9585b",
  "#a785bd",
  "#dc9755",
  "#568568",
  "#8b5058",
  "#232c37",
];
const fallbackTokens = [
  "card-bg",
  "piece-o",
  "piece-j",
  "piece-z",
  "piece-t",
  "piece-l",
  "piece-s",
  "piece-z",
  "card-black",
  "piece-o",
  "piece-j",
  "piece-z",
  "piece-t",
  "piece-l",
  "piece-s",
  "piece-z",
];
export function drawPool(
  ctx: CanvasRenderingContext2D,
  s: PoolState,
  c: Record<string, string>,
  practice = false,
) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, value: string) =>
    css.getPropertyValue("--" + name).trim() || value;
  const rail = token("pool-rail", "#78553f"),
    cloth = token("pool-cloth", c.felt);
  const numberFace = token("pool-number-face", "#fff4d9"),
    numberInk = token("pool-number-ink", "#222b35");
  const outline = token("pool-ball-outline", "#222b35"),
    stripe = token("pool-stripe-base", numberFace);
  rect(ctx, 0, 0, 720, 400, rail);
  // Rails, inlaid sights and woven cloth, all on a fixed integer grid.
  for (let i = 0; i < 32; i++) {
    rect(ctx, i * 24 + 4, 8 + (i % 3) * 4, 16, 2, "#ffffff16");
    rect(ctx, i * 24 + 12, 380 + (i % 3) * 4, 8, 2, "#00000025");
  }
  rect(ctx, LEFT - 6, TOP - 6, RIGHT - LEFT + 12, BOTTOM - TOP + 12, "#172e2c");
  rect(ctx, LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP, cloth);
  rect(ctx, LEFT, TOP, RIGHT - LEFT, 4, "#00000030");
  rect(ctx, LEFT, TOP, 4, BOTTOM - TOP, "#00000030");
  rect(ctx, LEFT + 4, BOTTOM - 4, RIGHT - LEFT - 4, 2, "#ffffff25");
  rect(ctx, RIGHT - 4, TOP + 4, 2, BOTTOM - TOP - 4, "#ffffff25");
  for (let y = TOP + 8; y < BOTTOM - 4; y += 16)
    for (let x = LEFT + 8; x < RIGHT - 4; x += 16)
      rect(ctx, x + (y % 32) / 2, y, 1, 1, "#ffffff13");
  for (const x of [112, 195, 278, 442, 525, 608])
    for (const y of [14, 386]) {
      rect(ctx, x - 3, y - 1, 6, 2, "#eed6a0");
      rect(ctx, x - 1, y - 3, 2, 6, "#eed6a0");
    }
  pixelLine(ctx, HEAD, TOP, HEAD, BOTTOM, "#ffffff38", 1, true);
  pockets.forEach(([x, y], i) => {
    pixels(
      ctx,
      sun,
      { a: token("pool-pocket", "#101c26"), h: "#101c26" },
      x - 18,
      y - 18,
      3,
    );
    pixelText(ctx, String(i + 1), x - 3, y < 200 ? 8 : 384, c.text, 2);
    if (
      !practice &&
      i === s.calledPocket &&
      !s.breakShot &&
      s.phase === "aim"
    ) {
      for (const [dx, dy] of [
        [-22, -22],
        [18, -22],
        [-22, 18],
        [18, 18],
      ]) {
        rect(ctx, x + dx, y + dy, 6, 2, c.accent);
        rect(ctx, x + dx, y + dy, 2, 6, c.accent);
      }
    }
  });
  const cue = s.balls.find((b) => b.id === 0)!;
  if (s.phase === "aim" && !s.inHand) {
    const preview = previewShot(s);
    if (preview) {
      for (const line of preview.lines)
        pixelLine(
          ctx,
          line.from.x,
          line.from.y,
          line.to.x,
          line.to.y,
          line.kind === "object"
            ? c.accent
            : line.kind === "bounce"
              ? c.muted
              : c.text,
          1,
          true,
        );
      const x = preview.contact.x,
        y = preview.contact.y;
      pixelLine(ctx, x - R, y - R, x + R, y - R, c.text, 1, true);
      pixelLine(ctx, x - R, y + R, x + R, y + R, c.text, 1, true);
      pixelLine(ctx, x - R, y - R, x - R, y + R, c.text, 1, true);
      pixelLine(ctx, x + R, y - R, x + R, y + R, c.text, 1, true);
    }
    const pull = Math.min(130, Number(s.pull) || 0),
      dx = Math.cos(s.angle),
      dy = Math.sin(s.angle);
    pixelLine(
      ctx,
      cue.x - dx * (85 + pull),
      cue.y - dy * (85 + pull),
      cue.x - dx * (16 + pull),
      cue.y - dy * (16 + pull),
      outline,
      3,
    );
    pixelLine(
      ctx,
      cue.x - dx * (82 + pull),
      cue.y - dy * (82 + pull),
      cue.x - dx * (19 + pull),
      cue.y - dy * (19 + pull),
      token("pool-cue", "#ddba7d"),
      2,
    );
    rect(
      ctx,
      cue.x - dx * (16 + pull) - 1,
      cue.y - dy * (16 + pull) - 1,
      3,
      3,
      "#a3d0ce",
    );
    if (pull) {
      rect(ctx, 265, 8, 190, 5, c.border);
      rect(ctx, 265, 8, (190 * s.power) / 1100, 5, c.accent);
    }
  }
  for (const b of s.balls) {
    if (b.pocketed) continue;
    const x = Math.round(b.x) - R,
      y = Math.round(b.y) - R;
    const color = token(
      "pool-ball-" + names[b.id],
      token(fallbackTokens[b.id], fallback[b.id > 8 ? b.id - 8 : b.id]),
    );
    rect(ctx, x + 3, y + 14, 12, 3, "#00000038");
    for (let row = 0; row < ballMask.length; row++)
      pixels(
        ctx,
        [ballMask[row]],
        {
          k: outline,
          b: b.id > 8 && (row < 5 || row > 10) ? stripe : color,
          h: "#fff4dc",
          s: "#00000050",
        },
        x,
        y + row,
      );
    if (b.id) {
      rect(ctx, x + 4, y + 5, 8, 6, numberFace);
      pixelText(ctx, String(b.id), x + (b.id > 9 ? 4 : 6), y + 5, numberInk, 1);
    }
    if (
      !practice &&
      b.id === s.calledBall &&
      !s.breakShot &&
      s.phase === "aim"
    ) {
      rect(ctx, x - 3, y - 3, 5, 2, c.accent);
      rect(ctx, x - 3, y - 3, 2, 5, c.accent);
      rect(ctx, x + 14, y + 17, 5, 2, c.accent);
      rect(ctx, x + 17, y + 14, 2, 5, c.accent);
    }
  }
}
