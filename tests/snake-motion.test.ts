import { expect, it } from "vitest";
import { arcadeReducer, createArcade } from "../src/games/arcade/engines";
import { snakePositions } from "../src/games/arcade/snake-motion";

it("keeps the tail on its own path when the head turns", () => {
  let s = createArcade("snake", { speed: "slow" }, 1);
  s.food = [0, 0];
  // The head has turned upward while the tail still travels to the right.
  Object.assign(s, {
    snake: [
      [8, 9],
      [8, 10],
      [7, 10],
    ],
    direction: [0, -1],
    queued: [0, -1],
    clock: 0,
  });
  const before = structuredClone(s.snake);
  s.clock = s.period - 1 / 120;
  s = arcadeReducer(s, { type: "TICK", dt: 1 / 120 }, {});
  s.clock = s.period / 2;
  expect(s.snakeFrom).toEqual(before);
  expect(snakePositions(s)).toEqual([
    [8, 8.5],
    [8, 9.5],
    [7.5, 10],
  ]);
  expect(snakePositions(s, true)).toEqual(s.snake);
});

it("keeps the new tail still when growing, and opens older saves without guessing positions", () => {
  let s = createArcade("snake", { speed: "slow" }, 1);
  expect(snakePositions(s)).toEqual(s.snake);
  s.food = [9, 10];
  s.clock = s.period - 1 / 120;
  s = arcadeReducer(s, { type: "TICK", dt: 1 / 120 }, {});
  s.clock = s.period / 2;
  expect(s.snake.length).toBe(4);
  expect(snakePositions(s).at(-1)).toEqual([6, 10]);
  const restored = JSON.parse(JSON.stringify(s));
  expect(snakePositions(restored)).toEqual(snakePositions(s));
});
