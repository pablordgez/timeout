/** Original canvas illustrations. Visual details never consume the gameplay random generator. */
type C = Record<string, string>;
const tau = Math.PI * 2;
function path(ctx: CanvasRenderingContext2D, fill: string, points: number[][]) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, tau);
  ctx.fill();
}
function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
) {
  if (h <= 0) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function dark(c: C) {
  const rgb = c.bg.match(/[\da-f]{2}/gi)?.map((v) => parseInt(v, 16));
  return (
    rgb?.length === 3 &&
    rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 100
  );
}
function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  fill: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  round(ctx, -20, 0, 85, 13, 7, fill);
  ellipse(ctx, 4, 0, 17, 13, fill);
  ellipse(ctx, 27, -5, 21, 18, fill);
  ellipse(ctx, 49, 1, 15, 11, fill);
  ctx.restore();
}

export function desert(ctx: CanvasRenderingContext2D, c: C, distance: number) {
  const night = dark(c),
    sky = ctx.createLinearGradient(0, 0, 0, 380);
  sky.addColorStop(0, night ? "#15273a" : "#e8f1f1");
  sky.addColorStop(0.65, night ? "#514657" : "#f6ddd0");
  sky.addColorStop(1, night ? "#77615a" : "#f3c994");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 720, 440);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ellipse(ctx, 565, 102, 63, 63, night ? "#dfe9cf" : "#efae74");
  ctx.globalAlpha = 1;
  ellipse(ctx, 565, 102, 32, 32, night ? "#eee8c6" : "#fff1cf");
  if (night) {
    ellipse(ctx, 557, 92, 5, 5, "#d6d1b2");
    ellipse(ctx, 580, 104, 7, 7, "#d6d1b2");
    for (let i = 0; i < 24; i++)
      ellipse(
        ctx,
        (i * 127 + 23) % 720,
        (i * 43 + 17) % 150,
        0.7,
        0.7,
        "#f2e5d2",
      );
  }
  ctx.restore();
  for (let i = 0; i < 4; i++)
    cloud(
      ctx,
      ((((i * 240 - distance * 0.035) % 1020) + 1020) % 1020) - 100,
      65 + (i % 2) * 57,
      0.8 + (i % 3) * 0.2,
      night ? "#625b69" : "#fff6ea",
    );
  for (let layer = 0; layer < 3; layer++) {
    const drift = distance * (0.025 + layer * 0.035),
      color = night
        ? ["#64576b", "#796364", "#99745e"][layer]
        : ["#ceb4ac", "#d8ae94", "#d09972"][layer];
    for (let i = -1; i < 5; i++) {
      const x = i * 270 - (drift % 270),
        world = i + Math.floor(drift / 270),
        y = 250 + layer * 35 + Math.sin(world * 2.17 + layer) * 30,
        crest = 35 + Math.cos(world * 1.7) * 19;
      path(ctx, color, [
        [x, 385],
        [x + 28, y + 12],
        [x + 60, y + 12],
        [x + 75, y - crest],
        [x + 116 + Math.sin(world) * 17, y - crest + 3],
        [x + 140, y + 18],
        [x + 205, y + 18],
        [x + 254, 385],
      ]);
      path(ctx, night ? "#ffffff08" : "#fff4dc24", [
        [x + 75, y - crest],
        [x + 116 + Math.sin(world) * 17, y - crest + 3],
        [x + 140, y + 18],
        [x + 102, y + 12],
        [x + 85, y + 90],
        [x + 60, y + 95],
      ]);
      ctx.save();
      ctx.globalAlpha = layer === 0 ? 0.13 : 0.25;
      ctx.strokeStyle = night ? "#b89b86" : "#fff0d0";
      ctx.lineWidth = 1;
      for (let stripe = 0; stripe < 4; stripe++) {
        const yy = y + 23 + stripe * 18;
        ctx.beginPath();
        ctx.moveTo(x + 39 - stripe * 3, yy);
        ctx.bezierCurveTo(
          x + 82,
          yy - 4,
          x + 165,
          yy + 6,
          x + 208 + stripe * 9,
          yy + 3,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  const drift = distance * 0.18;
  for (let i = -1; i < 9; i++) {
    const x = i * 125 - (drift % 125),
      y = 347 + (i % 3) * 7;
    cactus(
      ctx,
      x,
      y,
      9,
      22 + (i % 2) * 12,
      night ? "#696f64" : "#b09068",
      0,
      false,
    );
  }
  ctx.fillStyle = night ? "#806958" : "#dab88c";
  ctx.beginPath();
  ctx.moveTo(0, 374);
  for (let x = 0; x <= 720; x += 20)
    ctx.lineTo(x, 371 + Math.sin((x + distance * 0.22) / 120) * 5);
  ctx.lineTo(720, 440);
  ctx.lineTo(0, 440);
  ctx.fill();
  ctx.fillStyle = night ? "#bd9672" : "#f0cf9a";
  ctx.fillRect(0, 378, 720, 4);
  ctx.fillStyle = night ? "#503f3b" : "#c99c70";
  ctx.fillRect(0, 382, 720, 58);
  for (let i = 0; i < 40; i++) {
    const x = (((i * 83 - distance) % 810) + 810) % 810,
      y = 389 + ((i * 29) % 42);
    round(ctx, x, y, 3 + (i % 8), 2, 1, night ? "#846756" : "#ab815a");
    if (i % 7 === 0) {
      path(ctx, night ? "#806455" : "#dfb883", [
        [x, y],
        [x + 6, y - 5],
        [x + 13, y - 1],
        [x + 16, y + 2],
        [x, y + 2],
      ]);
    }
  }
}

export function wetland(ctx: CanvasRenderingContext2D, c: C, distance: number) {
  const night = dark(c),
    sky = ctx.createLinearGradient(0, 0, 0, 440);
  sky.addColorStop(0, night ? "#173141" : "#b5dce3");
  sky.addColorStop(0.6, night ? "#315d64" : "#e1f0db");
  sky.addColorStop(1, night ? "#2b5759" : "#91bcae");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 720, 440);
  ellipse(ctx, 580, 92, 34, 34, night ? "#e4e6c6" : "#fff5cd");
  ctx.save();
  ctx.globalAlpha = 0.12;
  ellipse(ctx, 580, 92, 58, 58, "#ffffff");
  ctx.restore();
  for (let i = 0; i < 5; i++)
    cloud(
      ctx,
      ((((i * 197 - distance * 0.025) % 980) + 980) % 980) - 95,
      65 + (i % 3) * 32,
      0.6 + (i % 2) * 0.25,
      night ? "#426b76" : "#eef7e9",
    );
  for (let layer = 0; layer < 3; layer++) {
    const y = 250 + layer * 35,
      drift = distance * (0.04 + layer * 0.06),
      fill = night
        ? ["#315761", "#35655f", "#3c7164"][layer]
        : ["#9dc0b1", "#81ad98", "#659886"][layer];
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 440);
    for (let x = 0; x <= 740; x += 20)
      ctx.lineTo(
        x,
        y + Math.sin((x + drift) / 97) * 18 + Math.sin((x + drift) / 43) * 8,
      );
    ctx.lineTo(720, 440);
    ctx.fill();
    for (let i = -1; i < 10; i++) {
      const x = i * 105 - (drift % 105),
        yy = y + 12 + Math.sin(i * 2) * 15;
      round(ctx, x, yy, 4, 45, 2, fill);
      ellipse(ctx, x + 2, yy - 3, 16, 23, fill);
      ellipse(ctx, x - 11, yy + 8, 13, 17, fill);
      ellipse(ctx, x + 13, yy + 8, 12, 16, fill);
    }
  }
  ctx.fillStyle = night ? "#203f4b" : "#72b0b7";
  ctx.fillRect(0, 365, 720, 75);
  for (let i = 0; i < 28; i++) {
    const x = (((i * 117 - distance * 0.3) % 790) + 790) % 790;
    round(
      ctx,
      x,
      375 + ((i * 13) % 64),
      13 + (i % 18),
      1,
      1,
      night ? "#436c73" : "#b0d7d4",
    );
  }
  for (let i = 0; i < 7; i++) {
    const x = (((i * 141 - distance * 0.4) % 850) + 850) % 850;
    ellipse(ctx, x, 411 + (i % 2) * 13, 17, 3, night ? "#426d60" : "#539c76");
    ctx.strokeStyle = night ? "#598376" : "#477659";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 12, 440);
    ctx.quadraticCurveTo(x + 7, 410, x + 17, 397);
    ctx.stroke();
  }
}

export function cactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  h: number,
  color = "#427a60",
  variant = 0,
  outline = true,
) {
  ctx.save();
  const edge = "#234638";
  const stem = (a: number, b: number, ww: number, hh: number) => {
    round(ctx, a, b, ww, hh, Math.min(ww / 2, 6), edge);
    round(
      ctx,
      a + 1.5,
      b + 1.5,
      ww - 3,
      hh - 2,
      Math.max(1, ww / 2 - 2),
      color,
    );
  };
  if (!outline) {
    round(ctx, x, ground - h, w, h, 3, color);
    round(ctx, x - w * 0.55, ground - h * 0.75, w * 0.65, h * 0.3, 3, color);
    ctx.restore();
    return;
  }
  ellipse(ctx, x + w * 0.5, ground + 2, w * 0.7, 3, "#00000018");
  stem(x, ground - h, w, h);
  const arm = w * 0.32;
  if (variant !== 2) {
    stem(x - arm * 0.8, ground - h * 0.63, arm * 0.95, h * 0.33);
    round(ctx, x - arm * 0.8, ground - h * 0.37, arm * 1.5, arm, 3, edge);
    round(
      ctx,
      x - arm * 0.8 + 1.5,
      ground - h * 0.37 + 1,
      arm * 1.5,
      arm - 2,
      2,
      color,
    );
  }
  if (variant !== 1) {
    stem(x + w - arm * 0.2, ground - h * 0.8, arm, h * 0.34);
    round(ctx, x + w - arm * 0.4, ground - h * 0.48, arm * 1.3, arm, 3, edge);
  }
  ctx.strokeStyle = "#ffffff3a";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 4, ground - h + 5);
    ctx.lineTo(x + (w * i) / 4, ground - 4);
    ctx.stroke();
  }
  if (variant === 1) {
    ellipse(ctx, x + w * 0.5, ground - h - 1, 3, 2, "#dc8170");
  }
  ctx.restore();
}

export function dinosaur(
  ctx: CanvasRenderingContext2D,
  time: number,
  height: number,
  landing: number,
  reduced: boolean,
) {
  ctx.save();
  ctx.translate(100, 380 - height);
  ctx.scale(1 + landing * 0.1, 1 - landing * 0.1);
  const step = reduced || height > 0 ? 0 : Math.sin(time * 22),
    ink = "#254441",
    body = "#65a68b",
    light = "#a9d0a5";
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  // A curved tapering tail, solid hips and a compact, unmistakable T-rex head.
  ctx.fillStyle = body;
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-5, -24);
  ctx.bezierCurveTo(-17, -17, -21, -15, -27, -24);
  ctx.bezierCurveTo(-24, -7, -13, -5, 2, -10);
  ctx.bezierCurveTo(10, -14, 11, -23, 6, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4b8c74";
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(-5, -3 + step * 3);
  ctx.lineTo(1, -2 + step * 3);
  ctx.lineTo(3, -5);
  ctx.lineTo(3, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-8, -24);
  ctx.bezierCurveTo(-7, -31, 1, -29, 2, -37);
  ctx.bezierCurveTo(1, -42, 4, -45, 9, -44);
  ctx.lineTo(21, -43);
  ctx.quadraticCurveTo(25, -42, 24, -36);
  ctx.lineTo(12, -34);
  ctx.lineTo(10, -19);
  ctx.quadraticCurveTo(9, -12, 1, -9);
  ctx.quadraticCurveTo(-10, -10, -8, -24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(10, -32);
  ctx.lineTo(12, -29);
  ctx.lineTo(9, -16);
  ctx.quadraticCurveTo(6, -12, 2, -13);
  ctx.quadraticCurveTo(7, -18, 10, -32);
  ctx.fill();
  ellipse(ctx, 9, -39, 3.1, 3.2, "#f6f0d8");
  ellipse(ctx, 10, -39, 1.5, 1.8, ink);
  ellipse(ctx, 20.5, -39, 0.9, 0.9, ink);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(13, -35);
  ctx.lineTo(22, -35);
  ctx.stroke();
  path(ctx, "#f6f0d8", [
    [15, -35],
    [17, -35],
    [16, -33],
  ]);
  ctx.fillStyle = body;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(1, -13);
  ctx.lineTo(-1, -3 - step * 3);
  ctx.lineTo(7, -2 - step * 3);
  ctx.lineTo(7, 0 - step * 3);
  ctx.lineTo(-4, 0 - step * 3);
  ctx.lineTo(-6, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, -24);
  ctx.lineTo(13, -22);
  ctx.lineTo(13, -19);
  ctx.stroke();
  for (let i = 0; i < 3; i++)
    ellipse(ctx, -5 + i * 4, -21 + (i % 2) * 3, 1.3, 1.6, "#3e7c67");
  ctx.restore();
}

export function bird(
  ctx: CanvasRenderingContext2D,
  y: number,
  vy: number,
  time: number,
  flap: boolean,
  reduced: boolean,
) {
  ctx.save();
  ctx.translate(150, y);
  ctx.rotate(reduced ? 0 : Math.max(-0.28, Math.min(0.85, vy / 530)));
  const ink = "#513d32";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = ink;
  path(ctx, "#cb8351", [
    [-9, -1],
    [-21, -5],
    [-17, 2],
    [-22, 5],
    [-9, 7],
  ]);
  ctx.fillStyle = "#f0ba56";
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.bezierCurveTo(-12, -9, -3, -13, 7, -9);
  ctx.bezierCurveTo(14, -7, 15, 1, 10, 7);
  ctx.bezierCurveTo(4, 14, -12, 10, -13, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff0c5";
  ctx.beginPath();
  ctx.moveTo(6, -7);
  ctx.bezierCurveTo(15, -5, 14, 7, 6, 9);
  ctx.bezierCurveTo(0, 9, 0, -6, 6, -7);
  ctx.fill();
  ctx.save();
  ctx.translate(-6, 2);
  ctx.rotate(reduced ? -0.2 : flap ? -0.65 : -0.05 + Math.sin(time * 12) * 0.1);
  ctx.fillStyle = "#d99442";
  ctx.beginPath();
  ctx.moveTo(5, -2);
  ctx.bezierCurveTo(-2, -7, -12, -7, -9, -1);
  ctx.bezierCurveTo(-8, 6, -1, 7, 5, -2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#b27539";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(1, 2);
  ctx.stroke();
  ctx.restore();
  ellipse(ctx, 8, -4, 3.4, 4.2, "#fffdf0");
  ellipse(ctx, 9, -4, 1.7, 2.1, ink);
  ellipse(ctx, 9.5, -5, 0.6, 0.7, "#fffdf0");
  path(ctx, "#e98541", [
    [12, 0],
    [20, 2],
    [13, 4],
  ]);
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(20, 2);
  ctx.lineTo(13, 4);
  ctx.stroke();
  ctx.strokeStyle = "#bd733a";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-1, -10);
  ctx.quadraticCurveTo(-1, -15, 3, -12);
  ctx.moveTo(3, -11);
  ctx.quadraticCurveTo(5, -15, 7, -11);
  ctx.stroke();
  ctx.restore();
}

export function reedPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  gap: number,
  half: number,
  c: C,
) {
  const night = dark(c),
    base = night ? "#44776c" : "#649c77",
    edge = night ? "#244c49" : "#315f49";
  const section = (y: number, h: number, capY: number) => {
    const shade = ctx.createLinearGradient(x, 0, x + 58, 0);
    shade.addColorStop(0, edge);
    shade.addColorStop(0.15, base);
    shade.addColorStop(0.35, night ? "#649888" : "#9fbe80");
    shade.addColorStop(0.7, base);
    shade.addColorStop(1, edge);
    round(ctx, x, y, 58, h, 3, shade);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y, 56, h);
    for (let yy = Math.max(y + 25, 25); yy < y + h - 12; yy += 44) {
      ctx.strokeStyle = "#153d332d";
      ctx.beginPath();
      ctx.moveTo(x + 3, yy);
      ctx.lineTo(x + 55, yy);
      ctx.stroke();
      round(ctx, x + 39, yy + 4, 8, 3, 1, "#ffffff18");
    }
    round(ctx, x - 3, capY, 64, 14, 3, edge);
    round(ctx, x - 1, capY + 2, 60, 9, 2, base);
    round(ctx, x + 3, capY + 3, 50, 2, 1, night ? "#75a184" : "#bed59c");
  };
  section(0, gap - half, gap - half - 14);
  section(gap + half, 440 - gap - half, gap + half);
  // A few trailing leaves give the obstacles the same material and setting as the world.
  ctx.strokeStyle = night ? "#659875" : "#487b55";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x + 48, gap - half - 18);
  ctx.quadraticCurveTo(x + 60, gap - half - 1, x + 46, gap - half + 9);
  ctx.stroke();
  ellipse(ctx, x + 48, gap - half + 5, 4, 2, night ? "#6caa81" : "#598c59");
}
