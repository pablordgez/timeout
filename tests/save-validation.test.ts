import { expect, it } from "vitest";
import { validateGameSession } from "../src/core/save-validation";
import type { GameDefinition } from "../src/core/types";
import type { Session } from "../src/core/storage";
import { createPool } from "../src/games/billiards/engine";
import { createDomino } from "../src/games/domino/engine";
import { createPoker, pokerReducer } from "../src/games/poker/engine";
import { createSolitaire } from "../src/games/solitaire/engine";
const definition = (id: string) =>
  ({ id, version: 1, options: [] }) as unknown as GameDefinition;
const record = (id: string, state: any, config: any = {}): Session => ({
  id: "test",
  gameId: id,
  gameVersion: 1,
  state,
  config,
  locale: "es",
  startedAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
  elapsed: 0,
});
it("accepts legitimate partner domino saves with the fixed four seats", () => {
  const config = { mode: "pairs", players: 2, humans: 4, target: 50 };
  const s = record("domino", createDomino(config, 42), config);
  expect(() => validateGameSession(s, definition("domino"))).not.toThrow();
});
it("accepts poker showdown waiting between hands", () => {
  const config = { players: 2, stack: 1000, blind: 10 };
  let state = createPoker(config, 42);
  state = pokerReducer(state, { type: "FOLD" });
  expect(state.street).toBe("showdown");
  expect(() =>
    validateGameSession(record("poker", state, config), definition("poker")),
  ).not.toThrow();
});
it("rejects missing simulation fields and duplicate balls before the view opens", () => {
  const config = { mode: "eight" };
  const state = createPool(config, 42);
  expect(() =>
    validateGameSession(
      record("billiards", state, config),
      definition("billiards"),
    ),
  ).not.toThrow();
  const corrupt = structuredClone(state);
  corrupt.balls[0].id = corrupt.balls[1].id;
  expect(() =>
    validateGameSession(
      record("billiards", corrupt, config),
      definition("billiards"),
    ),
  ).toThrow();
  delete (state as any).balls;
  expect(() =>
    validateGameSession(
      record("billiards", state, config),
      definition("billiards"),
    ),
  ).toThrow();
});
it("checks solitaire card conservation while accepting all four variants", () => {
  for (const variant of ["klondike", "spider", "freecell", "pyramid"]) {
    const config = { variant, suits: 1, draw: 1 };
    const state = createSolitaire(config, 42);
    expect(() =>
      validateGameSession(
        record("solitaire", state, config),
        definition("solitaire"),
      ),
    ).not.toThrow();
    if (state.stock.length) state.stock.pop();
    else state.tableau[0].pop();
    expect(() =>
      validateGameSession(
        record("solitaire", state, config),
        definition("solitaire"),
      ),
    ).toThrow();
  }
});

