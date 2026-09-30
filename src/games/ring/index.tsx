import { useState } from "react";
import {
  baseState,
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
}
function View({ state: s, dispatch, locale, paused }: GameViewProps<State>) {
  const [answer, setAnswer] = useState("");
  const q = s.questions[s.index];
  return (
    <div className="ring-layout">
      <div className="word-ring">
        {s.questions.map((q, i) => {
          const angle = (i / s.questions.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button
              key={q.letter}
              style={{
                left: `${50 + 43 * Math.cos(angle)}%`,
                top: `${50 + 43 * Math.sin(angle)}%`,
              }}
              className={
                "ring-letter " + q.result + (i === s.index ? " current" : "")
              }
              onClick={() => dispatch({ type: "SELECT", index: i })}
              aria-label={`${q.letter}: ${q.result}`}
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
        {s.status === "playing" ? (
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
                onClick={() => {
                  dispatch({ type: "PASS" });
                  setAnswer("");
                }}
              >
                {tr(locale, "Pasar palabra", "Pass")}
              </button>
              <button onClick={() => dispatch({ type: "REVEAL" })}>
                {tr(locale, "Revelar (fallo)", "Reveal (miss)")}
              </button>
            </div>
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
    "Da una vuelta al abecedario.",
    "Take a lap around the alphabet.",
  ),
  category: "words",
  icon: "◎",
  version: 1,
  defaults: { duration: 180 },
  options: [
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
    const pool = clueWords(language),
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
      const out = shuffle(suitable, seed);
      seed = out.seed;
      const selected = out.items[0];
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
        "El reloj solo corre mientras juegas. Al terminar podrás revisar todas las soluciones.",
        "The clock runs only while playing. Review every answer after the round ends.",
      ),
    },
  ],
  summarize: (s) => ({
    correct: s.questions.filter((q) => q.result === "correct").length,
    total: s.questions.length,
  }),
};
