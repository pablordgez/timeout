import { random, shuffle } from "../../core/random";
import { vocabularyMix, wordBand } from "../../core/vocabulary";
import type { Locale } from "../../core/types";
import type { Entry, Puzzle, Slot } from "./generator";

/** Grow connected words around real intersections rather than requiring obscure dense fill. */
export function generateFamiliar(
  size: number,
  entries: Entry[],
  seed: number,
  locale: Locale,
  difficulty: string,
): Puzzle | null {
  const mix = vocabularyMix(difficulty);
  const bins = [0, 1, 2].map((band) =>
    shuffle(
      entries.filter((e) => e.w.length <= size && wordBand(e, locale) === band),
      seed ^ ((band + 1) * 0x9e3779b9),
    ).items.slice(0, band === 2 ? 1800 : 1000),
  );
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const grid = Array<string>(size * size).fill(""),
      directions = Array<number>(size * size).fill(0),
      slots: Slot[] = [],
      used = new Set<string>();
    let rng = (seed ^ ((attempt + 1) * 0x9e3779b9)) >>> 0,
      nodes = 0;
    function fits(e: Entry, x: number, y: number, down: boolean) {
      const dx = down ? 0 : 1,
        dy = down ? 1 : 0,
        bit = down ? 2 : 1;
      const at = (a: number, b: number) =>
        a < 0 || a >= size || b < 0 || b >= size ? "" : grid[b * size + a];
      if (
        x < 0 ||
        y < 0 ||
        x + dx * (e.w.length - 1) >= size ||
        y + dy * (e.w.length - 1) >= size ||
        at(x - dx, y - dy) ||
        at(x + dx * e.w.length, y + dy * e.w.length)
      )
        return -1;
      let crossed = 0;
      for (let i = 0; i < e.w.length; i++) {
        const a = x + dx * i,
          b = y + dy * i,
          cell = b * size + a;
        if (grid[cell]) {
          if (grid[cell] !== e.w[i] || directions[cell] & bit) return -1;
          crossed++;
        } else if (at(a - dy, b - dx) || at(a + dy, b + dx)) return -1;
      }
      return crossed;
    }
    function place(e: Entry, x: number, y: number, down: boolean) {
      const cells = Array.from(
        { length: e.w.length },
        (_, i) => (y + (down ? i : 0)) * size + x + (down ? 0 : i),
      );
      cells.forEach((cell, i) => {
        grid[cell] = e.w[i];
        directions[cell] |= down ? 2 : 1;
      });
      slots.push({
        id: slots.length,
        number: 0,
        cells,
        direction: down ? "down" : "across",
        word: e.w,
        clue: e.g,
      });
      used.add(e.w);
    }
    const starters = shuffle(
      bins[0].filter((e) => e.w.length >= Math.min(5, size)),
      rng,
    );
    rng = starters.seed;
    const first = starters.items[0] ?? bins[1][0];
    if (!first) continue;
    place(
      first,
      Math.floor((size - first.w.length) / 2),
      Math.floor(size / 2),
      false,
    );
    for (let round = 0; round < size * 3; round++) {
      const [r, next] = random(rng);
      rng = next;
      const band = r < mix[0] ? 0 : r < mix[0] + mix[1] ? 1 : 2;
      let placement: {
        e: Entry;
        x: number;
        y: number;
        down: boolean;
        score: number;
      } | null = null;
      // No silent difficulty escalation: missing a rare candidate falls back to everyday words.
      const pool = shuffle(
        bins[band].length ? bins[band] : bins[0],
        rng,
      ).items.slice(0, band === 2 ? 350 : 700);
      for (const e of pool) {
        if (used.has(e.w)) continue;
        for (let cell = 0; cell < grid.length; cell++) {
          if (!grid[cell] || directions[cell] === 3) continue;
          const down = directions[cell] === 1;
          for (let i = 0; i < e.w.length; i++) {
            if (e.w[i] !== grid[cell]) continue;
            nodes++;
            const x = (cell % size) - (down ? 0 : i),
              y = Math.floor(cell / size) - (down ? i : 0),
              crossed = fits(e, x, y, down);
            if (crossed <= 0) continue;
            const score = crossed * 10 + e.w.length * 0.3;
            if (!placement || score > placement.score)
              placement = { e, x, y, down, score };
          }
        }
      }
      if (placement)
        place(placement.e, placement.x, placement.y, placement.down);
      if (slots.length >= Math.round(size * 1.5)) break;
    }
    const starts = [...new Set(slots.map((s) => s.cells[0]))].sort(
      (a, b) => a - b,
    );
    slots.forEach((s) => (s.number = starts.indexOf(s.cells[0]) + 1));
    slots.sort(
      (a, b) => a.number - b.number || a.direction.localeCompare(b.direction),
    );
    slots.forEach((s, i) => (s.id = i));
    const puzzle: Puzzle = {
      size,
      mask: grid.map(Boolean),
      solution: grid,
      slots,
      seed: rng,
      nodes,
    };
    if (!best || slots.length > best.slots.length) best = puzzle;
    if (slots.length >= Math.round(size * 1.3)) break;
  }
  return best && best.slots.length >= 6 ? best : null;
}
