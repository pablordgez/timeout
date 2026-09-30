import type { GameDefinition } from "./types";
import { solitaire } from "../games/solitaire";
import { sudoku } from "../games/sudoku";
import { wordle } from "../games/wordle";
import { arcadeGames } from "../games/arcade";
import { chess } from "../games/chess";
import { poker } from "../games/poker";
import { domino } from "../games/domino";
import { billiards } from "../games/billiards";
import { ring } from "../games/ring";
import { trivia } from "../games/trivia";
import { crossword } from "../games/crossword";
import { letters } from "../games/letters";
export const games: GameDefinition[] = [
  solitaire,
  sudoku,
  wordle,
  crossword,
  ring,
  letters,
  chess,
  poker,
  domino,
  billiards,
  trivia,
  ...arcadeGames,
];
export const gameById = (id: string) => games.find((g) => g.id === id);
