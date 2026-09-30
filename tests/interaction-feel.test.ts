import { afterEach, describe, expect, it, vi } from "vitest";
import { soundEventForTransition, soundRecipe } from "../src/core/sound-design";
import { baseState } from "../src/core/types";
import { directedShot } from "../src/games/billiards/preview";
import { createPool, poolReducer } from "../src/games/billiards/engine";

const state = (extra: Record<string, any> = {}) => ({
  ...baseState(11),
  ...extra,
});
describe("material and action feedback", () => {
  it("keeps clocks, aim previews, key releases and autorepeat silent", () => {
    const s = state();
    for (const type of [
      "CLOCK",
      "TICK",
      "RELEASE",
      "POINTER_MOVE",
      "POINTER_UP",
    ])
      expect(soundEventForTransition("runner", s, s, { type })).toBeNull();
    expect(
      soundEventForTransition("blocks", s, s, { type: "LEFT", repeat: true }),
    ).toBeNull();
    expect(
      soundEventForTransition("blocks", s, s, { type: "LEFT", down: false }),
    ).toBeNull();
  });
  it("distinguishes draw, stack placement, foundation and stock recycling", () => {
    const before = state({ stock: [{}], waste: [], moves: 0 }),
      after = state({ stock: [], waste: [{}], moves: 1 });
    const draw = soundEventForTransition("solitaire", before, after, {
      type: "draw",
    })!.event;
    const slide = soundEventForTransition("solitaire", before, after, {
      type: "move",
      to: { zone: "tableau" },
    })!.event;
    const home = soundEventForTransition("solitaire", before, after, {
      type: "move",
      to: { zone: "foundation" },
    })!.event;
    const recycle = soundEventForTransition(
      "solitaire",
      after,
      state({ stock: [{}], waste: [], moves: 2 }),
      { type: "draw" },
    )!.event;
    expect(new Set([draw, slide, home, recycle]).size).toBe(4);
    const recipes = [draw, slide, home, recycle].map((event) =>
      soundRecipe("solitaire", event),
    );
    expect(new Set(recipes.map((recipe) => JSON.stringify(recipe))).size).toBe(
      4,
    );
    recipes.forEach((recipe) =>
      expect(recipe.some((part) => part.noise)).toBe(true),
    );
    expect(soundRecipe("domino", "tile-place")).not.toEqual(recipes[1]);
  });
  it("layers automatic face-up flips and community-card deals with the initiating action", () => {
    const before = state({
      moves: 0,
      tableau: [
        [
          { id: 2, up: false },
          { id: 1, up: true },
        ],
      ],
    });
    const after = state({
      moves: 1,
      tableau: [[{ id: 2, up: true }], [{ id: 1, up: true }]],
    });
    const event = soundEventForTransition("solitaire", before, after, {
      type: "move",
      to: { zone: "tableau" },
    })!.event;
    expect(event).toBe("card-slide+card-flip");
    expect(
      soundRecipe("solitaire", event).some((part) => (part.delay || 0) >= 0.14),
    ).toBe(true);
    const poker = state({
      turn: 0,
      highest: 20,
      players: [{ bet: 10 }],
      board: [],
      moves: 1,
    });
    expect(
      soundEventForTransition(
        "poker",
        poker,
        state({ ...poker, board: [1, 2, 3], moves: 2 }),
        { type: "CALL" },
      )?.event,
    ).toBe("chips-call+card-deal");
    expect(
      soundEventForTransition(
        "poker",
        state({ ...poker, highest: 10 }),
        state({ ...poker, moves: 2 }),
        { type: "CALL" },
      )?.event,
    ).toBe("chips-check");
  });
  it("has different voices for every game and different action recipes within each", () => {
    const games = [
      "solitaire",
      "poker",
      "domino",
      "chess",
      "letters",
      "trivia",
      "crossword",
      "sudoku",
      "wordle",
      "ring",
      "runner",
      "flappy",
      "snake",
      "breakout",
      "blocks",
      "billiards",
    ];
    expect(
      new Set(games.map((game) => JSON.stringify(soundRecipe(game, "select"))))
        .size,
    ).toBe(16);
    for (const game of games) {
      expect(soundRecipe(game, "select")).not.toEqual(
        soundRecipe(game, "reject"),
      );
      for (const event of [
        "write",
        "erase",
        "hint",
        "reject",
        "success",
        "failure",
      ]) {
        const recipe = soundRecipe(game, event);
        expect(recipe.length).toBeGreaterThan(0);
        recipe.forEach((part) => {
          expect(part.duration).toBeGreaterThan(0);
          expect(part.duration).toBeLessThan(0.5);
          expect(part.gain).toBeGreaterThan(0);
          expect(part.gain).toBeLessThan(1);
        });
      }
    }
  });
  it("acknowledges selections, notes, erase, passes and rejected repeat attempts", () => {
    const s = state();
    expect(
      soundEventForTransition("crossword", s, s, { type: "CELL" })?.event,
    ).toBe("select");
    expect(
      soundEventForTransition("sudoku", state({ noteMode: true }), state(), {
        type: "NUMBER",
        value: 3,
      })?.event,
    ).toBe("note");
    expect(
      soundEventForTransition("sudoku", s, state(), {
        type: "NUMBER",
        value: 0,
      })?.event,
    ).toBe("erase");
    expect(
      soundEventForTransition("ring", s, state(), { type: "PASS" })?.event,
    ).toBe("pass");
    expect(
      soundEventForTransition(
        "solitaire",
        state({ moves: 0 }),
        state({ moves: 0, message: "invalid-move" }),
        { type: "move" },
      )?.event,
    ).toBe("reject");
    expect(
      soundEventForTransition(
        "letters",
        s,
        state({ message: "recall-first" }),
        { type: "PASS" },
      )?.event,
    ).toBe("reject");
  });
});

describe("precise pool charging", () => {
  it("ignores sideways jitter without changing chosen direction or forward charge", () => {
    const start = { x: 170, y: 200 };
    expect(directedShot(start, { x: 70, y: 205 }, 0)).toEqual(
      directedShot(start, { x: 70, y: 172 }, 0),
    );
    expect(directedShot(start, { x: 70, y: 205 }, 0)).toEqual({
      angle: 0,
      power: 600,
      distance: 100,
    });
    const vertical = directedShot(start, { x: 185, y: 100 }, Math.PI / 2);
    expect(vertical.distance).toBeCloseTo(100);
    expect(vertical.power).toBeCloseTo(600);
    expect(directedShot(start, { x: 180, y: 210 }, 0).distance).toBe(0);
    expect(directedShot(start, { x: -500, y: 200 }, 0).power).toBe(1100);
  });
  it("rejects illegal placement and attempts to shoot with the cue still in hand", () => {
    const cfg = { mode: "practice", humans: 1 },
      s = createPool(cfg, 11);
    const bad = poolReducer(s, { type: "PLACE", x: 700, y: 5 }, cfg);
    expect(bad.inHand).toBe(true);
    expect(
      soundEventForTransition("billiards", s, bad, { type: "PLACE" })?.event,
    ).toBe("reject");
    const shot = poolReducer(s, { type: "SHOOT" }, cfg);
    expect(shot).toBe(s);
    expect(
      soundEventForTransition("billiards", s, shot, { type: "SHOOT" })?.event,
    ).toBe("reject");
  });
});

describe("Foley synthesis availability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("uses filtered noise for cards, bounded envelopes and slight variations; mute stops synthesis", async () => {
    vi.resetModules();
    const sources: number[] = [],
      frequencies: number[] = [],
      filters: string[] = [];
    const parameter = () => ({
      value: 0,
      setTargetAtTime: vi.fn(),
      setValueAtTime: (value: number) => frequencies.push(value),
      exponentialRampToValueAtTime: vi.fn(),
    });
    class Audio {
      state = "running";
      currentTime = 1;
      sampleRate = 44100;
      destination = {};
      createGain() {
        return { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
      }
      createBuffer(_channels: number, size: number) {
        return { getChannelData: () => new Float32Array(size) };
      }
      createBufferSource() {
        return {
          buffer: null,
          playbackRate: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: () => sources.push(1),
          stop: vi.fn(),
          onended: null,
        };
      }
      createBiquadFilter() {
        const filter = {
          type: "",
          frequency: { value: 0 },
          Q: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        filters.push("filter");
        return filter;
      }
      createOscillator() {
        return {
          frequency: parameter(),
          type: "",
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: () => sources.push(2),
          stop: vi.fn(),
          onended: null,
        };
      }
      resume() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("window", { AudioContext: Audio });
    const audio = await import("../src/core/audio");
    audio.setSoundEnabled(true);
    await audio.unlockAudio();
    audio.playGameSound("solitaire", "card-draw");
    expect(filters.length).toBe(2);
    expect(sources).toContain(1);
    const count = sources.length;
    audio.playGameSound("solitaire", "card-draw");
    expect(sources.length).toBe(count);
    audio.playGameSound("solitaire", "card-slide");
    expect(sources.length).toBeGreaterThan(count);
    const first = frequencies.filter((n) => n > 1);
    expect(new Set(first).size).toBeGreaterThan(1);
    audio.setSoundEnabled(false);
    const muted = sources.length;
    audio.playGameSound("poker", "chips-all-in");
    expect(sources.length).toBe(muted);
  });
});
