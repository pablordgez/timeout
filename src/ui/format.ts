import {
  labels,
  type Config,
  type GameDefinition,
  type Locale,
} from "../core/types";
export const resultLabels = {
  playing: labels("En curso", "In progress"),
  won: labels("Completada / victoria", "Completed / won"),
  lost: labels("Fin de partida / derrota", "Game over / lost"),
  draw: labels("Empate", "Draw"),
};
const metrics: Record<string, Record<Locale, string>> = {
  score: labels("Puntuación", "Score"),
  seconds: labels("Segundos", "Seconds"),
  moves: labels("Movimientos", "Moves"),
  turns: labels("Turnos", "Turns"),
  shots: labels("Tiros", "Shots"),
  fouls: labels("Faltas", "Fouls"),
  pocketed: labels("Bolas embocadas", "Balls pocketed"),
  hints: labels("Ayudas", "Hints"),
  mistakes: labels("Errores", "Mistakes"),
  technique: labels("Técnica necesaria", "Required technique"),
  attempts: labels("Intentos", "Attempts"),
  answer: labels("Solución", "Answer"),
  correct: labels("Aciertos", "Correct answers"),
  total: labels("Preguntas", "Questions"),
  size: labels("Tamaño", "Size"),
  checks: labels("Comprobaciones", "Checks"),
  words: labels("Palabras", "Words"),
  points: labels("Puntos", "Points"),
  language: labels("Idioma", "Language"),
  players: labels("Participantes", "Players"),
  winner: labels("Ganador", "Winner"),
  reason: labels("Motivo", "Reason"),
  objectives: labels("Objetivos", "Objectives"),
  lines: labels("Líneas", "Lines"),
  level: labels("Nivel", "Level"),
  variant: labels("Modalidad", "Variant"),
  completed: labels("Secuencias completadas", "Completed sequences"),
  foundations: labels("Cartas en bases", "Home cards"),
  removed: labels("Cartas retiradas", "Removed cards"),
  rounds: labels("Rondas", "Rounds"),
  chips: labels("Fichas", "Chips"),
};
export const metricLabel = (key: string, locale: Locale) =>
  metrics[key]?.[locale] ?? key;
export function configDescription(
  game: GameDefinition | undefined,
  config: Config,
  locale: Locale,
): string {
  const options =
    game?.options.filter((o) => !o.visibleWhen || o.visibleWhen(config)) ?? [];
  return options
    .map(
      (o) =>
        `${o.label[locale]}: ${o.values.find((v) => v.value === config[o.key])?.label[locale] ?? config[o.key]}`,
    )
    .concat(
      config.language ? [config.language === "es" ? "Español" : "English"] : [],
    )
    .join(" · ");
}
export function variantKey(config: Config): string {
  return (
    ["variant", "profile", "mode", "difficulty", "language"]
      .filter((k) => config[k] !== undefined)
      .map((k) => `${k}:${config[k]}`)
      .join("|") || "standard"
  );
}
export function localizedMessage(message: string, locale: Locale): string {
  const parts = message.split(" / ");
  return parts.length === 2 ? parts[locale === "es" ? 0 : 1] : message;
}
