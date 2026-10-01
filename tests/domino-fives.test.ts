import { describe, expect, it } from "vitest";
import {
  createDomino,
  dominoBot,
  dominoReducer,
  endTotal,
  legalEnds,
  legalTiles,
  previewPoints,
  scoringEnds,
  spinnerReady,
  tiles,
  type DominoState,
} from "../src/games/domino/engine";
import { validateGameSession } from "../src/core/save-validation";
import type { GameDefinition } from "../src/core/types";
const config = {
  mode: "fives",
  players: 2,
  humans: 2,
  difficulty: "hard",
  target: 200,
};
const tile = (a: number, b: number) =>
  tiles.findIndex((t) => t[0] === Math.min(a, b) && t[1] === Math.max(a, b));
function scenario(hands: number[][], state: Partial<DominoState> = {}): DominoState {
  const s = Object.assign(
    createDomino(config, 42),
    { turn: 0, hands, stock: [], chain: [] },
    state,
  );
  return s;
}
function validate(state: DominoState, c = config) {
  const now = new Date().toISOString();
  validateGameSession(
    {
      id: "test",
      gameId: "domino",
      gameVersion: 2,
      config: c,
      locale: "es",
      state,
      startedAt: now,
      updatedAt: now,
      elapsed: 0,
    },
    { id: "domino", version: 2, options: [] } as unknown as GameDefinition,
  );
}
describe("All Fives", () => {
  it("deals seven to two players, five to three/four, and permits any opening tile", () => {
    for (const players of [2, 3, 4]) {
      const s = createDomino({ ...config, players }, 42);
      expect(s.hands.map((h) => h.length)).toEqual(
        Array(players).fill(players === 2 ? 7 : 5),
      );
      expect(legalTiles(s)).toEqual(s.hands[s.turn]);
      expect(s.stock.length + s.hands.flat().length).toBe(28);
      expect(dominoReducer(s, { type: "PASS" }, config)).toBe(s);
      expect(dominoReducer(s, { type: "DRAW" }, config)).toBe(s);
    }
  });
  it("scores an opening five-five and a non-double with a total of five", () => {
    for (const [a, b, points] of [
      [5, 5, 10],
      [2, 3, 5],
      [3, 4, 0],
      [0, 0, 0],
    ]) {
      const id = tile(a, b),
        s = scenario([[id, tile(1, 6)], [tile(1, 2)]]);
      const next = dominoReducer(s, { type: "PLAY", id, end: "right" }, config);
      expect(next.points[0]).toBe(points);
      expect(next.fives?.lastScore).toBe(points);
      expect(previewPoints(s, id, "right")).toBe(points);
      expect(s.chain).toEqual([]);
    }
  });
  it("opens cross arms only after both sides of the first double are covered, and scores only started arms", () => {
    let s = scenario([
      [tile(5, 5), tile(1, 5), tile(2, 5), tile(3, 5), tile(0, 5), tile(1, 1)],
      [tile(6, 6)],
    ]);
    const play = (a: number, b: number, end: string) => {
      s.turn = 0;
      s = dominoReducer(s, { type: "PLAY", id: tile(a, b), end }, config);
    };
    play(5, 5, "right");
    expect(spinnerReady(s)).toBe(false);
    expect(endTotal(s)).toBe(10);
    expect(legalEnds(s, tile(1, 5))).toEqual(["left", "right"]);
    expect(
      dominoReducer(s, { type: "PLAY", id: tile(1, 5), end: "up" }, config),
    ).toBe(s);
    play(1, 5, "left");
    expect(scoringEnds(s)).toEqual([1, 10]);
    expect(spinnerReady(s)).toBe(false);
    play(2, 5, "right");
    expect(spinnerReady(s)).toBe(true);
    expect(scoringEnds(s)).toEqual([1, 2]);
    expect(legalEnds(s, tile(3, 5))).toEqual(["up", "down"]);
    play(3, 5, "up");
    expect(scoringEnds(s)).toEqual([1, 2, 3]);
    play(0, 5, "down");
    expect(scoringEnds(s)).toEqual([1, 2, 3, 0]);
    expect(s.fives?.spinner).toBe(tile(5, 5));
  });
  it("handles a spinner played after a non-double and doubles at branch tips", () => {
    let s = scenario([
      [tile(2, 3), tile(3, 3), tile(1, 3), tile(3, 4), tile(4, 4), tile(0, 1)],
      [tile(6, 6)],
    ]);
    for (const [a, b, end] of [
      [2, 3, "right"],
      [3, 3, "right"],
      [1, 3, "right"],
      [3, 4, "up"],
      [4, 4, "up"],
    ] as const) {
      s.turn = 0;
      s = dominoReducer(s, { type: "PLAY", id: tile(a, b), end }, config);
    }
    expect(s.fives?.spinner).toBe(tile(3, 3));
    expect(s.fives?.up.length).toBe(2);
    expect(scoringEnds(s)).toEqual([2, 1, 8]);
    expect(s.fives?.down).toEqual([]);
    expect(legalEnds(s, tile(4, 6))).toEqual(["up"]);
  });
  it("ends the match immediately on reaching the target without awarding remaining-hand points", () => {
    const s = scenario([[tile(5, 5), tile(6, 6)], [tile(1, 6)]]);
    s.points = [40, 0];
    const next = dominoReducer(
      s,
      { type: "PLAY", id: tile(5, 5), end: "right" },
      { ...config, target: 50 },
    );
    expect(next.status).toBe("won");
    expect(next.phase).toBe("roundover");
    expect(next.points).toEqual([50, 0]);
    expect(next.hands[0]).toEqual([tile(6, 6)]);
    expect(dominoReducer(next, { type: "NEXT_ROUND" }, config)).toBe(next);
  });
  it("rounds remaining pips to the nearest five and lets the finisher lead the next round", () => {
    const s = scenario([[tile(2, 3)], [tile(2, 6)]]);
    const next = dominoReducer(
      s,
      { type: "PLAY", id: tile(2, 3), end: "right" },
      config,
    );
    expect(next.points[0]).toBe(15); // Five on the ends, ten for the opponent's eight pips.
    expect(next.phase).toBe("roundover");
    const round = dominoReducer(next, { type: "NEXT_ROUND" }, config);
    expect(round.turn).toBe(0);
    expect(round.points[0]).toBe(15);
    expect(round.round).toBe(2);
    expect(round.fives).toEqual({
      spinner: null,
      up: [],
      down: [],
      lastScore: 0,
      nextStarter: null,
    });
  });
  it("awards a blocked round to the lowest remaining hand and gives no points for a tie", () => {
    for (const tie of [false, true]) {
      let s = scenario([[tile(1, 1)], [tile(2, 2)]], {
        chain: [{ id: tile(0, 0), left: 0, right: 0 }],
      });
      s.fives!.spinner = tile(0, 0);
      if (tie) s.hands[1] = [tile(1, 1)];
      s = dominoReducer(s, { type: "PASS" }, config);
      s = dominoReducer(s, { type: "PASS" }, config);
      expect(s.phase).toBe("roundover");
      expect(s.winners).toEqual(tie ? [] : [0]);
      expect(s.points[0]).toBe(tie ? 0 : 5);
    }
  });
  it("bots prefer scoring moves without consulting opponents’ hidden identities", () => {
    const s = scenario([[tile(5, 5), tile(6, 6), tile(0, 2)], [tile(1, 6)]]);
    expect(dominoBot(s, config)).toEqual({
      type: "PLAY",
      id: tile(5, 5),
      end: "right",
    });
    const masked = structuredClone(s);
    masked.hands[1] = [0];
    masked.stock.reverse();
    expect(dominoBot(masked, config)).toEqual(dominoBot(s, config));
  });
  it("finishes seeded matches, conserves all 28 tiles including branches, validates saves, and resumes exactly", () => {
    let branches = 0;
    for (const players of [2, 3, 4])
      for (const difficulty of ["easy", "medium", "hard"])
        for (const seed of [3, 23, 97]) {
          const c = { ...config, players, difficulty, target: 50 };
          let s = createDomino(c, seed);
          for (let n = 0; n < 2000 && s.status === "playing"; n++) {
            validate(s, c);
            const action =
              s.phase === "roundover"
                ? { type: "NEXT_ROUND" }
                : dominoBot(s, c)!;
            const next = dominoReducer(s, action, c);
            expect(next).not.toBe(s);
            expect(
              next.points.every((p, i) => p >= s.points[i] && p % 5 === 0),
            ).toBe(true);
            expect(
              dominoReducer(JSON.parse(JSON.stringify(s)), action, c),
            ).toEqual(next);
            s = next;
            branches += s.fives!.up.length + s.fives!.down.length;
          }
          validate(s, c);
          expect(s.status).not.toBe("playing");
          expect(Math.max(...s.points)).toBeGreaterThanOrEqual(50);
        }
    expect(branches).toBeGreaterThan(0);
  });
  it("rejects malformed branches, duplicated tiles and an invalid spinner when importing", () => {
    const s = createDomino(config, 42);
    validate(s);
    for (const change of [
      { spinner: 99 },
      { up: [{ id: 0, left: 0, right: 0 }] },
      { lastScore: 3 },
      { down: null },
      { nextStarter: 3 },
    ]) {
      const corrupt = structuredClone(s);
      Object.assign(corrupt.fives!, change);
      expect(() => validate(corrupt)).toThrow("Invalid game data: domino");
    }
  });
});
