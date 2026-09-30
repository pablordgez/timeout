import { useState } from "react";
import {
  baseState,
  labels,
  tr,
  type GameDefinition,
  type GameState,
  type GameViewProps,
  type Action,
} from "../../core/types";
import { accepted, normalize, targets, loadLexicon } from "../../core/lexicon";
import { random } from "../../core/random";
export function evaluateGuess(guess: string, target: string): number[] {
  const marks = Array(5).fill(0),
    counts = new Map<string, number>();
  for (let i = 0; i < 5; i++)
    if (guess[i] === target[i]) marks[i] = 2;
    else counts.set(target[i], (counts.get(target[i]) || 0) + 1);
  for (let i = 0; i < 5; i++)
    if (marks[i] !== 2 && (counts.get(guess[i]) || 0) > 0) {
      marks[i] = 1;
      counts.set(guess[i], counts.get(guess[i])! - 1);
    }
  return marks;
}
interface State extends GameState {
  target: string;
  guesses: string[];
  marks: number[][];
  language: "es" | "en";
}
function View({ state: s, dispatch, locale, paused }: GameViewProps<State>) {
  const [input, setInput] = useState("");
  const submit = () => {
    if (!paused) {
      dispatch({ type: "GUESS", word: input });
      if(accepted(s.language).has(normalize(input)) && input.length===5) setInput("");
    }
  };
  const keyStatus: Record<string, number> = {};
  s.guesses.forEach((g, j) =>
    [...g].forEach(
      (ch, i) => (keyStatus[ch] = Math.max(keyStatus[ch] ?? -1, s.marks[j][i])),
    ),
  );
  const keys =
    s.language === "es"
      ? "qwertyuiopasdfghjklñzxcvbnm"
      : "qwertyuiopasdfghjklzxcvbnm";
  return (
    <div className="wordle">
      <div
        className="letter-grid"
        aria-label={tr(locale, "Intentos", "Guesses")}
      >
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const mark = s.marks[row]?.[col];
            return (
              <div
                key={`${row}-${col}-${mark ?? 'input'}`}
                style={mark===undefined ? undefined : {animationDelay:`${col*85}ms`}}
                className={
                  "letter-cell " +
                  (mark === 2
                    ? "correct"
                    : mark === 1
                      ? "present"
                      : mark === 0
                        ? "absent"
                        : "")
                }
                aria-label={
                  mark === undefined
                    ? undefined
                    : [
                        "Ausente / Absent",
                        "Otra posición / Elsewhere",
                        "Correcta / Correct",
                      ][mark]
                }
              >
                {(
                  s.guesses[row]?.[col] ||
                  (row === s.guesses.length ? input[col] : "")
                )?.toUpperCase()}
                {mark === undefined ? null : (
                  <small>{["×", "•", "✓"][mark]}</small>
                )}
              </div>
            );
          }),
        )}
      </div>
      {s.status === "playing" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="word-guess">
            {tr(locale, "Palabra", "Word")}
          </label>
          <input
            id="word-guess"
            disabled={paused}
            maxLength={5}
            autoComplete="off"
            value={input}
            onChange={(e) =>
              setInput(
                normalize(e.target.value).replace(
                  s.language === "es" ? /[^a-zñ]/g : /[^a-z]/g,
                  "",
                ),
              )
            }
          />
          <button type="submit" disabled={paused || input.length !== 5}>
            {tr(locale, "Comprobar", "Check")}
          </button>
        </form>
      ) : (
        <p className="result-answer">{s.target.toUpperCase()}</p>
      )}
      <div className="letter-keyboard">
        {[...keys].map((ch) => (
          <button
            key={ch}
            data-sound="write"
            className={
              keyStatus[ch] === 2
                ? "correct"
                : keyStatus[ch] === 1
                  ? "present"
                  : keyStatus[ch] === 0
                    ? "absent"
                    : ""
            }
            disabled={paused || s.status !== 'playing'}
            onClick={() => setInput((v) => (v.length < 5 ? v + ch : v))}
          >
            {ch.toUpperCase()}
          </button>
        ))}
        <button data-sound="erase" disabled={paused || s.status !== 'playing'} onClick={() => setInput((v) => v.slice(0, -1))}>⌫</button>
      </div>
    </div>
  );
}
export const wordle: GameDefinition<State> = {
  id: "wordle",
  name: labels("Cinco letras", "Five letters"),
  description: labels(
    "Una palabra. Seis oportunidades.",
    "One word. Six chances.",
  ),
  icon: "Aa",
  category: "words",
  version: 1,
  options: [],
  defaults: {},
  create: async (cfg, seed) => {
    const language = cfg.language === "en" ? "en" : "es";
    await loadLexicon(language);
    const pool = targets(language),
      [r, next] = random(seed);
    return {
      ...baseState(next),
      target: normalize(pool[Math.floor(r * pool.length)]),
      guesses: [],
      marks: [],
      language,
    };
  },
  reducer: (s, a) => {
    if (a.type !== "GUESS" || s.status !== "playing") return s;
    const word = normalize(String(a.word));
    if (word.length !== 5 || !accepted(s.language).has(word))
      return {
        ...s,
        message: tr(
          s.language,
          "Esa palabra no está en el diccionario incluido.",
          "That word is not in the included dictionary.",
        ),
      };
    const marks = evaluateGuess(word, s.target),
      guesses = [...s.guesses, word],
      won = word === s.target;
    return {
      ...s,
      guesses,
      marks: [...s.marks, marks],
      moves: guesses.length,
      status: won ? "won" : guesses.length === 6 ? "lost" : "playing",
      score: won ? (7 - guesses.length) * 100 : 0,
      message: undefined,
    };
  },
  View,
  guide: [
    {
      title: labels("Encuentra la palabra", "Find the word"),
      text: labels(
        "Escribe una palabra de cinco letras. Tienes seis intentos; cada uno debe estar en el léxico incluido.",
        "Enter a five-letter word. You have six attempts; every guess must be in the included lexicon.",
      ),
      diagram: "A ✓   R •   B ×   O ✓   L ×",
    },
    {
      title: labels("Lee las pistas", "Read the clues"),
      text: labels(
        "✓ coincide en letra y posición. • existe en otra posición. × no queda ninguna copia de esa letra. Las letras repetidas se cuentan individualmente.",
        "✓ matches letter and position. • occurs elsewhere. × has no remaining copy. Repeated letters are counted individually.",
      ),
    },
    {
      title: labels("Práctica", "Practice"),
      text: labels(
        "Prueba una palabra y observa las marcas y el teclado. La práctica no cuenta para tus estadísticas.",
        "Try a word and inspect the marks and keyboard. Practice does not affect your statistics.",
      ),
      action: { type: "GUESS", word: "canto" },
    },
  ],
  summarize: (s) => ({ attempts: s.guesses.length, answer: s.target }),
};
