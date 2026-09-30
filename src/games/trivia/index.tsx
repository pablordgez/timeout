import { useEffect, useState } from "react";
import { normalize } from "../../core/lexicon";
import corpus from "../../data/trivia.json";
import spanishCorpus from "../../data/trivia-es.json";
import { spanishQuestions } from "./spanish";
import {
  baseState,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameState,
  type GameViewProps,
  type Config,
  type Action,
} from "../../core/types";
import { mixSeed, random, shuffle } from "../../core/random";
export interface TriviaQuestion {
  id: string;
  category: number;
  q: string;
  a: string;
  lang: string;
}
export function migrateTrivia(s: State): State {
  const state = {
    ...s,
    players: s.players.map((p, i) => ({ ...botProfile(s.rng, i), ...p })),
  };
  if (!s.pool.every((q) => q.lang === "es")) return state;
  const existing = new Set(s.pool.map((q) => q.id));
  const additions = spanishCorpus.filter((q) => !existing.has(q.id));
  if (!additions.length) return state;
  let rng = s.rng;
  const decks = s.decks.map((deck, category) => {
    const shuffled = shuffle(
      [
        ...deck,
        ...additions.filter((q) => q.category === category).map((q) => q.id),
      ],
      rng,
    );
    rng = shuffled.seed;
    return shuffled.items;
  });
  return { ...state, pool: [...s.pool, ...additions], decks, rng };
}
export const categoryNames = [
  labels("Geografía", "Geography"),
  labels("Historia", "History"),
  labels("Ciencias", "Science"),
  labels("Arte y letras", "Arts & literature"),
  labels("Espectáculos", "Entertainment"),
  labels("Deportes y ocio", "Sports & leisure"),
];
export function neighbours(node: number): number[] {
  if (node === 0) return [47, 52, 57, 62, 67, 72];
  if (node <= 42) {
    const out = [node === 1 ? 42 : node - 1, node === 42 ? 1 : node + 1];
    if ((node - 1) % 7 === 0) out.push(43 + Math.floor((node - 1) / 7) * 5);
    return out;
  }
  const i = node - 43,
    sector = Math.floor(i / 5),
    step = i % 5;
  return [step === 0 ? 1 + sector * 7 : node - 1, step === 4 ? 0 : node + 1];
}
export function destinations(node: number, steps: number) {
  const result = new Set<number>();
  function walk(n: number, left: number, prev: number) {
    if (!left) {
      result.add(n);
      return;
    }
    for (const next of neighbours(n))
      if (next !== prev) walk(next, left - 1, n);
  }
  walk(node, steps, -1);
  return [...result];
}
interface State extends GameState {
  turn: number;
  players: {
    name: string;
    position: number;
    tokens: boolean[];
    correct: number;
    attempts: number;
    streak?: number;
    skills?: number[];
    weakness?: number;
  }[];
  phase: "roll" | "move" | "question" | "reveal";
  dice: number;
  destinations: number[];
  question: TriviaQuestion | null;
  decks: string[][];
  pool: TriviaQuestion[];
  answer: string;
  final: boolean;
  winner: number | null;
}
const nodeCategory = (node: number) =>
  node === 0 ? 0 : node <= 42 ? (node - 1) % 6 : Math.floor((node - 43) / 5);
export function exactAnswer(answer: string, solution: string) {
  const clean = (v: string) =>
    normalize(v.trim())
      .replace(/\s+/g, " ")
      .replace(/^["“«]+|["”».!?]+$/g, "")
      .trim();
  return !!clean(answer) && clean(answer) === clean(solution);
}
export function botAccuracy(s: State, cfg: Config) {
  const levels: Record<string, number> = {
    easy: 0.38,
    medium: 0.6,
    hard: 0.78,
    expert: 0.86,
  };
  const base =
    levels[String(cfg.difficulty)] ??
    (Number.isFinite(Number(cfg.probability))
      ? Number(cfg.probability) / 100
      : 0.6);
  const player = s.players[s.turn];
  // Mild, secret category strengths persist with the match. Legacy saves use a seeded profile too.
  const skills =
    player.skills ??
    shuffle(
      [-0.06, -0.04, -0.02, 0.02, 0.04, 0.06],
      s.rng ^ ((s.turn + 1) * 0x9e3779b9),
    ).items;
  const fatigue = Math.min(0.12, (player.streak || 0) * 0.02);
  const weakness =
    ["easy", "medium"].includes(String(cfg.difficulty || "medium")) &&
    player.weakness === s.question?.category
      ? 0.15
      : 0;
  return Math.max(
    0.15,
    Math.min(
      0.92,
      base + skills[s.question?.category ?? 0] - fatigue - weakness,
    ),
  );
}
function pickQuestion(s: State, cat: number): State {
  let deck = s.decks[cat],
    rng = s.rng;
  if (!deck.length) {
    const out = shuffle(
      s.pool.filter((q) => q.category === cat).map((q) => q.id),
      rng,
    );
    deck = out.items;
    rng = out.seed;
  }
  const id = deck[0],
    question = s.pool.find((q) => q.id === id)!;
  const decks = s.decks.map((d, i) => (i === cat ? deck.slice(1) : d));
  return { ...s, rng, decks, question, phase: "question", answer: "" };
}
export function botProfile(seed: number, index: number) {
  const profile = shuffle(
    [-0.06, -0.04, -0.02, 0.02, 0.04, 0.06],
    mixSeed(seed, (index + 1) * 0x9e3779b9),
  );
  const [weak, next] = random(profile.seed);
  return {
    skills: profile.items,
    weakness: weak < 0.5 ? Math.floor(random(next)[0] * 6) : -1,
    streak: 0,
  };
}
export function triviaReducer(s: State, a: Action, cfg: Config): State {
  if (s.status !== "playing") return s;
  if (a.type === "ROLL" && s.phase === "roll") {
    const [r, rng] = random(s.rng),
      dice = Math.floor(r * 6) + 1;
    return {
      ...s,
      rng,
      dice,
      destinations: destinations(s.players[s.turn].position, dice),
      phase: "move",
    };
  }
  if (
    a.type === "MOVE" &&
    s.phase === "move" &&
    s.destinations.includes(a.node)
  ) {
    const players = s.players.map((p, i) =>
      i === s.turn ? { ...p, position: a.node } : p,
    );
    let next = {
      ...s,
      players,
      moves: s.moves + 1,
      final: a.node === 0 && players[s.turn].tokens.every(Boolean),
    };
    if (next.final) {
      const [r, rng] = random(s.rng);
      next = { ...next, rng };
      return pickQuestion(next, Math.floor(r * 6));
    }
    return pickQuestion(next, nodeCategory(a.node));
  }
  if (a.type === "ANSWER" && s.phase === "question") {
    const revealed: State = {
      ...s,
      answer: String(a.answer),
      rng: random(s.rng)[1],
      phase: "reveal",
    };
    if (
      s.turn < Number(cfg.humans || 1) &&
      exactAnswer(String(a.answer), s.question!.a)
    )
      return triviaReducer(revealed, { type: "GRADE", correct: true }, cfg);
    return revealed;
  }
  if (a.type === "GRADE" && s.phase === "reveal") {
    const correct = !!a.correct,
      players = s.players.map((p) => ({ ...p, tokens: [...p.tokens] })),
      p = players[s.turn];
    p.attempts++;
    p.streak = correct ? (p.streak || 0) + 1 : 0;
    if (correct) {
      p.correct++;
      if (p.position > 0 && p.position <= 42 && (p.position - 1) % 7 === 0)
        p.tokens[s.question!.category] = true;
    }
    const win = correct && s.final;
    return {
      ...s,
      players,
      status: win ? (s.turn === 0 ? "won" : "lost") : "playing",
      winner: win ? s.turn : null,
      score:
        players[0].correct * 100 +
        players[0].tokens.filter(Boolean).length * 500,
      turn: correct ? s.turn : (s.turn + 1) % players.length,
      phase: "roll",
      question: null,
      final: false,
      lastAnswer: labels(
        `${s.players[s.turn].name}: ${correct ? "✓" : "×"} ${s.question!.a}${correct && p.tokens.filter(Boolean).length > s.players[s.turn].tokens.filter(Boolean).length ? " · Categoría conseguida ◆" : ""}`,
        `${s.players[s.turn].name}: ${correct ? "✓" : "×"} ${s.question!.a}${correct && p.tokens.filter(Boolean).length > s.players[s.turn].tokens.filter(Boolean).length ? " · Category earned ◆" : ""}`,
      ),
    };
  }
  return s;
}
function position(node: number) {
  if (node === 0) return [50, 50];
  if (node <= 42) {
    const angle = ((node - 1) / 42) * Math.PI * 2 - Math.PI / 2;
    return [50 + 44 * Math.cos(angle), 50 + 44 * Math.sin(angle)];
  }
  const i = node - 43,
    angle = (Math.floor(i / 5) / 6) * Math.PI * 2 - Math.PI / 2,
    radius = 36 - (i % 5) * 7;
  return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
}
function View({
  state: s,
  dispatch,
  locale,
  paused,
  config,
}: GameViewProps<State>) {
  const [answer, setAnswer] = useState("");
  useEffect(() => setAnswer(""), [s.question?.id, s.turn]);
  const p = s.players[s.turn],
    bot = s.turn >= Number(config.humans);
  return (
    <div className="trivia-layout">
      <div className="trivia-board">
        <svg className="trivia-paths" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" />
          {Array.from({ length: 6 }, (_, i) => {
            const [x, y] = position(1 + i * 7);
            return <line key={i} x1="50" y1="50" x2={x} y2={y} />;
          })}
        </svg>
        {Array.from({ length: 73 }, (_, node) => {
          const [x, y] = position(node);
          const objective = node > 0 && node <= 42 && (node - 1) % 7 === 0;
          return (
            <button
              key={node}
              style={{
                left: x + "%",
                top: y + "%",
                background: `var(--category-${nodeCategory(node)})`,
              }}
              disabled={
                paused ||
                bot ||
                s.phase !== "move" ||
                !s.destinations.includes(node)
              }
              onClick={() => {
                dispatch({ type: "MOVE", node });
                setAnswer("");
              }}
              className={
                "trivia-node" +
                (objective ? " objective" : "") +
                (s.destinations.includes(node) && s.phase === "move"
                  ? " reachable"
                  : "")
              }
              aria-label={`${node === 0 ? tr(locale, "Centro", "Center") : categoryNames[nodeCategory(node)][locale]} ${node}`}
            >
              {node === 0 ? "★" : objective ? "◆" : ""}
            </button>
          );
        })}
        {s.players.map((player, i) => {
          const [x, y] = position(player.position),
            same = s.players
              .slice(0, i)
              .filter((p) => p.position === player.position).length;
          return (
            <span
              key={i}
              className={`trivia-pawn ${i === s.turn ? "current" : ""}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                marginLeft: same * 9,
                marginTop: same * 6,
              }}
              role="img"
              aria-label={`${player.name} · ${categoryNames[nodeCategory(player.position)][locale]}`}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="question-card" key={`${s.phase}:${s.question?.id || ""}`}>
        <p className="eyebrow">
          {p.name} · {tr(locale, "Dado", "Die")}: {s.dice || "—"}
        </p>
        {s.phase === "roll" ? (
          <>
            <h2>{tr(locale, "El siguiente paso", "Your next step")}</h2>
            <button
              disabled={paused || bot}
              onClick={() => dispatch({ type: "ROLL" })}
            >
              {tr(locale, "Lanzar dado", "Roll die")}
            </button>
          </>
        ) : s.phase === "move" ? (
          <h2>
            {tr(
              locale,
              "Elige una casilla iluminada",
              "Choose a highlighted space",
            )}
          </h2>
        ) : (
          <>
            <p className="eyebrow">
              {categoryNames[s.question!.category][locale]}
              {s.final
                ? " · " + tr(locale, "Pregunta final", "Final question")
                : ""}
            </p>
            <h2>{s.question!.q}</h2>
            {s.phase === "question" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  dispatch({ type: "ANSWER", answer });
                }}
              >
                <input
                  value={answer}
                  aria-label={tr(locale, "Tu respuesta", "Your answer")}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={paused || bot}
                />
                <button disabled={paused || bot}>
                  {tr(locale, "Comprobar respuesta", "Check answer")}
                </button>
              </form>
            ) : (
              <>
                <p>
                  {bot
                    ? tr(locale, "Respuesta del bot", "Bot answer")
                    : tr(locale, "Tu respuesta", "Your answer")}
                  : {s.answer || "—"}
                </p>
                <p className="solution">{s.question!.a}</p>
                <p className="muted">
                  {bot
                    ? tr(
                        locale,
                        "Solución · El resultado aparecerá en la siguiente acción.",
                        "Solution · The result will appear on the next action.",
                      )
                    : tr(
                        locale,
                        "Acepta sinónimos y respuestas equivalentes. Tú decides.",
                        "Accept synonyms and equivalent answers. You decide.",
                      )}
                </p>
                {!bot && (
                  <div className="controls">
                    <button
                      disabled={bot || paused}
                      onClick={() => dispatch({ type: "GRADE", correct: true })}
                    >
                      {tr(locale, "He acertado", "Correct")}
                    </button>
                    <button
                      disabled={bot || paused}
                      onClick={() =>
                        dispatch({ type: "GRADE", correct: false })
                      }
                    >
                      {tr(locale, "He fallado", "Incorrect")}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        <div className="trivia-scores">
          {s.players.map((p, i) => (
            <div key={i} className={i === s.turn ? "active" : ""}>
              <b>
                {i + 1}. {p.name}
              </b>
              <div>
                {p.tokens.map((v, k) => (
                  <span
                    key={k}
                    title={categoryNames[k][locale]}
                    style={{ color: `var(--category-${k})` }}
                  >
                    {v ? "◆" : "◇"}
                  </span>
                ))}
              </div>
              <small>
                {p.correct}/{p.attempts} ✓
                {(p.streak || 0) > 1
                  ? ` · ${tr(locale, "Racha", "Streak")} ${p.streak}`
                  : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export const trivia: GameDefinition<State> = {
  id: "trivia",
  name: labels("Preguntas y respuestas", "Questions & answers"),
  description: labels(
    "Responde preguntas en seis categorías.",
    "Answer questions in six categories.",
  ),
  category: "board",
  icon: "✳",
  version: 3,
  migrate: migrateTrivia,
  defaults: { players: 2, humans: 1, difficulty: "medium" },
  options: [
    select(
      "players",
      "Participantes",
      "Players",
      [
        [2, "2", "2"],
        [3, "3", "3"],
        [4, "4", "4"],
        [5, "5", "5"],
        [6, "6", "6"],
      ],
      2,
    ),
    select(
      "humans",
      "Personas",
      "Humans",
      [
        [1, "1", "1"],
        [2, "2", "2"],
        [3, "3", "3"],
        [4, "4", "4"],
        [5, "5", "5"],
        [6, "6", "6"],
      ],
      1,
    ),
    select(
      "difficulty",
      "Dificultad del bot",
      "Bot difficulty",
      [
        ["easy", "Fácil", "Easy"],
        ["medium", "Media", "Medium"],
        ["hard", "Difícil", "Hard"],
        ["expert", "Experto", "Expert"],
      ],
      "medium",
      (c) => Number(c.humans) < Number(c.players),
    ),
  ],
  create: (cfg, seed) => {
    const pool: TriviaQuestion[] =
      cfg.language === "en"
        ? corpus
        : [
            ...spanishQuestions.map(([category, q, a], i) => ({
              id: "es-" + i,
              category,
              q,
              a,
              lang: "es",
            })),
            ...spanishCorpus,
          ];
    let rng = seed;
    const decks = Array.from({ length: 6 }, (_, cat) => {
      const out = shuffle(
        pool.filter((q) => q.category === cat).map((q) => q.id),
        rng,
      );
      rng = out.seed;
      return out.items;
    });
    return {
      ...baseState(rng),
      turn: 0,
      players: Array.from({ length: Number(cfg.players) }, (_, i) => {
        return {
          name: (i < Number(cfg.humans) ? "P" : "Bot ") + (i + 1),
          position: 0,
          tokens: Array(6).fill(false),
          correct: 0,
          attempts: 0,
          ...botProfile(seed, i),
        };
      }),
      phase: "roll",
      dice: 0,
      destinations: [],
      question: null,
      decks,
      pool,
      answer: "",
      final: false,
      winner: null,
    };
  },
  reducer: triviaReducer,
  View,
  getTurn: (s, cfg) =>
    s.status !== "playing"
      ? null
      : {
          player: s.turn,
          bot: s.turn >= Number(cfg.humans),
          hidden: false,
        },
  bot: (s, cfg) => {
    if (s.phase === "roll") return { type: "ROLL" };
    if (s.phase === "move") {
      const p = s.players[s.turn];
      const ranked = [...s.destinations].sort((a, b) => {
        const value = (n: number) =>
          n === 0 && p.tokens.every(Boolean)
            ? 100
            : n > 0 &&
                n <= 42 &&
                (n - 1) % 7 === 0 &&
                !p.tokens[nodeCategory(n)]
              ? 10
              : !p.tokens[nodeCategory(n)]
                ? 2
                : 0;
        return value(b) - value(a);
      });
      return { type: "MOVE", node: ranked[0] };
    }
    if (s.phase === "question") {
      const [r] = random(s.rng);
      return {
        type: "ANSWER",
        answer:
          r < botAccuracy(s, cfg)
            ? s.question!.a
            : tr(
                cfg.language === "en" ? "en" : "es",
                "No lo sé",
                "I do not know",
              ),
      };
    }
    return { type: "GRADE", correct: s.answer === s.question?.a };
  },
  guide: [
    {
      title: labels("Completa tu órbita", "Complete your orbit"),
      text: labels(
        "Lanza el dado y elige un destino a esa distancia, sin retroceder durante el mismo movimiento. Cada color representa una categoría.",
        "Roll the die and choose a destination that many steps away, without reversing during the same move. Each color represents a category.",
      ),
      diagram:
        "◆ — ○ — ○ — ○ — ○ — ○ — ○ — ◆\n│              ★              │\n◆ — ○ — ○ — ○ — ○ — ○ — ○ — ◆",
      action: { type: "ROLL" },
    },
    {
      title: labels("Seis objetivos", "Six objectives"),
      text: labels(
        "Acierta en una casilla ◆ para obtener su categoría. Los radios conectan los objetivos con el centro. Con las seis categorías, llega al centro y supera la pregunta final.",
        "Answer correctly on a ◆ space to earn its category. Spokes connect objectives to the center. With all six categories, reach the center and answer the final question.",
      ),
    },
    {
      title: labels("Respuesta abierta", "Open answers"),
      text: labels(
        "Las respuestas exactas se aceptan automáticamente, ignorando mayúsculas y tildes. Para sinónimos o respuestas equivalentes, compara la solución y decide. Un acierto permite volver a lanzar; un fallo pasa el turno. Los bots tienen pequeñas diferencias aleatorias entre categorías y sus rachas largas reducen suavemente los aciertos.",
        "Exact answers score automatically, ignoring case and accents. Compare synonyms or equivalent answers with the solution and decide. Correct answers earn another roll; misses pass the turn. Bots have small random differences between categories, and long streaks gently reduce their accuracy.",
      ),
    },
  ],
  summarize: (s) => ({
    winner: s.winner === null ? "—" : s.players[s.winner].name,
    correct: s.players[0].correct,
    objectives: s.players[0].tokens.filter(Boolean).length,
  }),
};
