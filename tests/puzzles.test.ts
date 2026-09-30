import { it, expect } from "vitest";
import { evaluateGuess } from "../src/games/wordle";
import { normalize } from "../src/core/lexicon";
import {
  solutionCount,
  generateSudoku,
  ratePuzzle,
} from "../src/games/sudoku/engine";
it("counts repeated word letters only as often as present", () => {
  expect(evaluateGuess("allee", "apple")).toEqual([2, 1, 0, 0, 2]);
  expect(evaluateGuess("aaaaa", "canto")).toEqual([0, 2, 0, 0, 0]);
});
it("normalizes accents without turning ñ into n", () => {
  expect(normalize("ÁRBOL")).toBe("arbol");
  expect(normalize("NIÑO")).toBe("niño");
});
it("generates reproducible unique easy sudokus with verified grade", () => {
  const a = generateSudoku(19, 1),
    b = generateSudoku(19, 1);
  expect(a.puzzle).toEqual(b.puzzle);
  expect(solutionCount(a.puzzle)).toBe(1);
  expect(ratePuzzle(a.puzzle).level).toBe(1);
  expect(a.solution).toHaveLength(81);
});
it.each([2, 3, 4])(
  "classifies difficulty %i by required techniques and keeps a unique solution",
  (level) => {
    const s = generateSudoku(73, level);
    expect(solutionCount(s.puzzle)).toBe(1);
    expect(ratePuzzle(s.puzzle).level).toBe(level);
  },
  30000,
);
