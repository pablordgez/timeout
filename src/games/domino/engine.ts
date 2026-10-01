import {
  baseState,
  type Action,
  type Config,
  type GameState,
} from "../../core/types";
import { random, shuffle } from "../../core/random";
export type Tile = [number, number];
export type End = "left" | "right" | "up" | "down";
export interface Placement {
  id: number;
  left: number;
  right: number;
}
export const tiles: Tile[] = Array.from({ length: 7 }, (_, a) =>
  Array.from({ length: 7 - a }, (_, b) => [a, a + b] as Tile),
).flat();
export const pipSum = (hand: number[]) =>
  hand.reduce((n, id) => n + tiles[id][0] + tiles[id][1], 0);
export interface DominoState extends GameState {
  hands: number[][];
  stock: number[];
  chain: Placement[];
  turn: number;
  passes: number;
  phase: "play" | "roundover";
  points: number[];
  round: number;
  winners: number[];
  opening: number;
  event: { es: string; en: string };
  fives?: {
    spinner: number | null;
    up: Placement[];
    down: Placement[];
    lastScore: number;
    nextStarter: number | null;
  };
}
export function spinnerReady(s: DominoState) {
  if (s.fives?.spinner == null) return false;
  const index = s.chain.findIndex((t) => t.id === s.fives!.spinner);
  return index > 0 && index < s.chain.length - 1;
}
export function endpoint(s: DominoState, end: End): number {
  if (end === "left") return s.chain[0].left;
  if (end === "right") return s.chain.at(-1)!.right;
  return s.fives![end].at(-1)?.right ?? tiles[s.fives!.spinner!][0];
}
export function legalEnds(s: DominoState, id: number): End[] {
  if (!tiles[id]) return [];
  if (!s.chain.length) return s.fives || id === s.opening ? ["right"] : [];
  const ends: End[] = spinnerReady(s)
    ? ["left", "right", "up", "down"]
    : ["left", "right"];
  return ends.filter((end) => tiles[id].includes(endpoint(s, end)));
}
export const legalTiles = (s: DominoState, player = s.turn) =>
  s.hands[player].filter((id) => legalEnds(s, id).length > 0);
/** Empty spinner branches are playable, but do not contribute to the total. */
export function scoringEnds(s: DominoState): number[] {
  if (!s.chain.length) return [];
  if (s.chain.length === 1) return [s.chain[0].left, s.chain[0].right];
  const first = s.chain[0],
    last = s.chain.at(-1)!;
  const values = [
    first.left === first.right ? first.left * 2 : first.left,
    last.left === last.right ? last.right * 2 : last.right,
  ];
  for (const arm of [s.fives?.up, s.fives?.down]) {
    const tip = arm?.at(-1);
    if (tip) values.push(tip.left === tip.right ? tip.right * 2 : tip.right);
  }
  return values;
}
export const endTotal = (s: DominoState) =>
  scoringEnds(s).reduce((sum, value) => sum + value, 0);
export const fivesPoints = (s: DominoState) => {
  const total = endTotal(s);
  return total > 0 && total % 5 === 0 ? total : 0;
};
function place(s: DominoState, id: number, end: End) {
  const [x, y] = tiles[id],
    edge = s.chain.length ? endpoint(s, end) : undefined;
  const tile: Placement =
    edge === undefined
      ? { id, left: x, right: y }
      : end === "left"
        ? { id, left: x === edge ? y : x, right: edge }
        : { id, left: edge, right: x === edge ? y : x };
  if (end === "left") s.chain.unshift(tile);
  else if (end === "right") s.chain.push(tile);
  else s.fives![end].push(tile);
  if (s.fives && s.fives.spinner === null && x === y) s.fives.spinner = id;
}
export function previewPoints(s: DominoState, id: number, end: End) {
  if (!s.fives || !legalEnds(s, id).includes(end)) return 0;
  const next = {
    ...s,
    chain: [...s.chain],
    fives: { ...s.fives, up: [...s.fives.up], down: [...s.fives.down] },
  };
  place(next, id, end);
  return fivesPoints(next);
}
function deal(s: DominoState, c: Config) {
  const starter = s.fives?.nextStarter,
    d = shuffle(
      tiles.map((_, i) => i),
      s.rng,
    );
  s.rng = d.seed;
  const size = c.mode === "fives" && s.hands.length > 2 ? 5 : 7;
  s.hands = s.hands.map(() => d.items.splice(0, size));
  s.stock = d.items;
  s.chain = [];
  s.passes = 0;
  s.phase = "play";
  s.winners = [];
  s.round++;
  if (c.mode === "fives") {
    s.fives = {
      spinner: null,
      up: [],
      down: [],
      lastScore: 0,
      nextStarter: null,
    };
    const [r, seed] = random(s.rng);
    s.rng = seed;
    s.turn = starter ?? Math.floor(r * s.hands.length);
    s.opening = -1;
    s.event = {
      es: `Ronda ${s.round}. J${s.turn + 1} abre con cualquier ficha.`,
      en: `Round ${s.round}. P${s.turn + 1} leads any tile.`,
    };
    return;
  }
  const all = s.hands.flat(),
    doubles = all.filter((id) => tiles[id][0] === tiles[id][1]);
  s.opening = doubles.length
    ? doubles.sort((a, b) => tiles[b][0] - tiles[a][0])[0]
    : all.sort((a, b) => pipSum([b]) - pipSum([a]) || b - a)[0];
  s.turn = s.hands.findIndex((h) => h.includes(s.opening));
  s.event = {
    es: `Ronda ${s.round}. Abre la ficha ${tiles[s.opening].join("–")}.`,
    en: `Round ${s.round}. Open with ${tiles[s.opening].join("–")}.`,
  };
}
export function createDomino(c: Config, seed: number): DominoState {
  const n =
    c.mode === "pairs" ? 4 : Math.max(2, Math.min(4, Number(c.players) || 2));
  const s: DominoState = {
    ...baseState(seed),
    hands: Array.from({ length: n }, () => []),
    stock: [],
    chain: [],
    turn: 0,
    passes: 0,
    phase: "play",
    points: Array(n).fill(0),
    round: 0,
    winners: [],
    opening: -1,
    event: { es: "", en: "" },
  };
  deal(s, c);
  return s;
}
export function roundWinners(
  s: DominoState,
  c: Config,
  finisher = -1,
): number[] {
  if (c.mode === "pairs") {
    if (finisher >= 0) return [finisher % 2, (finisher % 2) + 2];
    const a = pipSum(s.hands[0]) + pipSum(s.hands[2]),
      b = pipSum(s.hands[1]) + pipSum(s.hands[3]);
    return a === b ? [] : a < b ? [0, 2] : [1, 3];
  }
  if (finisher >= 0) return [finisher];
  const sums = s.hands.map(pipSum),
    min = Math.min(...sums),
    winners = sums.flatMap((sum, i) => (sum === min ? [i] : []));
  return winners.length === 1 ? winners : [];
}
function endRound(s: DominoState, c: Config, finisher = -1) {
  s.phase = "roundover";
  s.winners = roundWinners(s, c, finisher);
  const raw = s.hands.reduce(
      (sum, h, i) => sum + (s.winners.includes(i) ? 0 : pipSum(h)),
      0,
    ),
    points = s.fives ? Math.round(raw / 5) * 5 : raw;
  s.winners.forEach((i) => (s.points[i] += points));
  s.score = s.points[0];
  if (s.fives) s.fives.nextStarter = finisher >= 0 ? finisher : null;
  s.event = s.winners.length
    ? {
        es: `${finisher < 0 ? "Cierre" : "Dominó"}: ${s.winners.map((i) => `J${i + 1}`).join(" + ")} gana ${points} puntos.`,
        en: `${finisher < 0 ? "Blocked" : "Domino"}: ${s.winners.map((i) => `P${i + 1}`).join(" + ")} wins ${points} points.`,
      }
    : {
        es: "Cierre empatado. Nadie puntúa.",
        en: "Blocked tie. No points awarded.",
      };
  if (s.points.some((p) => p >= Number(c.target || 100)))
    s.status = s.winners.includes(0) ? "won" : "lost";
}
export function dominoReducer(
  state: DominoState,
  a: Action,
  c: Config,
): DominoState {
  if (state.status !== "playing") return state;
  if (a.type === "NEXT_ROUND" && state.phase === "roundover") {
    const s = structuredClone(state);
    deal(s, c);
    return s;
  }
  if (state.phase !== "play") return state;
  if (a.type === "PLAY") {
    const id = Number(a.id),
      end = a.end as End;
    if (
      !state.hands[state.turn].includes(id) ||
      !legalEnds(state, id).includes(end)
    )
      return state;
    const s = structuredClone(state),
      [x, y] = tiles[id],
      player = s.turn;
    place(s, id, end);
    s.hands[player] = s.hands[player].filter((i) => i !== id);
    s.passes = 0;
    s.moves++;
    s.event = {
      es: `J${player + 1} coloca ${x}–${y}.`,
      en: `P${player + 1} plays ${x}–${y}.`,
    };
    if (s.fives) {
      const points = fivesPoints(s);
      s.fives.lastScore = points;
      s.points[player] += points;
      s.score = s.points[0];
      if (points) {
        s.event.es += ` +${points} puntos (${scoringEnds(s).join(" + ")} = ${points}).`;
        s.event.en += ` +${points} points (${scoringEnds(s).join(" + ")} = ${points}).`;
      }
      if (s.points[player] >= Number(c.target || 100)) {
        s.phase = "roundover";
        s.winners = [player];
        s.status = player === 0 ? "won" : "lost";
        s.event.es += ` J${player + 1} gana la partida.`;
        s.event.en += ` P${player + 1} wins the match.`;
        return s;
      }
    }
    if (!s.hands[player].length) endRound(s, c, player);
    else s.turn = (player + 1) % s.hands.length;
    return s;
  }
  if (a.type === "DRAW") {
    if (c.mode === "pairs" || !state.stock.length || legalTiles(state).length)
      return state;
    const s = structuredClone(state);
    s.hands[s.turn].push(s.stock.shift()!);
    s.moves++;
    s.event = {
      es: "Ficha robada. Colócala si encaja; si no, sigue robando.",
      en: "Tile drawn. Play it if it fits; otherwise keep drawing.",
    };
    return s;
  }
  if (a.type === "PASS") {
    if (legalTiles(state).length || (state.stock.length && c.mode !== "pairs"))
      return state;
    const s = structuredClone(state);
    s.moves++;
    s.passes++;
    s.event = { es: `J${s.turn + 1} pasa.`, en: `P${s.turn + 1} passes.` };
    if (s.passes === s.hands.length) endRound(s, c);
    else s.turn = (s.turn + 1) % s.hands.length;
    return s;
  }
  return state;
}
export function dominoBot(s: DominoState, c: Config): Action | null {
  if (s.phase !== "play") return null;
  const legal = legalTiles(s);
  if (!legal.length)
    return { type: s.stock.length && c.mode !== "pairs" ? "DRAW" : "PASS" };
  const frequency = Array(7).fill(0);
  s.hands[s.turn].forEach((id) => tiles[id].forEach((p) => frequency[p]++));
  const choices = legal.flatMap((id) =>
    legalEnds(s, id).map((end) => {
      const [a, b] = tiles[id],
        edge = s.chain.length ? endpoint(s, end) : a,
        exposed = a === edge ? b : a,
        score = previewPoints(s, id, end);
      return {
        id,
        end,
        value:
          pipSum([id]) +
          (s.fives ? score * 8 : 0) +
          (c.difficulty === "hard"
            ? frequency[exposed] * 3 + (a === b ? 2 : 0)
            : 0),
      };
    }),
  );
  if (c.difficulty !== "easy") choices.sort((a, b) => b.value - a.value);
  return { type: "PLAY", id: choices[0].id, end: choices[0].end };
}
