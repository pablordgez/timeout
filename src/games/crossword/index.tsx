import { useEffect, useRef } from "react";
import { loadLexicon, words } from "../../core/lexicon";
import {
  difficulty,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameViewProps,
  type Locale,
} from "../../core/types";
import GeneratorWorker from "./generator.worker?worker&inline";
import { prepareEntries, type Entry, type Puzzle } from "./generator";
import {
  createState,
  crosswordReducer,
  currentSlot,
  type CrosswordState,
} from "./engine";
import "./crossword.css";
const entryCache: Partial<Record<Locale, Entry[]>> = {};
export async function generateCrossword(
  locale: Locale,
  size: number,
  seed: number,
  signal?: AbortSignal,
  level = "medium",
): Promise<Puzzle> {
  await loadLexicon(locale);
  if (signal?.aborted)
    throw new DOMException("Generation cancelled", "AbortError");
  const entries = (entryCache[locale] ??= prepareEntries(words[locale]));
  return new Promise((resolve, reject) => {
    const worker = new GeneratorWorker();
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException("Generation cancelled", "AbortError"));
    };
    timer = setTimeout(() => {
      cleanup();
      reject(
        Error(
          tr(
            locale,
            "La generación alcanzó su límite. Prueba una partida nueva.",
            "Generation reached its limit. Try a new game.",
          ),
        ),
      );
    }, 30000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (e) => {
      cleanup();
      e.data.error
        ? reject(
            Error(
              tr(
                locale,
                "No se encontró una cuadrícula válida dentro del límite. Prueba otra partida.",
                "No valid grid was found within the limit. Try another game.",
              ),
            ),
          )
        : resolve(e.data.result);
    };
    worker.onerror = (e) => {
      cleanup();
      reject(Error(e.message));
    };
    try {
      worker.postMessage({ size, seed, entries, locale, difficulty: level });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
function View({
  state: s,
  dispatch,
  locale,
  paused,
}: GameViewProps<CrosswordState>) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pressedCell = useRef<{ index: number; wasSelected: boolean } | null>(
    null,
  );
  const slot = currentSlot(s),
    selectedCells = new Set(slot.cells);
  const filled = s.puzzle.mask.filter((v, i) => v && !!s.board[i]).length,
    total = s.puzzle.mask.filter(Boolean).length;
  const numbering = new Map(s.puzzle.slots.map((v) => [v.cells[0], v.number]));
  useEffect(() => {
    if (!paused) {
      refs.current[s.selected]?.focus();
      refs.current[s.selected]?.select();
    }
  }, [s.selected, s.direction, paused]);
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^[a-zñáéíóúü]$/i.test(e.key)) e.currentTarget.select();
    const arrows: Record<string, string> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    if (arrows[e.key]) {
      e.preventDefault();
      dispatch({ type: "ARROW", direction: arrows[e.key] });
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "BACKSPACE" });
    }
    if (e.key === "Enter") {
      e.preventDefault();
      dispatch({ type: "CELL", index: s.selected, toggle: true });
    }
  };
  return (
    <div className="crossword-game">
      <div>
        <div className="crossword-active" aria-live="polite">
          <strong>
            {slot.number}{" "}
            {slot.direction === "across"
              ? tr(locale, "Horizontal", "Across")
              : tr(locale, "Vertical", "Down")}
          </strong>{" "}
          · {slot.clue}
        </div>
        <div
          className="crossword-grid"
          role="group"
          aria-label={tr(locale, "Cuadrícula del crucigrama", "Crossword grid")}
          style={{ gridTemplateColumns: `repeat(${s.puzzle.size},1fr)` }}
        >
          {s.puzzle.mask.map((white, i) =>
            !white ? (
              <div key={i} className="crossword-black" aria-hidden="true" />
            ) : (
              <div
                key={i}
                className={
                  "crossword-cell" +
                  (selectedCells.has(i) ? " active" : "") +
                  (s.selected === i ? " selected" : "") +
                  (s.check && s.board[i] && s.board[i] !== s.puzzle.solution[i]
                    ? " error"
                    : "")
                }
              >
                <small>{numbering.get(i) || ""}</small>
                <input
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  aria-label={`${tr(locale, "Fila", "Row")} ${Math.floor(i / s.puzzle.size) + 1}, ${tr(locale, "columna", "column")} ${(i % s.puzzle.size) + 1}${s.check && s.board[i] && s.board[i] !== s.puzzle.solution[i] ? tr(locale, ", incorrecta", ", incorrect") : ""}`}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={1}
                  disabled={paused || s.status !== "playing"}
                  value={s.board[i].toUpperCase()}
                  onPointerDown={() => {
                    pressedCell.current = {
                      index: i,
                      wasSelected: s.selected === i,
                    };
                  }}
                  onFocus={() => {
                    if (s.selected !== i) dispatch({ type: "CELL", index: i });
                  }}
                  onClick={(e) => {
                    const pressed = pressedCell.current;
                    pressedCell.current = null;
                    dispatch({
                      type: "CELL",
                      index: i,
                      toggle:
                        e.detail > 0 &&
                        pressed?.index === i &&
                        pressed.wasSelected,
                    });
                    refs.current[i]?.select();
                  }}
                  onChange={(e) =>
                    dispatch({ type: "INPUT", index: i, value: e.target.value })
                  }
                  onKeyDown={key}
                  onPaste={(e) => {
                    e.preventDefault();
                    dispatch({
                      type: "PASTE",
                      value: e.clipboardData.getData("text"),
                    });
                  }}
                />
              </div>
            ),
          )}
        </div>
        <p className="crossword-progress" aria-live="polite">
          {filled} / {total}{" "}
          {tr(locale, "letras completadas", "letters filled")}
        </p>
        <div className="controls">
          <button
            disabled={paused || s.status !== "playing"}
            onClick={() =>
              dispatch({ type: "CELL", index: s.selected, toggle: true })
            }
          >
            {tr(locale, "Cambiar dirección ↔", "Change direction ↔")}
          </button>
          <button
            disabled={paused || s.status !== "playing"}
            onClick={() => dispatch({ type: "HINT" })}
          >
            {tr(locale, "Revelar letra", "Reveal letter")}
          </button>
          <button
            disabled={paused}
            aria-pressed={s.check}
            onClick={() => dispatch({ type: "CHECK" })}
          >
            {tr(locale, "Comprobar errores", "Check errors")}{" "}
            {s.check ? "✓" : ""}
          </button>
        </div>
        <p className="muted">
          {tr(locale, "Ayudas", "Hints")}: {s.hints} ·{" "}
          {tr(
            locale,
            "Flechas para moverte; Intro cambia orientación. Se aceptan tildes, la Ñ es distinta.",
            "Arrows to navigate; Enter changes direction. Accents are accepted; Ñ remains distinct.",
          )}
        </p>
      </div>
      <div className="crossword-clues">
        {(["across", "down"] as const).map((direction) => (
          <section key={direction}>
            <h3>
              {direction === "across"
                ? tr(locale, "Horizontales", "Across")
                : tr(locale, "Verticales", "Down")}
            </h3>
            <ol>
              {s.puzzle.slots
                .filter((v) => v.direction === direction)
                .map((v) => (
                  <li key={v.id} value={v.number}>
                    <button
                      disabled={paused}
                      aria-current={slot.id === v.id ? "true" : undefined}
                      className={
                        v.cells.every(
                          (i) => s.board[i] === s.puzzle.solution[i],
                        ) && s.check
                          ? "completed"
                          : v.cells.every((i) => !!s.board[i])
                            ? "filled"
                            : ""
                      }
                      onClick={() => {
                        dispatch({ type: "SLOT", id: v.id });
                        const i =
                          v.cells.find((i) => !s.board[i]) ?? v.cells[0];
                        refs.current[i]?.focus();
                        refs.current[i]?.select();
                      }}
                    >
                      <span>{v.clue}</span> <small>({v.cells.length})</small>
                    </button>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
export const crossword: GameDefinition<CrosswordState> = {
  id: "crossword",
  name: labels("Crucigramas", "Crosswords"),
  description: labels(
    "Resuelve las definiciones y completa la cuadrícula.",
    "Solve the clues and fill the grid.",
  ),
  category: "words",
  icon: "▦",
  version: 1,
  defaults: { size: 9, difficulty: "medium" },
  options: [
    difficulty,
    select(
      "size",
      "Tamaño",
      "Size",
      [
        [9, "9 × 9", "9 × 9"],
        [11, "11 × 11", "11 × 11"],
        [13, "13 × 13", "13 × 13"],
      ],
      9,
    ),
  ],
  create: async (c, seed, signal) =>
    createState(
      await generateCrossword(
        c.language === "en" ? "en" : "es",
        Number(c.size) || 9,
        seed,
        signal,
        String(c.difficulty || "medium"),
      ),
      seed,
    ),
  reducer: crosswordReducer,
  View,
  guide: [
    {
      title: labels("Dos direcciones, una letra", "Two directions, one letter"),
      text: labels(
        "Cada número inicia una palabra horizontal, vertical o ambas. Las palabras se cruzan y comparten letras. Selecciona una definición para ir a su primera casilla vacía.",
        "Each number starts an across word, a down word, or both. Words cross and share letters. Select a clue to move to its first empty cell.",
      ),
      diagram: "1 C A S A\n  A\n  M\n  A",
      action: { type: "SLOT", id: 0 },
    },
    {
      title: labels("Escribe y cruza", "Type and cross"),
      text: labels(
        "Escribe una letra por casilla. Avanzas automáticamente; las flechas saltan a la siguiente casilla blanca. Intro o un segundo toque cambia la dirección. Puedes pegar una palabra en la entrada activa.",
        "Type one letter per cell. You advance automatically; arrows skip to the next white cell. Enter or another tap switches direction. Paste a word into the active entry.",
      ),
      diagram: "→ HORIZONTAL\n↓ VERTICAL",
    },
    {
      title: labels(
        "Ayudas sin perder la partida",
        "Hints without losing the game",
      ),
      text: labels(
        "Comprobar señala con ! las letras incorrectas sin borrarlas. Revelar completa una letra y registra una ayuda. Ganas al completar correctamente todas las palabras. Cada letra blanca vale 10 puntos; cada ayuda resta 20.",
        "Check marks incorrect letters with ! without erasing them. Reveal fills a letter and records a hint. Complete every word correctly to win. Each white cell is worth 10 points; each hint deducts 20.",
      ),
      diagram: "□ → A\n! → corregir / correct",
      action: { type: "CHECK" },
    },
    {
      title: labels("Vocabulario abierto", "Open vocabulary"),
      text: labels(
        "Las definiciones proceden de Wikcionario. Puede haber términos regionales, técnicos o antiguos. La dificultad mezcla vocabulario cotidiano, familiar y avanzado. Las cuadrículas conectadas dejan espacio entre palabras para evitar cruces que obliguen a términos raros.",
        "Definitions come from Wiktionary. Regional, technical or old words may occur. Difficulty mixes everyday, familiar and advanced vocabulary. Connected grids leave space between words to avoid crossings that force obscure terms.",
      ),
      diagram: "··■··\n·····\n■···■\n·····\n··■··",
    },
  ],
  summarize: (s) => ({
    size: s.puzzle.size,
    hints: s.hints,
    checks: s.checks,
    words: s.puzzle.slots.length,
  }),
};
