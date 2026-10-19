export interface ThemeDefinition {
  id: string;
  name: string;
  /** Soda accent name, applied as data-accent on the root element. */
  accent: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}
const shared = {
  "font-body": "'DM Sans', system-ui, sans-serif",
  "font-display": "'Cal Sans', 'DM Sans', system-ui, sans-serif",
  "font-mono": "'DM Mono', ui-monospace, monospace",
  radius: "20px",
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
    name: "Soda · Uva",
    accent: "grape",
    light: {
      ...shared,
      bg: "#ebedf1",
      surface: "#fbfcfd",
      raised: "#f0f1f6",
      text: "#202128",
      muted: "#4c4c54",
      border: "#d6d7dd",
      accent: "#853fd8",
      "on-accent": "#fff",
    },
    dark: {
      ...shared,
      bg: "#0f0f16",
      surface: "#17181e",
      raised: "#202128",
      text: "#f4f3f7",
      muted: "#c5c2cb",
      border: "#34353d",
      accent: "#a76ef8",
      "on-accent": "#fff",
    },
  },
  {
    id: "phosphor",
    name: "Soda · Menta",
    accent: "mint",
    light: {
      ...shared,
      bg: "#ebedf1",
      surface: "#fbfcfd",
      raised: "#f0f1f6",
      text: "#202128",
      muted: "#4c4c54",
      border: "#d6d7dd",
      accent: "#00924c",
      "on-accent": "#fff",
    },
    dark: {
      ...shared,
      bg: "#0f0f16",
      surface: "#17181e",
      raised: "#202128",
      text: "#f4f3f7",
      muted: "#c5c2cb",
      border: "#34353d",
      accent: "#00b672",
      "on-accent": "#fff",
    },
  },
  {
    id: "sky",
    name: "Soda · Cielo",
    accent: "sky",
    light: {
      ...shared,
      bg: "#ebedf1",
      surface: "#fbfcfd",
      raised: "#f0f1f6",
      text: "#202128",
      muted: "#4c4c54",
      border: "#d6d7dd",
      accent: "#0078d9",
      "on-accent": "#fff",
    },
    dark: {
      ...shared,
      bg: "#0f0f16",
      surface: "#17181e",
      raised: "#202128",
      text: "#f4f3f7",
      muted: "#c5c2cb",
      border: "#34353d",
      accent: "#00a0f9",
      "on-accent": "#fff",
    },
  },
  {
    id: "coral",
    name: "Soda · Coral",
    accent: "coral",
    light: {
      ...shared,
      bg: "#ebedf1",
      surface: "#fbfcfd",
      raised: "#f0f1f6",
      text: "#202128",
      muted: "#4c4c54",
      border: "#d6d7dd",
      accent: "#d00021",
      "on-accent": "#fff",
    },
    dark: {
      ...shared,
      bg: "#0f0f16",
      surface: "#17181e",
      raised: "#202128",
      text: "#f4f3f7",
      muted: "#c5c2cb",
      border: "#34353d",
      accent: "#f4514f",
      "on-accent": "#fff",
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
  const root = document.documentElement;
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.accent = theme.accent;
  root.dataset.surface = "web";
}
