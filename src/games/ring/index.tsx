import { useEffect, useState } from "react";
import { vocabularyOrder, wordBand } from "../../core/vocabulary";
import {
  baseState,
  difficulty,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameState,
  type GameViewProps,
} from "../../core/types";
import { clueWords, normalize, loadLexicon } from "../../core/lexicon";
import { shuffle } from "../../core/random";
interface Question {
  letter: string;
  w: string;
  g: string;
  contains: boolean;
  result: "pending" | "passed" | "correct" | "wrong";
}
interface State extends GameState {
  questions: Question[];
  index: number;
  remaining: number;
  duration: number;
  language: "es" | "en";
  answers: string[];
  lastMiss?: number;
}
function View({ state: s, dispatch, locale, paused }: GameViewProps<State>) {
  const [answer, setAnswer] = useState("");
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const q = s.questions[reviewIndex ?? s.index];
  const lastMiss =
    s.lastMiss === undefined ? undefined : s.questions[s.lastMiss];
  useEffect(() => setAnswer(""), [s.index]);
  return (
    <div className="ring-layout">
      <div className="word-ring">
        {s.questions.map((q, i) => {
          const angle = (i / s.questions.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button
              key={q.letter}
              disabled={paused && s.status === "playing"}
              style={{
                left: `${50 + 43 * Math.cos(angle)}%`,
                top: `${50 + 43 * Math.sin(angle)}%`,
              }}
              className={
                "ring-letter " + q.result + (i === s.index ? " current" : "")
              }
              onClick={() => {
                if (
                  s.status === "playing" &&
                  ["pending", "passed"].includes(q.result)
                ) {
                  setReviewIndex(null);
                  dispatch({ type: "SELECT", index: i });
                } else {
                  setReviewIndex(i);
                }
              }}
              aria-pressed={reviewIndex === i}
              aria-label={`${q.letter.toUpperCase()}: ${q.result === "correct" ? tr(locale, "Acierto", "Correct") : q.result === "wrong" ? tr(locale, "Fallo", "Wrong") : tr(locale, "Pendiente", "Pending")}`}
            >
              {q.letter.toUpperCase()}
              <small>
                {q.result === "correct"
                  ? "✓"
                  : q.result === "wrong"
                    ? "×"
                    : q.result === "passed"
                      ? "↻"
                      : ""}
              </small>
            </button>
          );
        })}
        <div className="ring-center">
          <strong>
            {s.questions.filter((q) => q.result === "correct").length}
          </strong>
          <span>{tr(locale, "aciertos", "correct")}</span>
          <small>{s.duration ? s.remaining + "s" : "∞"}</small>
        </div>
      </div>
      <div className="question-card">
        {reviewIndex !== null ? (
          <>
            <p className="eyebrow">{q.letter.toUpperCase()}</p>
            <h2>{q.g}</h2>
            <p className="ring-solution">
              {tr(locale, "Respuesta correcta", "Correct answer")}:{" "}
              <strong>{q.w}</strong>
            </p>
            <button onClick={() => setReviewIndex(null)}>
              {s.status === "playing"
                ? tr(locale, "Seguir jugando", "Keep playing")
                : tr(locale, "Ver todas las respuestas", "See all answers")}
            </button>
          </>
        ) : s.status === "playing" ? (
          <>
            <p className="eyebrow">
              {tr(
                locale,
                q.contains ? "Contiene" : "Empieza por",
                q.contains ? "Contains" : "Starts with",
              )}{" "}
              {q.letter.toUpperCase()}
            </p>
            <h2>{q.g}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "ANSWER", word: answer });
                setAnswer("");
              }}
            >
              <input
                aria-label={tr(locale, "Tu respuesta", "Your answer")}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={paused}
                autoComplete="off"
              />
              <button disabled={paused || !answer.trim()}>
                {tr(locale, "Responder", "Answer")}
              </button>
            </form>
            <div className="controls">
              <button
                disabled={paused}
                onClick={() => {
                  dispatch({ type: "PASS" });
                  setAnswer("");
                }}
              >
                {tr(locale, "Pasar palabra", "Pass")}
              </button>
              <button
                disabled={paused}
                onClick={() => dispatch({ type: "REVEAL" })}
              >
                {tr(locale, "Revelar (fallo)", "Reveal (miss)")}
              </button>
            </div>
            {lastMiss?.result === "wrong" ? (
              <p className="ring-answer-feedback" role="status">
                {lastMiss.letter.toUpperCase()} ·{" "}
                {tr(locale, "Respuesta correcta", "Correct answer")}:{" "}
                <strong>{lastMiss.w}</strong>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2>{tr(locale, "Ronda terminada", "Round complete")}</h2>
            <ul className="answer-list">
              {s.questions.map((q) => (
                <li key={q.letter}>
                  {q.result === "correct" ? "✓" : "×"} {q.letter.toUpperCase()}{" "}
                  — {q.w}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
export const ring: GameDefinition<State> = {
  id: "ring",
  name: labels("Ronda de letras", "Letter ring"),
  description: labels(
    "Adivina una palabra por cada letra.",
    "Guess a word for each letter.",
  ),
  category: "words",
  icon: "◎",
  version: 1,
  defaults: { duration: 180, difficulty: "medium" },
  options: [
    difficulty,
    select(
      "duration",
      "Tiempo",
      "Time",
      [
        [0, "Sin tiempo", "Untimed"],
        [180, "3 minutos", "3 minutes"],
        [300, "5 minutos", "5 minutes"],
      ],
      180,
    ),
  ],
  create: async (cfg, seed) => {
    const language = cfg.language === "en" ? "en" : "es";
    await loadLexicon(language);
    const pool = clueWords(language).filter(
        (w) => cfg.difficulty !== "easy" || wordBand(w, language) < 2,
      ),
      alphabet =
        language === "es"
          ? "abcdefghijklmnñopqrstuvwxyz"
          : "abcdefghijklmnopqrstuvwxyz",
      questions: Question[] = [];
    for (const letter of alphabet) {
      let suitable = pool.filter((w) => normalize(w.w).startsWith(letter));
      let contains = false;
      if (suitable.length < 10) {
        suitable = pool.filter((w) => normalize(w.w).includes(letter));
        contains = true;
      }
      if (!suitable.length) throw Error("Insufficient clues for " + letter);
      const ordered = vocabularyOrder(
        suitable,
        language,
        String(cfg.difficulty || "medium"),
        seed,
      );
      const out = shuffle(suitable, seed);
      seed = out.seed;
      const selected = ordered[0] || out.items[0];
      questions.push({
        letter,
        w: selected.w,
        g: selected.g,
        contains,
        result: "pending",
      });
    }
    return {
      ...baseState(seed),
      questions,
      index: 0,
      remaining: Number(cfg.duration),
      duration: Number(cfg.duration),
      language,
      answers: [],
    };
  },
  reducer: (s, a) => {
    if (s.status !== "playing") return s;
    if (a.type === "CLOCK" && s.duration)
      return {
        ...s,
        remaining: Math.max(0, s.remaining - a.dt),
        status: s.remaining <= a.dt ? "lost" : "playing",
      };
    if (
      a.type === "SELECT" &&
      ["pending", "passed"].includes(s.questions[a.index]?.result)
    )
      return { ...s, index: a.index };
    if (!["PASS", "ANSWER", "REVEAL"].includes(a.type)) return s;
    const questions = s.questions.map((q) => ({ ...q }));
    const q = questions[s.index];
    if (a.type === "PASS") q.result = "passed";
    else
      q.result =
        a.type === "ANSWER" &&
        normalize(String(a.word).trim()) === normalize(q.w)
          ? "correct"
          : "wrong";
    const pending = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.result === "pending" || q.result === "passed");
    const index =
      pending.find(({ i }) => i > s.index)?.i ?? pending[0]?.i ?? s.index;
    const done = !pending.length,
      correct = questions.filter((q) => q.result === "correct").length;
    return {
      ...s,
      questions,
      index,
      moves: s.moves + (a.type === "PASS" ? 0 : 1),
      lastMiss:
        q.result === "wrong"
          ? s.index
          : a.type === "PASS"
            ? s.lastMiss
            : undefined,
      score: correct * 100,
      status: done
        ? correct === questions.length
          ? "won"
          : "lost"
        : "playing",
      message: a.type === "REVEAL" ? q.w : undefined,
    };
  },
  View,
  guide: [
    {
      title: labels("Una letra, una definición", "A letter and a definition"),
      text: labels(
        "Contesta con una palabra que empiece por la letra marcada o la contenga, según indique la pista. Las tildes son opcionales; N y Ñ son distintas.",
        "Answer with a word beginning with or containing the marked letter, as indicated. Accents are optional; N and Ñ remain distinct.",
      ),
      diagram: "A → B → C → … → Z → A",
    },
    {
      title: labels("Puedes volver después", "Come back later"),
      text: labels(
        "Pasar palabra deja la pregunta pendiente y avanza. Verde ✓ es acierto; rojo × es fallo; ↻ es una pregunta pendiente de volver a intentar.",
        "Pass leaves the question open and moves on. Green ✓ is correct; red × is wrong; ↻ is waiting for another attempt.",
      ),
      action: { type: "PASS" },
    },
    {
      title: labels("Tiempo y respuestas", "Time and answers"),
      text: labels(
        "Tras un fallo aparece la respuesta correcta. Pulsa una letra ya respondida para revisar su definición y solución. El reloj sigue corriendo mientras consultas. Al terminar puedes ver todas las soluciones.",
        "A miss shows the correct answer. Click an answered letter to review its clue and solution. The clock keeps running while you review. All solutions are available after the round ends.",
      ),
    },
  ],
  summarize: (s) => ({
    correct: s.questions.filter((q) => q.result === "correct").length,
    total: s.questions.length,
  }),
};
