import { random, shuffle } from "../../core/random";
export function candidates(board: number[], index: number): number[] {
  if (board[index]) return [];
  const r = Math.floor(index / 9),
    c = index % 9,
    seen = new Set<number>();
  for (let i = 0; i < 9; i++) {
    seen.add(board[r * 9 + i]);
    seen.add(board[i * 9 + c]);
    seen.add(
      board[
        (Math.floor(r / 3) * 3 + Math.floor(i / 3)) * 9 +
          Math.floor(c / 3) * 3 +
          (i % 3)
      ],
    );
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !seen.has(v));
}
export function solutionCount(puzzle: number[], limit = 2): number {
  const b = [...puzzle];
  let count = 0;
  function solve() {
    if (count >= limit) return;
    let pos = -1,
      opts: number[] = [];
    for (let i = 0; i < 81; i++)
      if (!b[i]) {
        const cs = candidates(b, i);
        if (!cs.length) return;
        if (pos < 0 || cs.length < opts.length) {
          pos = i;
          opts = cs;
          if (cs.length === 1) break;
        }
      }
    if (pos < 0) {
      count++;
      return;
    }
    for (const v of opts) {
      b[pos] = v;
      solve();
      if (count >= limit) break;
    }
    b[pos] = 0;
  }
  solve();
  return count;
}
const units = Array.from({ length: 27 }, (_, u) =>
  Array.from({ length: 9 }, (_, i) =>
    u < 9
      ? u * 9 + i
      : u < 18
        ? i * 9 + u - 9
        : (Math.floor((u - 18) / 3) * 3 + Math.floor(i / 3)) * 9 +
          ((u - 18) % 3) * 3 +
          (i % 3),
  ),
);
export function ratePuzzle(puzzle: number[]): {
  level: number;
  technique: string;
  solved: boolean;
} {
  const b = [...puzzle],
    cs = b.map((v, i) => new Set(v ? [] : candidates(b, i)));
  let level = 1,
    last = "single";
  const put = (i: number, v: number) => {
    b[i] = v;
    cs[i].clear();
    for (const unit of units)
      if (unit.includes(i)) for (const j of unit) cs[j].delete(v);
  };
  for (let rounds = 0; rounds < 1000; rounds++) {
    if (b.every(Boolean)) return { level, technique: last, solved: true };
    let progressed = false;
    for (let i = 0; i < 81; i++)
      if (!b[i] && cs[i].size === 1) {
        put(i, [...cs[i]][0]);
        progressed = true;
      }
    if (progressed) continue;
    for (const unit of units)
      for (let v = 1; v <= 9; v++) {
        const places = unit.filter((i) => !b[i] && cs[i].has(v));
        if (places.length === 1) {
          put(places[0], v);
          progressed = true;
        }
      }
    if (progressed) continue;
    for (const unit of units) {
      for (const i of unit)
        if (cs[i].size === 2) {
          const pair = [...cs[i]].sort().join("");
          const twins = unit.filter(
            (j) => cs[j].size === 2 && [...cs[j]].sort().join("") === pair,
          );
          if (twins.length === 2)
            for (const j of unit)
              if (!twins.includes(j))
                for (const v of cs[i])
                  if (cs[j].delete(v)) {
                    progressed = true;
                    level = Math.max(level, 2);
                    last = "naked pair";
                  }
        }
    }
    if (progressed) continue;
    for (let box = 18; box < 27; box++)
      for (let v = 1; v <= 9; v++) {
        const places = units[box].filter((i) => cs[i].has(v));
        if (places.length >= 2) {
          const row = Math.floor(places[0] / 9),
            col = places[0] % 9;
          if (places.every((i) => Math.floor(i / 9) === row))
            for (const i of units[row])
              if (!units[box].includes(i) && cs[i].delete(v)) {
                progressed = true;
                level = Math.max(level, 2);
                last = "pointing";
              }
          if (places.every((i) => i % 9 === col))
            for (const i of units[9 + col])
              if (!units[box].includes(i) && cs[i].delete(v)) {
                progressed = true;
                level = Math.max(level, 2);
                last = "pointing";
              }
        }
      }
    if (progressed) continue;
    for (let v = 1; v <= 9; v++)
      for (let orient = 0; orient < 2; orient++)
        for (let r = 0; r < 8; r++) {
          const u = units[orient * 9 + r],
            pair = u.filter((i) => cs[i].has(v));
          if (pair.length !== 2) continue;
          const coordinates = pair.map((i) =>
            orient ? Math.floor(i / 9) : i % 9,
          );
          for (let r2 = r + 1; r2 < 9; r2++) {
            const pair2 = units[orient * 9 + r2].filter((i) => cs[i].has(v));
            if (
              pair2.length !== 2 ||
              !pair2.every((i) =>
                coordinates.includes(orient ? Math.floor(i / 9) : i % 9),
              )
            )
              continue;
            for (let k = 0; k < 9; k++)
              if (k !== r && k !== r2)
                for (const c of coordinates) {
                  const i = orient ? c * 9 + k : k * 9 + c;
                  if (cs[i].delete(v)) {
                    progressed = true;
                    level = Math.max(level, 3);
                    last = "X-wing";
                  }
                }
          }
        }
    if (!progressed) return { level: 4, technique: "search", solved: false };
  }
  return { level: 4, technique: "search", solved: false };
}
export function generateSudoku(seed: number, requested: number) {
  let fallback: any;
  for (let attempt = 0; attempt < 150; attempt++) {
    const rows = shuffle([0, 1, 2], seed);
    seed = rows.seed;
    const bands = shuffle([0, 1, 2], seed);
    seed = bands.seed;
    const cols = shuffle([0, 1, 2], seed);
    seed = cols.seed;
    const stacks = shuffle([0, 1, 2], seed);
    seed = stacks.seed;
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seed);
    seed = digits.seed;
    const rr = bands.items.flatMap((b) => rows.items.map((r) => b * 3 + r)),
      cc = stacks.items.flatMap((b) => cols.items.map((c) => b * 3 + c));
    const solution = rr.flatMap((r) =>
      cc.map((c) => digits.items[(r * 3 + Math.floor(r / 3) + c) % 9]),
    );
    const puzzle = [...solution];
    const order = shuffle(
      Array.from({ length: 81 }, (_, i) => i),
      seed,
    );
    seed = order.seed;
    for (const i of order.items) {
      const old = puzzle[i];
      puzzle[i] = 0;
      if (solutionCount(puzzle) !== 1) puzzle[i] = old;
      else {
        const rating = ratePuzzle(puzzle);
        if (rating.level > requested) puzzle[i] = old;
      }
    }
    const rating = ratePuzzle(puzzle);
    fallback = { puzzle, solution, rating, rng: seed };
    if (rating.level === requested) return fallback;
  }
  return fallback;
}
export const sudokuSource =
  [random, shuffle, candidates, solutionCount, ratePuzzle, generateSudoku]
    .map((f) => f.toString())
    .join("\n") +
  `\nconst units=${JSON.stringify(units)};self.onmessage=e=>{try{postMessage({result:generateSudoku(e.data.seed,e.data.level)})}catch(err){postMessage({error:String(err)})}}`;
