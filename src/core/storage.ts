import { openDB, type IDBPDatabase } from "idb";
import type { Config, GameState, Locale } from "./types";
export interface Session {
  id: string;
  gameId: string;
  gameVersion: number;
  config: Config;
  locale: Locale;
  state: GameState;
  startedAt: string;
  updatedAt: string;
  elapsed: number;
  finishedAt?: string;
}
export interface Preferences {
  locale: Locale;
  theme: string;
  mode: "light" | "dark" | "system";
  favorites: string[];
  sound: boolean;
}
export interface SaveData {
  format: "timeout-save";
  version: 1;
  exportedAt?: string;
  preferences: Preferences;
  sessions: Session[];
  history: Session[];
}
export const emptyData = (): SaveData => ({
  format: "timeout-save",
  version: 1,
  preferences: {
    locale: "es",
    theme: "signal",
    mode: "system",
    favorites: [],
    sound: true,
  },
  sessions: [],
  history: [],
});
let db: IDBPDatabase | undefined;
let backend: "indexedDB" | "localStorage" | "memory" = "memory";
let memory: SaveData = emptyData();
let queue = Promise.resolve();
let original: unknown;
let initialization:
  Promise<{ data: SaveData; backend: string; warning?: string }> | undefined;
export function initializeStorage() {
  return (initialization ??= loadStorage());
}
async function loadStorage(): Promise<{
  data: SaveData;
  backend: string;
  warning?: string;
}> {
  try {
    db = await openDB("timeout", 1, {
      upgrade(d) {
        d.createObjectStore("data");
        d.createObjectStore("backups", { autoIncrement: true });
      },
    });
    await db.put("data", "ok", "probe");
    if ((await db.get("data", "probe")) !== "ok") throw Error("readback");
    backend = "indexedDB";
  } catch {
    db?.close();
    db = undefined;
  }
  if (db) {
    const raw = await db.get("data", "main");
    try {
      return { data: raw ? validateSave(raw) : emptyData(), backend };
    } catch {
      original = raw;
      await db.add("backups", {
        createdAt: new Date().toISOString(),
        data: raw,
      });
      return { data: emptyData(), backend, warning: "corrupt" };
    }
  }
  try {
    localStorage.setItem("timeout-probe", "ok");
    if (localStorage.getItem("timeout-probe") !== "ok") throw Error("readback");
    localStorage.removeItem("timeout-probe");
    backend = "localStorage";
  } catch {
    backend = "memory";
    return { data: memory, backend, warning: "memory" };
  }
  const raw = localStorage.getItem("timeout-save");
  try {
    return {
      data: raw ? validateSave(JSON.parse(raw)) : emptyData(),
      backend,
      warning: "localStorage",
    };
  } catch {
    original = raw;
    localStorage.setItem("timeout-original", raw || "");
    return { data: emptyData(), backend, warning: "corrupt" };
  }
}
export function exportOriginalData() {
  if (original !== undefined) downloadJson(original as SaveData);
}
export function writeData(data: SaveData): Promise<void> {
  const snapshot = structuredClone(data);
  memory = snapshot;
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (backend === "indexedDB") await db!.put("data", snapshot, "main");
      else if (backend === "localStorage")
        localStorage.setItem("timeout-save", JSON.stringify(snapshot));
      else throw Error("No persistent storage");
    });
  queue = task;
  return task;
}
export async function backupData(data: SaveData) {
  const snapshot = structuredClone(data);
  if (db)
    await db.add("backups", {
      createdAt: new Date().toISOString(),
      data: snapshot,
    });
  else if (backend === "localStorage")
    localStorage.setItem("timeout-backup", JSON.stringify(snapshot));
}
export async function lastBackup(): Promise<SaveData | null> {
  if (db) {
    const tx = db.transaction("backups");
    const cursor = await tx.store.openCursor(null, "prev");
    return cursor?.value?.data ? validateSave(cursor.value.data) : null;
  }
  const raw = localStorage.getItem("timeout-backup");
  return raw ? validateSave(JSON.parse(raw)) : null;
}
function object(x: unknown): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function finiteTree(value: any, depth = 0): void {
  if (depth > 70) throw Error("Nested save too deep");
  if (typeof value === "number" && !Number.isFinite(value))
    throw Error("Invalid number");
  if (Array.isArray(value)) {
    if (value.length > 200000) throw Error("Save array too large");
    value.forEach((v) => finiteTree(v, depth + 1));
  } else if (object(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(k))
        throw Error("Invalid key");
      finiteTree(v, depth + 1);
    }
  } else if (
    !["string", "number", "boolean", "undefined"].includes(typeof value) &&
    value !== null
  )
    throw Error("Invalid value");
}
export function validateSave(raw: any): SaveData {
  if (!object(raw) || raw.format !== "timeout-save" || raw.version !== 1)
    throw Error("Unsupported save format/version");
  finiteTree(raw);
  if (
    !object(raw.preferences) ||
    !["es", "en"].includes(raw.preferences.locale) ||
    !["light", "dark", "system"].includes(raw.preferences.mode) ||
    typeof raw.preferences.theme !== "string" ||
    typeof raw.preferences.sound !== "boolean" ||
    !Array.isArray(raw.preferences.favorites) ||
    raw.preferences.favorites.some((v: any) => typeof v !== "string")
  )
    throw Error("Invalid preferences");
  if (
    !Array.isArray(raw.sessions) ||
    !Array.isArray(raw.history) ||
    raw.sessions.length + raw.history.length > 100000
  )
    throw Error("Invalid sessions");
  const ids = new Set<string>();
  for (const s of [...raw.sessions, ...raw.history]) {
    if (
      !object(s) ||
      typeof s.id !== "string" ||
      ids.has(s.id) ||
      typeof s.gameId !== "string" ||
      !Number.isInteger(s.gameVersion) ||
      !["es", "en"].includes(s.locale) ||
      !object(s.config) ||
      !object(s.state) ||
      !["playing", "won", "lost", "draw"].includes(s.state.status) ||
      !Number.isFinite(s.state.rng) ||
      !Number.isFinite(s.state.score) ||
      !Number.isFinite(s.state.moves) ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      !Number.isFinite(Date.parse(s.startedAt)) ||
      !Number.isFinite(Date.parse(s.updatedAt))
    )
      throw Error("Invalid or duplicate session");
    if (
      Object.values(s.config).some(
        (v) => !["string", "number", "boolean"].includes(typeof v),
      )
    )
      throw Error("Invalid config");
    ids.add(s.id);
  }
  for (const s of raw.sessions)
    if (s.finishedAt || s.state.status !== "playing")
      throw Error("Invalid unfinished session");
  for (const s of raw.history)
    if (
      !Number.isFinite(Date.parse(s.finishedAt)) ||
      s.state.status === "playing"
    )
      throw Error("Invalid history result");
  return structuredClone(raw) as SaveData;
}
export function conflicts(local: SaveData, incoming: SaveData): number {
  const records = new Map(
    [...local.sessions, ...local.history].map((s) => [s.id, s]),
  );
  return [...incoming.sessions, ...incoming.history].filter(
    (s) =>
      records.has(s.id) &&
      JSON.stringify(records.get(s.id)) !== JSON.stringify(s),
  ).length;
}
export function mergeData(
  local: SaveData,
  incoming: SaveData,
  preferIncoming = false,
): SaveData {
  const all = new Map(
    [...local.sessions, ...local.history].map((s) => [s.id, s]),
  );
  for (const s of [...incoming.sessions, ...incoming.history])
    if (!all.has(s.id) || preferIncoming) all.set(s.id, s);
  const list = [...all.values()];
  return {
    ...local,
    sessions: list.filter((s) => !s.finishedAt),
    history: list.filter((s) => !!s.finishedAt),
  };
}
export function downloadJson(data: SaveData) {
  const blob = new Blob(
    [
      JSON.stringify(
        { ...data, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timeout-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
