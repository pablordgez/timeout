import type { ArcadeState } from "./engines";

export function snakePositions(s: ArcadeState, reduced = false): number[][] {
  const t =
    reduced || s.status !== "playing"
      ? 1
      : Math.max(0, Math.min(1, s.clock / s.period));
  return s.snake.map(([x, y]: number[], i: number) => {
    // Old saves have no snapshot. Leave them still until the next grid step.
    const from = s.snakeFrom?.[i] ?? s.snakeFrom?.at(-1) ?? [x, y];
    return [from[0] + (x - from[0]) * t, from[1] + (y - from[1]) * t];
  });
}
