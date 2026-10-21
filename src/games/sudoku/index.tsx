import { useEffect, useState } from "react";
import {
  baseState,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameState,
  type GameViewProps,
} from "../../core/types";
import SudokuWorker from "./generator.worker?worker&inline";
import { candidates, hasConflict } from "./engine";
interface State extends GameState {
  puzzle: number[];
  solution: number[];
  board: number[];
  notes: number[][];
  selected: number;
  rating: { level: number; technique: string };
  mistakes: number;
  hints: number;
  noteMode: boolean;
  undo: { board: number[]; notes: number[][] }[];
  errorCheck?: "conflicts" | "solution" | "off";
}
function View({ state: s, dispatch, locale, paused }: GameViewProps<State>) {
  const checkMode = s.errorCheck || "conflicts";
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if(e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const arrows:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9};
      if(arrows[e.key]) {e.preventDefault();if(!paused)dispatch({type:'SELECT',index:Math.max(0,Math.min(80,s.selected+arrows[e.key]))});}
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        if (!paused) dispatch({ type: "NUMBER", value: Number(e.key) });
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (!paused) dispatch({ type: "NUMBER", value: 0 });
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [dispatch, paused, s.selected]);
  return (
    <div className="sudoku">
      <div className="sudoku-grid">
        {s.board.map((v, i) => {
          const peers =
            i % 9 === s.selected % 9 ||
            Math.floor(i / 9) === Math.floor(s.selected / 9) ||
            (Math.floor(i%9/3)===Math.floor(s.selected%9/3)&&Math.floor(i/27)===Math.floor(s.selected/27));
          return (
            <button
              key={i}
              className={
                "sudoku-cell" +
                (s.puzzle[i] ? " given" : "") +
                (s.selected === i ? " selected" : peers ? " peer" : "") +
                ((checkMode === "off" ? false : checkMode === "solution" ? Boolean(v && v !== s.solution[i]) : Boolean(v && hasConflict(s.board, i))) ? " invalid" : "") +
                (v && v === s.board[s.selected] ? ' matching' : '') +
                (i % 9 === 2 || i % 9 === 5 ? " box-right" : "") +
                (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5
                  ? " box-bottom"
                  : "")
              }
              aria-label={`${tr(locale, "Fila", "Row")} ${Math.floor(i / 9) + 1}, ${tr(locale, "columna", "column")} ${(i % 9) + 1}: ${v || tr(locale, "vacía", "empty")}`}
              onClick={() => dispatch({ type: "SELECT", index: i })}
              disabled={paused}
            >
              {v || (
                <span className="notes">
                  {Array.from({ length: 9 }, (_, n) => (
                    <small key={n}>
                      {s.notes[i].includes(n + 1) ? n + 1 : ""}
                    </small>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="number-controls">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((v) => (
          <button
            key={v}
            disabled={paused || (v>0 && s.board.filter(n=>n===v).length===9)}
            onClick={() => dispatch({ type: "NUMBER", value: v })}
          >
            {v || "⌫"}<small className="number-remaining">{v ? Math.max(0,9-s.board.filter(n=>n===v).length) : ''}</small>
          </button>
        ))}
      </div>
      <div className="controls">
        <button className="sd-button"
          aria-pressed={s.noteMode}
          onClick={() => dispatch({ type: "NOTES" })}
        >
          {tr(locale, "Notas", "Notes")} {s.noteMode ? "✓" : ""}
        </button>
        <button className="sd-button"
          disabled={!s.undo.length}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          {tr(locale, "Deshacer", "Undo")}
        </button>
        <button className="sd-button" onClick={() => dispatch({ type: "HINT" })}>
          {tr(locale, "Ayuda", "Hint")}
        </button>
      </div>
      <p className="muted">
        {tr(locale, "Nivel verificado", "Verified level")}: {s.rating.level} ·{" "}
        {s.rating.technique} · {tr(locale, "Ayudas", "Hints")}: {s.hints}
      </p>
    </div>
  );
}
export const sudoku: GameDefinition<State> = {
  id: "sudoku",
  name: labels("Sudoku", "Sudoku"),
  description: labels(
    "Completa la cuadrícula sin repetir números.",
    "Nine numbers. A moment of calm.",
  ),
  category: "puzzles",
  icon: "9",
  version: 1,
  options: [
    select(
      "difficulty",
      "Dificultad",
      "Difficulty",
      [
        [1, "Fácil", "Easy"],
        [2, "Media", "Medium"],
        [3, "Difícil", "Hard"],
        [4, "Experta", "Expert"],
      ],
      1,
    ),
    select(
      "errorCheck",
      "Aviso de errores",
      "Error check",
      [
        ["conflicts", "Solo conflictos directos", "Direct conflicts only"],
        ["solution", "Comprobar con solución", "Check against solution"],
        ["off", "Desactivado", "Off"],
      ],
      "conflicts",
    ),
  ],
  defaults: { difficulty: 1, errorCheck: "conflicts" },
  create: async (cfg, seed, signal) => {
    const generated = await new Promise<any>((resolve, reject) => {
      const w = new SudokuWorker();
      const abort = () => {
        clearTimeout(timer);
        w.terminate();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => {
        w.terminate();
        reject(Error("Sudoku generation timed out"));
      }, 30000);
      w.onmessage = (e) => {
        signal?.removeEventListener("abort", abort);
        clearTimeout(timer);
        w.terminate();
        e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result);
      };
      w.onerror = (e) => {
        signal?.removeEventListener("abort", abort);
        clearTimeout(timer);
        w.terminate();
        reject(Error(e.message));
      };
      w.postMessage({ seed, level: Number(cfg.difficulty) });
    });
    return {
      ...baseState(generated.rng),
      ...generated,
      board: [...generated.puzzle],
      notes: Array.from({ length: 81 }, () => []),
      selected: 0,
      mistakes: 0,
      hints: 0,
      noteMode: false,
      undo: [],
      errorCheck: (cfg.errorCheck as any) || "conflicts",
    };
  },
  reducer: (s, a) => {
    if (a.type === "SELECT") return { ...s, selected: a.index };
    if (a.type === "NOTES") return { ...s, noteMode: !s.noteMode };
    if (a.type === "DEMO_NOTES" || (a.type === "NOTES" && a.demo)) {
      let idx = s.board.findIndex((v, i) => !v && s.notes[i].length === 0);
      if (idx < 0) idx = s.board.findIndex((v) => !v);
      if (idx < 0) return { ...s, noteMode: true };
      const cs = candidates(s.board, idx);
      const notes = s.notes.map((n, i) => (i === idx ? (cs.length ? cs : [1, 2]) : [...n]));
      return {
        ...s,
        selected: idx,
        noteMode: true,
        notes,
      };
    }
    if (a.type === "UNDO") {
      const prev = s.undo.at(-1);
      return prev
        ? { ...s, ...prev, undo: s.undo.slice(0, -1), status: "playing" }
        : s;
    }
    if (s.status !== "playing") return s;
    if (a.type === "NUMBER" || a.type === "HINT") {
      let i = s.selected,
        value = Number(a.value);
      if (a.type === "HINT") {
        i = s.board.findIndex((v, i) => v !== s.solution[i]);
        if (i < 0) return s;
        value = s.solution[i];
      }
      if (s.puzzle[i] || !Number.isInteger(value) || value < 0 || value > 9)
        return s;
      const board = [...s.board],
        notes = s.notes.map((n) => [...n]);
      const undo = [...s.undo.slice(-99), { board: s.board, notes: s.notes }];
      if (s.noteMode && value && a.type !== "HINT") {
        notes[i] = notes[i].includes(value)
          ? notes[i].filter((n) => n !== value)
          : [...notes[i], value];
        return { ...s, notes, undo };
      }
      board[i] = value;
      notes[i] = [];
      const won = board.every((v, i) => v === s.solution[i]);
      const checkMode = s.errorCheck || "conflicts";
      const wrong = value !== 0 && (
        checkMode === "off"
          ? false
          : checkMode === "solution"
            ? value !== s.solution[i]
            : hasConflict(board, i)
      );
      const hints = s.hints + (a.type === "HINT" ? 1 : 0);
      return {
        ...s,
        board,
        notes,
        undo,
        selected: i,
        moves: s.moves + 1,
        hints,
        mistakes: s.mistakes + (wrong ? 1 : 0),
        status: won ? "won" : "playing",
        score: won ? Math.max(0, 1000 - hints * 100 - s.mistakes * 10) : 0,
        message: wrong
          ? (checkMode === "solution"
              ? "Ese número entra en conflicto con la solución / That number conflicts with the solution"
              : "Ese número entra en conflicto con otra casilla / That number conflicts with another cell")
          : a.type === "HINT"
            ? `Candidatos legales / Legal candidates: ${candidates(s.board, i).join(", ")}`
            : undefined,
      };
    }
    return s;
  },
  View,
  guide: [
    {
      title: labels("Tres restricciones", "Three constraints"),
      text: labels(
        "Cada fila, columna y caja de 3×3 contiene del 1 al 9, sin repetir. Las cifras iniciales no se pueden cambiar.",
        "Each row, column and 3×3 box contains 1–9 without repetition. Given digits cannot be changed.",
      ),
      diagram:
        "1 2 3 │ 4 5 6 │ 7 8 9\n4 5 6 │ 7 8 9 │ 1 2 3\n7 8 9 │ 1 2 3 │ 4 5 6",
    },
    {
      title: labels("Anota candidatos", "Note candidates"),
      text: labels(
        "Selecciona una casilla y activa Notas. Pulsa cifras para añadirlas o quitarlas. Busca casillas con un solo candidato.",
        "Select a cell and enable Notes. Tap digits to add or remove candidates. Look for a cell with only one candidate.",
      ),
      action: { type: "DEMO_NOTES" },
    },
    {
      title: labels("Una ayuda explicada", "An explained hint"),
      text: labels(
        "Ayuda muestra candidatos legales y completa una casilla. Las ayudas quedan registradas por separado.",
        "Hint shows legal candidates and fills a cell. Hint usage is tracked separately.",
      ),
      action: { type: "HINT" },
    },
  ],
  summarize: (s) => ({
    hints: s.hints,
    mistakes: s.mistakes,
    technique: s.rating.technique,
  }),
};
