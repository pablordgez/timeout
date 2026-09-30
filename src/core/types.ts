import type { ComponentType } from "react";
export type Locale = "es" | "en";
export type Config = Record<string, string | number | boolean>;
export type Action = { type: string; [key: string]: any };
export interface GameState {
  status: "playing" | "won" | "lost" | "draw";
  rng: number;
  score: number;
  moves: number;
  message?: string;
  [key: string]: any;
}
export interface GameViewProps<S extends GameState = GameState> {
  state: S;
  dispatch: (action: Action) => void;
  config: Config;
  locale: Locale;
  paused: boolean;
}
export interface Option {
  key: string;
  label: Record<Locale, string>;
  values: { value: string | number | boolean; label: Record<Locale, string> }[];
  default: string | number | boolean;
  visibleWhen?: (config: Config) => boolean;
}
export interface GuideStep {
  title: Record<Locale, string>;
  text: Record<Locale, string>;
  diagram?: string;
  action?: Action;
}
export interface GameDefinition<S extends GameState = any> {
  id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  category: "cards" | "puzzles" | "arcade" | "board" | "words";
  icon: string;
  version: number;
  options: Option[];
  defaults: Config;
  languages?: Locale[];
  playerCount?: (config: Config) => number;
  create: (
    config: Config,
    seed: number,
    signal?: AbortSignal,
  ) => S | Promise<S>;
  reducer: (state: S, action: Action, config: Config) => S;
  View: ComponentType<GameViewProps<S>>;
  guide: GuideStep[];
  getTurn?: (
    state: S,
    config: Config,
  ) => { player: number; bot: boolean; hidden: boolean } | null;
  bot?: (state: S, config: Config) => Action | Promise<Action | null> | null;
  summarize?: (state: S, config: Config) => Record<string, string | number>;
  migrate?: (state: any, fromVersion: number) => S;
}
export const tr = (locale: Locale, es: string, en: string) =>
  locale === "es" ? es : en;
export const labels = (es: string, en: string) => ({ es, en });
export const select = (
  key: string,
  es: string,
  en: string,
  entries: [string | number | boolean, string, string][],
  value: string | number | boolean,
  visibleWhen?: (config: Config) => boolean,
): Option => ({
  key,
  label: labels(es, en),
  values: entries.map(([value, es, en]) => ({ value, label: labels(es, en) })),
  default: value,
  visibleWhen,
});
export const difficulty = select(
  "difficulty",
  "Dificultad",
  "Difficulty",
  [
    ["easy", "Fácil", "Easy"],
    ["medium", "Media", "Medium"],
    ["hard", "Difícil", "Hard"],
  ],
  "medium",
);
export const baseState = (seed: number): GameState => ({
  rng: seed >>> 0 || 1,
  status: "playing",
  score: 0,
  moves: 0,
});
