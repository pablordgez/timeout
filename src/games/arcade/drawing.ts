import type { ArcadeState } from "./engines";
import { snakePositions } from "./snake-motion";
import { desert, wetland, dinosaur, bird, cactus, reedPipe } from "./art";
import {
  apple,
  ballMask,
  pixels,
  pixelRect,
  pixelText,
  pixelLine,
} from "../../ui/pixel-art";
import { suits } from "../../ui/pixel-art";

type Colors = Record<string, string>;
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  _r = 4,
) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function label(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  c: string,
  size = 18,
) {
  const scale = Math.max(1, Math.round(size / 7));
  pixelText(ctx, value, x, y - scale * 5, c, scale);
}
function runner(
  ctx: CanvasRenderingContext2D,
  s: ArcadeState,
  c: Colors,
  reduced: boolean,
) {
  const distance = reduced ? 0 : (s.distance ?? s.elapsed * s.speed);
  desert(ctx, c, distance);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#473b2b";
  box(
    ctx,
    86 + Math.min(10, s.y * 0.025),
    380,
    Math.max(8, 28 - s.y * 0.05),
    4,
  );
  ctx.restore();
  const landing = s.effect?.type === "land" ? s.effect.left / s.effect.full : 0;
  dinosaur(ctx, s.elapsed, s.y, reduced ? 0 : landing, reduced);
  for (const o of s.obstacles)
    cactus(ctx, o.x, 380, o.w, o.h, "#55896b", o.variant);
}
function flight(
  ctx: CanvasRenderingContext2D,
  s: ArcadeState,
  c: Colors,
  reduced: boolean,
) {
  wetland(
    ctx,
    c,
    reduced
      ? 0
      : s.elapsed *
          (s.difficulty === "easy" ? 125 : s.difficulty === "hard" ? 175 : 150),
  );
  for (const p of s.pipes)
    reedPipe(ctx, p.x, p.gap, p.half ?? s.gapHalf ?? 83, c);
  const next = s.pipes.find((p: any) => p.x + 58 > 140);
  if (next) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    pixelLine(
      ctx,
      next.x - 8,
      next.gap,
      next.x + 66,
      next.gap,
      c.accent,
      2,
      true,
    );
    ctx.restore();
  }
  if (!reduced && s.trail) {
    ctx.save();
    s.trail.forEach(([_x, y]: number[], i: number) => {
      ctx.globalAlpha = (i / s.trail.length) * 0.17;
      pixelRect(ctx, 144 - (s.trail.length - i) * 6, y, 6, 2, "#fff9e5");
    });
    ctx.restore();
  }
  bird(ctx, s.y, s.vy, s.elapsed, s.effect?.type === "flap", reduced);
}
function snake(
  ctx: CanvasRenderingContext2D,
  s: ArcadeState,
  c: Colors,
  reduced: boolean,
) {
  const cell = 19,
    x = 30,
    y = 35;
  ctx.fillStyle = c.surface;
  box(ctx, x, y, 380, 380, 8);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 20; i++) {
    pixelRect(ctx, x + i * cell, y, 1, 380, c.border);
    pixelRect(ctx, x, y + i * cell, 380, 1, c.border);
  }
  snakePositions(s, reduced).forEach(([a, b], i) => {
    const xx = x + a * cell,
      yy = y + b * cell;
    ctx.fillStyle = i === 0 ? c.text : c.accent;
    box(ctx, xx + 3, yy + 1, 13, 17);
    box(ctx, xx + 1, yy + 3, 17, 13);
    if (i > 0) {
      pixelRect(ctx, xx + 3, yy + 3, 5, 2, "#ffffff50");
      pixelRect(ctx, xx + 10, yy + 12, 5, 3, "#00000030");
    }
    if (i === 0) {
      ctx.fillStyle = c.bg;
      const [dx, dy] = s.direction;
      box(ctx, xx + 8 + dx * 4 - dy * 3, yy + 8 + dy * 4 + dx * 3, 3, 3, 1);
      box(ctx, xx + 8 + dx * 4 + dy * 3, yy + 8 + dy * 4 - dx * 3, 3, 3, 1);
    }
  });
  const fx = x + s.food[0] * cell + 9,
    fy = y + s.food[1] * cell + 9;
  pixels(
    ctx,
    apple,
    { r: c["piece-z"], h: "#ffe2b6", g: c["piece-s"], k: c.text },
    fx - 5,
    fy - 6,
  );
}
function breakout(ctx: CanvasRenderingContext2D, s: ArcadeState, c: Colors) {
  for (const b of s.bricks) {
    if (!b.hp) continue;
    ctx.fillStyle =
      b.hp > 1
        ? c.text
        : [c.accent, c["piece-o"], c["piece-i"], c["piece-s"], c["piece-j"]][
            Math.floor((b.y - 52) / 24)
          ];
    box(ctx, b.x, b.y, 58, 18, 3);
    ctx.fillStyle = "#ffffff35";
    box(ctx, b.x + 3, b.y + 2, 52, 3, 1);
    ctx.fillStyle = "#00000022";
    box(ctx, b.x + 2, b.y + 14, 54, 3, 1);
    if (b.hp > 1) {
      pixelRect(ctx, b.x + 24, b.y + 8, 3, 3, c.bg);
      pixelRect(ctx, b.x + 31, b.y + 8, 3, 3, c.bg);
    }
  }
  ctx.fillStyle = c.accent;
  const hit = s.effect?.type === "paddle" ? s.effect.left / s.effect.full : 0;
  box(ctx, s.paddle - 55, 398 - hit * 2, 110, 9 + hit * 2, 4);
  ctx.fillStyle = c.text;
  box(ctx, s.paddle - 45, 398 - hit * 2, 90, 2, 1);
  pixels(
    ctx,
    ballMask,
    { k: c.accent, b: c.text, h: "#fff5db", s: c.muted },
    s.x - 8,
    s.y - 8,
  );
  for (let i = 0; i < s.lives; i++)
    pixels(ctx, suits[1], { k: c["piece-z"] }, 16 + i * 24, 414, 2);
  label(ctx, `LV ${s.level}`, 108, 428, c.muted, 15);
  if (s.serve) {
    pixelLine(ctx, s.paddle, 368, s.paddle, 356, c.accent);
    pixelLine(ctx, s.paddle - 6, 362, s.paddle, 356, c.accent);
    pixelLine(ctx, s.paddle + 6, 362, s.paddle, 356, c.accent);
  }
}
export function drawArcade(
  ctx: CanvasRenderingContext2D,
  s: ArcadeState,
  c: Colors,
  reduced = false,
) {
  ctx.font = "18px " + (c["font-mono"] || "monospace");
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, 720, 440);
  if (s.kind === "runner") runner(ctx, s, c, reduced);
  if (s.kind === "flappy") flight(ctx, s, c, reduced);
  if (s.kind === "snake") snake(ctx, s, c, reduced);
  if (!reduced && s.trail && s.kind !== "flappy") {
    ctx.save();
    s.trail.forEach(([x, y]: number[], i: number) => {
      ctx.globalAlpha = (i / s.trail.length) * 0.2;
      pixelRect(ctx, x - 2, y - 2, 4, 4, c.accent);
    });
    ctx.restore();
  }
  if (s.kind === "breakout") breakout(ctx, s, c);
  if (s.effect) {
    const fx = s.effect,
      progress = 1 - fx.left / fx.full,
      x = s.kind === "snake" ? 30 + fx.x * 19 + 9 : fx.x,
      y = s.kind === "snake" ? 35 + fx.y * 19 + 9 : fx.y;
    ctx.save();
    ctx.globalAlpha = Math.max(0.1, 1 - progress);
    ctx.fillStyle = ctx.strokeStyle =
      fx.type === "impact" ? c["piece-z"] : c.accent;
    ctx.lineWidth = 2;
    if (!reduced && fx.type === "flap") {
      ctx.strokeStyle = "#fff9e5";
      ctx.globalAlpha = (1 - progress) * 0.65;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        pixelRect(ctx, x - 33 - progress * 12, y + 5 + i * 5, 12, 2, "#fff9e5");
      }
    } else if (!reduced && ["land", "jump"].includes(fx.type)) {
      ctx.fillStyle = "#c6a074";
      for (let i = 0; i < 6; i++) {
        const dx = (i % 2 ? -1 : 1) * (7 + progress * (12 + i * 3));
        box(ctx, x + dx, y - 2 - Math.sin(progress * Math.PI) * 5, 4, 2, 1);
      }
    } else if (!reduced) {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4,
          reach = 8 + progress * 35;
        box(
          ctx,
          x + Math.cos(angle) * reach,
          y + Math.sin(angle) * reach + progress * progress * 15,
          fx.type === "shatter" ? 5 : 3,
          3,
          1,
        );
      }
    }
    if (fx.value)
      label(
        ctx,
        fx.type === "milestone" ? `${fx.value}!` : `+${fx.value}`,
        x + 18,
        y - 10 - (reduced ? 0 : progress * 22),
        c.text,
        fx.type === "milestone" ? 26 : 18,
      );
    ctx.restore();
  }
  label(ctx, String(s.score).padStart(5, "0"), 18, 25, c.text);
  if (s.status !== "playing") {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = c.bg;
    box(ctx, s.kind === "snake" ? 130 : 265, 172, 180, 60, 12);
    ctx.restore();
    label(
      ctx,
      s.status === "won" ? "OK" : "×",
      s.kind === "snake" ? 198 : 336,
      215,
      c.accent,
      35,
    );
  }
}
