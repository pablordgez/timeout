import { expect, it } from "vitest";
import { ring } from "../src/games/ring";
import { baseState } from "../src/core/types";

const initial = (): Parameters<typeof ring.reducer>[0] => ({
  ...baseState(42),
  questions: [
    {
      letter: "a",
      w: "árbol",
      g: "Planta con tronco.",
      contains: false,
      result: "pending",
    },
    {
      letter: "b",
      w: "barco",
      g: "Vehículo que navega.",
      contains: false,
      result: "pending",
    },
  ],
  index: 0,
  remaining: 180,
  duration: 180,
  language: "es",
  answers: [],
});

it("preserves the missed answer for review without reopening a completed letter", () => {
  const missed = ring.reducer(initial(), { type: "ANSWER", word: "avión" }, {});
  expect(missed.lastMiss).toBe(0);
  expect(missed.questions[0]).toMatchObject({ result: "wrong", w: "árbol" });
  expect(missed.index).toBe(1);
  const restored = JSON.parse(JSON.stringify(missed));
  expect(ring.reducer(restored, { type: "SELECT", index: 0 }, {})).toEqual(
    restored,
  );
  expect(ring.reducer(restored, { type: "PASS" }, {}).lastMiss).toBe(0);
});
it("clears the previous miss on a correct answer and keeps all solutions after finishing", () => {
  const missed = ring.reducer(initial(), { type: "ANSWER", word: "avión" }, {});
  const finished = ring.reducer(missed, { type: "ANSWER", word: "barco" }, {});
  expect(finished.lastMiss).toBeUndefined();
  expect(finished.status).toBe("lost");
  expect(finished.score).toBe(100);
  expect(finished.questions.map((q) => q.w)).toEqual(["árbol", "barco"]);
});
it("records revealed answers as misses for the same review path", () => {
  const revealed = ring.reducer(initial(), { type: "REVEAL" }, {});
  expect(revealed.lastMiss).toBe(0);
  expect(revealed.questions[0].result).toBe("wrong");
  expect(revealed.message).toBe("árbol");
});
