export interface ThemeDefinition {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}
const shared = {
  "font-body": "'IBM Plex Sans', sans-serif",
  "font-mono": "'IBM Plex Mono', monospace",
  radius: "14px",
  space: "8px",
  motion: "180ms",
  "card-face": "#faf7ef",
  "card-bg": "#faf7ef",
  "card-red": "#ba242e",
  "card-black": "#18191a",
  "card-back": "#ba242e",
  "card-border": "#777",
  "card-radius": "7px",
  "board-light": "#e9ddcb",
  "board-dark": "#68736b",
  tile: "#eee2be",
  "tile-bg": "#eee2be",
  felt: "#264c43",
  "piece-i": "#27a9bb",
  "piece-o": "#ddbc36",
  "piece-t": "#9370bc",
  "piece-s": "#4eac69",
  "piece-z": "#dc5961",
  "piece-j": "#567ccc",
  "piece-l": "#d79043",
  correct: "#26775c",
  present: "#936914",
  absent: "#65676b",
  "category-0": "#6ca4ce",
  "category-1": "#dca95b",
  "category-2": "#64a782",
  "category-3": "#bb87c8",
  "category-4": "#d7809b",
  "category-5": "#b29765",
};
export const themes: ThemeDefinition[] = [
  {
    id: "signal",
    name: "Signal",
    light: {
      ...shared,
      bg: "#f5f3ef",
      surface: "#ffffff",
      raised: "#ebe9e4",
      text: "#232427",
      muted: "#65656c",
      border: "#d8d7d2",
      accent: "#d82330",
      "on-accent": "#fff",
    },
    dark: {
      ...shared,
      bg: "#111315",
      surface: "#1b1d20",
      raised: "#272a2e",
      text: "#f0eee9",
      muted: "#aaaab0",
      border: "#35383c",
      accent: "#f45760",
      "on-accent": "#121314",
    },
  },
  {
    id: "phosphor",
    name: "Phosphor",
    light: {
      ...shared,
      bg: "#edf3e8",
      surface: "#f8fff2",
      raised: "#dfe9d7",
      text: "#163720",
      muted: "#46654d",
      border: "#b9cfb5",
      accent: "#28663b",
      "on-accent": "#fff",
      radius: "3px",
    },
    dark: {
      ...shared,
      bg: "#0b150e",
      surface: "#102019",
      raised: "#1b3324",
      text: "#b8edbf",
      muted: "#89b393",
      border: "#315b3d",
      accent: "#86db92",
      "on-accent": "#102019",
      radius: "3px",
    },
  },
];
let appliedKeys: string[] = [];
export function applyTheme(id: string, mode: string) {
  const theme = themes.find((t) => t.id === id) || themes[0];
  const dark =
    mode === "dark" ||
    (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  for (const key of appliedKeys)
    document.documentElement.style.removeProperty(`--${key}`);
  const tokens = { ...shared, ...(dark ? theme.dark : theme.light) };
  appliedKeys = Object.keys(tokens);
  for (const [key, value] of Object.entries(tokens))
    document.documentElement.style.setProperty(`--${key}`, value);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
