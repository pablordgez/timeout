import {
  Component,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { games, gameById } from "../core/registry";
import { applyTheme, themes } from "../core/themes";
import {
  initializeStorage,
  exportOriginalData,
  writeData,
  emptyData,
  downloadJson,
  validateSave,
  mergeData,
  conflicts,
  backupData,
  lastBackup,
  type SaveData,
  type Session,
} from "../core/storage";
import {
  labels,
  tr,
  select,
  type Locale,
  type GameDefinition,
  type Config,
  type Action,
} from "../core/types";
import { seedNow } from "../core/random";
import { loadLexicon } from "../core/lexicon";
import gpl from "../../LICENSE?raw";
import { validateGameSession } from "../core/save-validation";
import {
  setSoundEnabled,
  unlockAudio,
  playSound,
  soundForTransition,
} from "../core/audio";
import {
  configDescription,
  metricLabel,
  resultLabels,
  variantKey,
  localizedMessage,
} from "./format";

const categories = {
  all: labels("Todos", "All"),
  cards: labels("Cartas", "Cards"),
  puzzles: labels("Lógica", "Puzzles"),
  arcade: labels("Arcade", "Arcade"),
  board: labels("Tablero", "Board"),
  words: labels("Palabras", "Words"),
};
const languageOption = select(
  "language",
  "Idioma de juego",
  "Game language",
  [
    ["es", "Español", "Spanish"],
    ["en", "Inglés", "English"],
  ],
  "es",
);
const languageGames = ["wordle", "ring", "letters", "crossword", "trivia"];
const timeText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

class GameBoundary extends Component<
  { children: ReactNode; onExit: () => void; locale: Locale },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state">
        <h2>
          {tr(
            this.props.locale,
            "No se pudo abrir esta partida",
            "This game could not be opened",
          )}
        </h2>
        <p>
          {tr(
            this.props.locale,
            "El guardado se conserva. Exporta tus datos desde Ajustes y usa una partida nueva.",
            "Your save is preserved. Export your data in Settings and start a new game.",
          )}
        </p>
        <button onClick={this.props.onExit}>
          {tr(this.props.locale, "Volver al catálogo", "Back to games")}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function App() {
  const [data, setData] = useState<SaveData>(emptyData),
    [ready, setReady] = useState(false),
    [storage, setStorage] = useState(""),
    [warning, setWarning] = useState(""),
    [tab, setTab] = useState("games"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [favoriteOnly, setFavoriteOnly] = useState(false),
    [setup, setSetup] = useState<GameDefinition | null>(null),
    [active, setActive] = useState<string | null>(null),
    [licenses, setLicenses] = useState(false),
    [offlineReady, setOfflineReady] = useState(false),
    [update, setUpdate] = useState<(() => void) | null>(null);
  const latest = useRef(data);
  const locale = data.preferences.locale;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [active, tab]);
  useEffect(() => {
    let live = true;
    initializeStorage()
      .then(async (result) => {
        if (!live) return;
        const needsMigration = [
          ...result.data.sessions,
          ...result.data.history,
        ].some((s) => {
          const g = gameById(s.gameId);
          return g && g.migrate && s.gameVersion < g.version;
        });
        if (needsMigration) {
          await backupData(result.data);
          const migrate = (s: Session): Session => {
            const g = gameById(s.gameId);
            if (!g?.migrate || s.gameVersion >= g.version) return s;
            return {
              ...s,
              state: g.migrate(s.state, s.gameVersion),
              gameVersion: g.version,
            };
          };
          result.data = {
            ...result.data,
            sessions: result.data.sessions.map(migrate),
            history: result.data.history.map(migrate),
          };
          await writeData(result.data);
        }
        for (const lang of new Set(
          result.data.sessions
            .filter(
              (s) => languageGames.includes(s.gameId) && s.gameId !== "trivia",
            )
            .map((s) => (s.config.language === "en" ? "en" : "es")),
        ))
          await loadLexicon(lang);
        if (live) {
          latest.current = result.data;
          setData(result.data);
          setStorage(result.backend);
          setWarning(result.warning || "");
          setReady(true);
        }
      })
      .catch(() => {
        if (live) {
          setReady(true);
          setWarning("load");
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    applyTheme(data.preferences.theme, data.preferences.mode);
    document.documentElement.lang = locale;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme(data.preferences.theme, data.preferences.mode);
    media.addEventListener("change", fn);
    return () => media.removeEventListener("change", fn);
  }, [data.preferences.theme, data.preferences.mode, locale]);
  useEffect(() => {
    if (import.meta.env.MODE === "portable") return;
    let live = true;
    import("virtual:pwa-register").then(({ registerSW }) => {
      const apply = registerSW({
        immediate: true,
        onOfflineReady() {
          if (live) setOfflineReady(true);
        },
        onNeedRefresh() {
          if (live) setUpdate(() => () => apply(true));
        },
        onRegisterError() {
          if (live) setWarning("offline");
        },
      });
      if (navigator.serviceWorker?.controller) setOfflineReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!setup && !licenses) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    dialog?.querySelector<HTMLElement>("select,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSetup(null);
        setLicenses(false);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1)!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [setup, licenses]);
  useEffect(() => {
    setSoundEnabled(data.preferences.sound);
  }, [data.preferences.sound]);
  useEffect(() => {
    const activate = () => {
      void unlockAudio();
    };
    window.addEventListener("pointerdown", activate, { capture: true });
    window.addEventListener("keydown", activate, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", activate, { capture: true });
      window.removeEventListener("keydown", activate, { capture: true });
    };
  }, []);
  const persist = useCallback((next: SaveData) => {
    latest.current = next;
    setData(next);
    writeData(next).catch(() => setWarning("write"));
  }, []);
  const changePreferences = async (
    change: Partial<SaveData["preferences"]>,
  ) => {
    const next = {
      ...latest.current,
      preferences: { ...latest.current.preferences, ...change },
    };
    latest.current = next;
    try {
      await writeData(next);
    } catch {
      setWarning("write");
    }
    setData(latest.current);
  };
  const updateSession = useCallback(
    (session: Session) => {
      const current = latest.current;
      if (session.finishedAt) {
        persist({
          ...current,
          sessions: current.sessions.filter((s) => s.id !== session.id),
          history: [
            session,
            ...current.history.filter((s) => s.id !== session.id),
          ],
        });
      } else
        persist({
          ...current,
          sessions: current.sessions.map((s) =>
            s.id === session.id ? session : s,
          ),
        });
    },
    [persist],
  );
  const start = async (
    game: GameDefinition,
    config: Config,
    signal?: AbortSignal,
  ) => {
    const state = await game.create(config, seedNow(), signal);
    if (signal?.aborted) return;
    const now = new Date().toISOString();
    const session: Session = {
      id: crypto.randomUUID(),
      gameId: game.id,
      gameVersion: game.version,
      config,
      locale,
      state,
      startedAt: now,
      updatedAt: now,
      elapsed: 0,
    };
    persist({
      ...latest.current,
      sessions: [session, ...latest.current.sessions],
    });
    setSetup(null);
    setActive(session.id);
  };
  const current = [...data.sessions, ...data.history].find(
      (s) => s.id === active,
    ),
    game = current ? gameById(current.gameId) : undefined;
  const shown = games.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      (!favoriteOnly || data.preferences.favorites.includes(g.id)) &&
      (g.name[locale] + " " + g.description[locale])
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (!ready)
    return (
      <div className="boot">
        <span className="brand-mark">Ⅱ</span>
        <p>
          TIMEOUT <span className="dots">···</span>
        </p>
      </div>
    );
  return (
    <>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActive(null);
            setTab("games");
          }}
        >
          <span className="brand-mark">Ⅱ</span>
          <span>
            timeout<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="sidebar-tag">
          {tr(locale, "TU MOMENTO DE PAUSA", "YOUR MOMENT OF PAUSE")}
        </p>
        <nav>
          {[
            ["games", "▦", tr(locale, "Colección", "Collection")],
            ["saved", "◷", tr(locale, "Continuar", "Continue")],
            ["stats", "↗", tr(locale, "Estadísticas", "Statistics")],
            ["settings", "⊙", tr(locale, "Ajustes", "Settings")],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id && !active ? "active" : ""}
              onClick={() => {
                setActive(null);
                setTab(id);
              }}
            >
              <span>{icon}</span>
              {label}
              {id === "saved" && data.sessions.length ? (
                <small>{data.sessions.length}</small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span
            className={
              "connection-dot " +
              (offlineReady || import.meta.env.MODE === "portable"
                ? "ready"
                : "")
            }
          />
          {import.meta.env.MODE === "portable"
            ? tr(locale, "Edición portable", "Portable edition")
            : offlineReady
              ? tr(locale, "Disponible sin conexión", "Available offline")
              : tr(locale, "Preparando modo offline", "Preparing offline mode")}
          <button className="text-button" onClick={() => setLicenses(true)}>
            {tr(locale, "Licencias y fuentes", "Licenses & sources")}
          </button>
          <small>
            v{__APP_VERSION__} · {storage}
          </small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="eyebrow">
            {tr(locale, "UN RATO PARA TI", "A LITTLE TIME FOR YOU")}
          </span>
          <div>
            <button
              className="sound-toggle text-button"
              aria-label={tr(
                locale,
                data.preferences.sound
                  ? "Silenciar efectos"
                  : "Activar efectos",
                data.preferences.sound ? "Mute sounds" : "Enable sounds",
              )}
              aria-pressed={data.preferences.sound}
              onClick={() =>
                changePreferences({ sound: !data.preferences.sound })
              }
            >
              {data.preferences.sound ? "♪" : "♩"}
            </button>
            <button
              className="text-button"
              aria-label="Change language / Cambiar idioma"
              onClick={() =>
                changePreferences({ locale: locale === "es" ? "en" : "es" })
              }
            >
              {locale === "es" ? "ES / en" : "es / EN"}
            </button>
            <button
              className="theme-toggle"
              aria-label={tr(
                locale,
                "Cambiar modo de color",
                "Switch color mode",
              )}
              onClick={() =>
                changePreferences({
                  mode:
                    document.documentElement.style.colorScheme === "dark"
                      ? "light"
                      : "dark",
                })
              }
            >
              ◐
            </button>
          </div>
        </header>
        {warning ? (
          <div className="notice" role="status">
            {warning === "corrupt" ? (
              <>
                {tr(
                  locale,
                  "El guardado existente no se puede leer. Se conserva una copia del original para recuperarlo.",
                  "The existing save could not be read. An original copy has been preserved for recovery.",
                )}{" "}
                <button onClick={exportOriginalData}>
                  {tr(locale, "Exportar original", "Export original")}
                </button>
              </>
            ) : warning === "memory" ||
              warning === "write" ||
              warning === "load" ? (
              tr(
                locale,
                "El navegador no puede garantizar el guardado. Exporta tus datos antes de cerrar.",
                "The browser cannot guarantee saving. Export your data before closing.",
              )
            ) : warning === "offline" ? (
              tr(
                locale,
                "No se pudo preparar la caché offline. El HTML portable funciona sin red.",
                "Offline cache could not be prepared. Portable HTML works without a network.",
              )
            ) : (
              tr(
                locale,
                "Guardado alternativo activo. Exporta una copia si mueves el archivo portable.",
                "Fallback storage is active. Export a copy if you move the portable file.",
              )
            )}
          </div>
        ) : null}
        {update ? (
          <div className="notice">
            {tr(
              locale,
              "Hay una actualización disponible. Guarda y vuelve al catálogo para aplicarla.",
              "An update is available. Save and return to the catalog to apply it.",
            )}
            <button disabled={!!active} onClick={update}>
              {tr(locale, "Actualizar", "Update")}
            </button>
          </div>
        ) : null}
        {current && game ? (
          <GameBoundary
            key={current.id}
            onExit={() => setActive(null)}
            locale={locale}
          >
            <Play
              game={game}
              session={current}
              locale={locale}
              onSave={updateSession}
              onExit={() => setActive(null)}
              onNew={() => setSetup(game)}
            />
          </GameBoundary>
        ) : tab === "games" ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">PLAY. PAUSE. REPEAT.</p>
                <h1>
                  {tr(locale, "Baja el ritmo.", "Slow down.")}
                  <br />
                  <span>
                    {tr(locale, "Sube la partida.", "Play a little.")}
                  </span>
                </h1>
                <p>
                  {tr(
                    locale,
                    "Pequeños juegos para grandes pausas. Sin prisas, sin cuentas. Solo tú y el siguiente movimiento.",
                    "Small games for bigger breaks. No rush, no accounts. Just you and the next move.",
                  )}
                </p>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="pixel-orbit">
                  {Array.from({ length: 64 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        opacity: [
                          0, 1, 7, 8, 10, 13, 15, 16, 19, 20, 23, 25, 27, 28,
                          30, 31, 32, 33, 35, 36, 38, 40, 43, 44, 47, 48, 50,
                          53, 55, 56, 57, 63,
                        ].includes(i)
                          ? 1
                          : 0.12,
                      }}
                    />
                  ))}
                </div>
                <span>INSERT A LITTLE TIME</span>
              </div>
            </section>
            <section className="catalog-head">
              <div>
                <h2>{tr(locale, "Elige tu pausa", "Choose your pause")}</h2>
                <span className="muted">
                  {games.length}{" "}
                  {tr(locale, "juegos, cero prisa", "games, zero rush")}
                </span>
              </div>
              <input
                aria-label={tr(locale, "Buscar juegos", "Search games")}
                placeholder={tr(locale, "Buscar un juego…", "Find a game…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </section>
            <div className="filters">
              {Object.entries(categories).map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                >
                  {name[locale]}
                </button>
              ))}
              <button
                aria-pressed={favoriteOnly}
                onClick={() => setFavoriteOnly(!favoriteOnly)}
              >
                ♡ {tr(locale, "Favoritos", "Favorites")}
              </button>
            </div>
            <div className="game-grid">
              {shown.map((g, i) => {
                const saved = data.sessions.filter(
                  (s) => s.gameId === g.id,
                ).length;
                return (
                  <article
                    className="game-card"
                    key={g.id}
                    style={{ animationDelay: Math.min(i, 10) * 25 + "ms" }}
                  >
                    <div className="game-card-top">
                      <span className="game-icon">{g.icon}</span>
                      <button
                        className="favorite-button"
                        aria-label={
                          tr(locale, "Favorito", "Favorite") +
                          " " +
                          g.name[locale]
                        }
                        aria-pressed={data.preferences.favorites.includes(g.id)}
                        onClick={() =>
                          changePreferences({
                            favorites: data.preferences.favorites.includes(g.id)
                              ? data.preferences.favorites.filter(
                                  (id) => id !== g.id,
                                )
                              : [...data.preferences.favorites, g.id],
                          })
                        }
                      >
                        {data.preferences.favorites.includes(g.id) ? "♥" : "♡"}
                      </button>
                    </div>
                    <p className="eyebrow">{categories[g.category][locale]}</p>
                    <h3>{g.name[locale]}</h3>
                    <p>{g.description[locale]}</p>
                    <footer>
                      <button className="play-link" onClick={() => setSetup(g)}>
                        {tr(locale, "Jugar", "Play")} <span>↗</span>
                      </button>
                      {saved ? (
                        <button
                          className="text-button"
                          onClick={() => {
                            setActive(
                              data.sessions.find((s) => s.gameId === g.id)!.id,
                            );
                          }}
                        >
                          {saved} {tr(locale, "pendiente", "saved")}
                        </button>
                      ) : (
                        <span className="micro-label">OFFLINE READY</span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
            {!shown.length ? (
              <p className="empty-state">
                {tr(
                  locale,
                  "No hay juegos con ese filtro.",
                  "No games match this filter.",
                )}
              </p>
            ) : null}
            <footer className="page-footer">
              {tr(
                locale,
                "Hecho para desconectar. Todo se queda en tu dispositivo.",
                "Made to disconnect. Everything stays on your device.",
              )}
              <span>TIMEOUT / LOCAL FIRST</span>
            </footer>
          </>
        ) : tab === "saved" ? (
          <>
            <PageTitle
              title={tr(locale, "Tu próxima jugada", "Your next move")}
              subtitle={tr(
                locale,
                "Las partidas que te esperan.",
                "Games waiting for you.",
              )}
            />
            {data.sessions.length ? (
              data.sessions.map((s) => (
                <div key={s.id} className="saved-row">
                  <span className="game-icon">
                    {gameById(s.gameId)?.icon || "?"}
                  </span>
                  <div>
                    <h3>{gameById(s.gameId)?.name[locale] || s.gameId}</h3>
                    <p>
                      {new Date(s.updatedAt).toLocaleString(locale)} ·{" "}
                      {timeText(s.elapsed)} ·{" "}
                      {configDescription(gameById(s.gameId), s.config, locale)}
                    </p>
                  </div>
                  <button onClick={() => setActive(s.id)}>
                    {tr(locale, "Continuar", "Continue")}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          tr(
                            locale,
                            "¿Eliminar esta partida pendiente?",
                            "Delete this unfinished game?",
                          ),
                        )
                      )
                        persist({
                          ...latest.current,
                          sessions: latest.current.sessions.filter(
                            (v) => v.id !== s.id,
                          ),
                        });
                    }}
                  >
                    {tr(locale, "Eliminar", "Delete")}
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                {tr(
                  locale,
                  "Todavía no hay partidas pendientes. Elige un juego y empieza.",
                  "No unfinished games yet. Choose a game to begin.",
                )}
              </div>
            )}
          </>
        ) : tab === "stats" ? (
          <Stats data={data} locale={locale} />
        ) : (
          <Settings
            data={data}
            locale={locale}
            onPreferences={changePreferences}
            onImport={async (next) => {
              await writeData(next);
              latest.current = next;
              setData(next);
            }}
            onWarning={setWarning}
          />
        )}
      </main>
      {setup ? (
        <Setup
          game={setup}
          locale={locale}
          onClose={() => setSetup(null)}
          onStart={start}
        />
      ) : null}
      {licenses ? (
        <div className="modal-backdrop">
          <section
            className="modal licenses"
            role="dialog"
            aria-modal="true"
            aria-labelledby="licenses-title"
          >
            <button
              className="modal-close"
              onClick={() => setLicenses(false)}
              aria-label={tr(locale, "Cerrar", "Close")}
            >
              ×
            </button>
            <p className="eyebrow">OPEN BY DESIGN</p>
            <h2 id="licenses-title">
              {tr(locale, "Licencias y fuentes", "Licenses & sources")}
            </h2>
            <p>
              {tr(
                locale,
                "Timeout y Stockfish: GPLv3. Se permite uso comercial respetando la licencia. El código fuente correspondiente acompaña cada entrega.",
                "Timeout and Stockfish: GPLv3. Commercial use is permitted under the license. Corresponding source accompanies each release.",
              )}
            </p>
            <p>
              {tr(
                locale,
                "Palabras y definiciones: colaboradores de Wikcionario/Wiktionary, extracción Kaikki/Wiktextract. Filtrado y compactado; CC BY-SA 4.0. Cada término procede del artículo del mismo nombre.",
                "Words and definitions: Wiktionary contributors, extraction by Kaikki/Wiktextract. Filtered and compacted; CC BY-SA 4.0. Each entry comes from its article of the same name.",
              )}
            </p>
            <p>
              {tr(
                locale,
                "Preguntas inglesas: Open Trivia DB, adaptadas a respuesta abierta. Preguntas españolas: contenido original de Timeout. Ambos paquetes: CC BY-SA 4.0.",
                "English questions: Open Trivia DB, adapted to open answers. Spanish questions: original Timeout content. Both datasets: CC BY-SA 4.0.",
              )}
            </p>
            <div className="controls">
              <a href="https://kaikki.org/" target="_blank" rel="noreferrer">
                Kaikki
              </a>
              <a href="https://opentdb.com/" target="_blank" rel="noreferrer">
                Open Trivia DB
              </a>
              <a
                href="https://github.com/nmrugg/stockfish.js"
                target="_blank"
                rel="noreferrer"
              >
                Stockfish
              </a>
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 4.0
              </a>
            </div>
            <details>
              <summary>GNU GPL v3</summary>
              <pre>{gpl}</pre>
            </details>
          </section>
        </div>
      ) : null}
    </>
  );
}
function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-title">
      <p className="eyebrow">TIMEOUT / YOUR SPACE</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
function Setup({
  game,
  locale,
  onClose,
  onStart,
}: {
  game: GameDefinition;
  locale: Locale;
  onClose: () => void;
  onStart: (
    g: GameDefinition,
    cfg: Config,
    signal?: AbortSignal,
  ) => Promise<void>;
}) {
  const [config, setConfig] = useState<Config>({
      ...game.defaults,
      language: game.languages?.length === 1 ? game.languages[0] : locale,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showGuide, setShowGuide] = useState(false);
  const creation = useRef<AbortController | null>(null);
  useEffect(() => () => creation.current?.abort(), []);
  const options = [
    ...game.options,
    ...(languageGames.includes(game.id) &&
    !game.options.some((o) => o.key === "language")
      ? [languageOption]
      : []),
  ];
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={tr(locale, "Cerrar", "Close")}
        >
          ×
        </button>
        <p className="eyebrow">{categories[game.category][locale]}</p>
        <h2 id="setup-title">{game.name[locale]}</h2>
        <p className="muted">{game.description[locale]}</p>
        {options
          .filter((o) => !o.visibleWhen || o.visibleWhen(config))
          .map((o) => (
            <label className="setting" key={o.key}>
              <span>{o.label[locale]}</span>
              <select
                value={String(config[o.key] ?? o.default)}
                onChange={(e) => {
                  const value = o.values.find(
                    (v) => String(v.value) === e.target.value,
                  )!.value;
                  setConfig((c) => {
                    const next = { ...c, [o.key]: value };
                    const players =
                      game.playerCount?.(next) ?? Number(next.players || 2);
                    if (next.humans)
                      next.humans = Math.min(Number(next.humans), players);
                    return next;
                  });
                }}
              >
                {o.values
                  .filter(
                    (v) =>
                      o.key !== "humans" ||
                      Number(v.value) <=
                        (game.playerCount?.(config) ??
                          Number(config.players || 2)),
                  )
                  .map((v) => (
                    <option key={String(v.value)} value={String(v.value)}>
                      {v.label[locale]}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        {config.humans &&
        config.players &&
        Number(config.humans) >
          (game.playerCount?.(config) ?? Number(config.players || 2)) ? (
          <p className="notice">
            {tr(
              locale,
              "Las personas no pueden superar los participantes.",
              "Humans cannot outnumber participants.",
            )}
          </p>
        ) : null}
        {game.languages && !game.languages.includes(locale) ? (
          <p className="notice">
            {tr(
              locale,
              "Este juego está disponible en otro idioma. Puedes jugar igualmente.",
              "This game is available in another language. You can still play.",
            )}
          </p>
        ) : null}
        <p className="muted small">
          {tr(
            locale,
            "Se guardará automáticamente en este dispositivo.",
            "Automatically saved on this device.",
          )}
        </p>
        <div className="controls">
          <button
            className="primary"
            disabled={busy || Number(config.humans) > Number(config.players)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                creation.current = new AbortController();
                await onStart(game, config, creation.current.signal);
              } catch (e) {
                setError(String(e));
                setBusy(false);
              }
            }}
          >
            {busy
              ? tr(locale, "Preparando…", "Preparing…")
              : tr(locale, "Empezar partida", "Start game")}{" "}
            →
          </button>
          <button onClick={() => setShowGuide(!showGuide)}>
            {tr(locale, "Cómo se juega", "How to play")}
          </button>
        </div>
        {error ? (
          <p role="alert" className="notice">
            {error}
          </p>
        ) : null}
        {showGuide ? <Guide game={game} locale={locale} /> : null}
      </section>
    </div>
  );
}

function Play({
  game,
  session,
  locale,
  onSave,
  onExit,
  onNew,
}: {
  game: GameDefinition;
  session: Session;
  locale: Locale;
  onSave: (s: Session) => void;
  onExit: () => void;
  onNew: () => void;
}) {
  const [state, setState] = useState(() =>
      session.gameVersion === game.version
        ? session.state
        : game.migrate
          ? game.migrate(session.state, session.gameVersion)
          : session.state,
    ),
    [paused, setPaused] = useState(true),
    [guide, setGuide] = useState(false),
    [practice, setPractice] = useState<any>(null),
    [revealed, setRevealed] = useState<string | null>(null),
    [thinking, setThinking] = useState(false),
    [error, setError] = useState(""),
    [elapsed, setElapsed] = useState(session.elapsed);
  const stateRef = useRef(state),
    pausedRef = useRef(paused),
    elapsedRef = useRef(elapsed),
    finished = useRef(!!session.finishedAt),
    practiceRef = useRef(practice);
  stateRef.current = state;
  pausedRef.current = paused;
  practiceRef.current = practice;
  elapsedRef.current = elapsed;
  const turn = game.getTurn?.(state, session.config),
    turnKey = turn
      ? `${turn.player}:${state.round ?? state.handNumber ?? state.hand ?? ""}`
      : null;
  const hidden = !!turn?.hidden && !turn.bot && revealed !== turnKey;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const recorded = useRef(!!session.finishedAt);
  const save = useCallback(() => {
    if (practiceRef.current) return;
    const now = new Date().toISOString(),
      s = stateRef.current;
    const ended = s.status !== "playing";
    if (ended && recorded.current) return;
    const snapshot = {
      ...sessionRef.current,
      state: structuredClone(s),
      gameVersion: game.version,
      elapsed: elapsedRef.current,
      updatedAt: now,
      ...(ended ? { finishedAt: sessionRef.current.finishedAt || now } : {}),
    };
    if (ended) recorded.current = true;
    onSave(snapshot);
  }, [session.id, game.version, onSave]);
  const dispatch = useCallback(
    (action: Action) => {
      if (
        pausedRef.current &&
        !practiceRef.current &&
        action.type !== "RELEASE"
      )
        return;
      try {
        const old = stateRef.current;
        if (old.status !== "playing" && action.type !== "SELECT") return;
        const next = game.reducer(old, action, session.config);
        const cue = soundForTransition(game.id, old, next, action);
        if (cue) playSound(cue);
        if (next !== old) {
          stateRef.current = next;
          setState(next);
          if (
            !["TICK", "CLOCK", "POINTER_MOVE", "SELECT", "RELEASE"].includes(
              action.type,
            )
          )
            save();
        }
      } catch (e) {
        setError(String(e));
        setPaused(true);
      }
    },
    [game, session.config, save],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !pausedRef.current &&
        !practiceRef.current &&
        stateRef.current.status === "playing"
      ) {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        dispatch({ type: "CLOCK", dt: 1 });
      }
      if (!pausedRef.current) save();
    }, 1000);
    const visibility = () => {
        if (document.visibilityState === "hidden") {
          setPaused(true);
          save();
        }
      },
      blur = () => {
        setPaused(true);
        save();
      };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", blur);
    window.addEventListener("blur", blur);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", blur);
      window.removeEventListener("blur", blur);
      save();
    };
  }, [save, dispatch]);
  useEffect(() => {
    if (state.status !== "playing" && !finished.current && !practice) {
      finished.current = true;
      setPaused(true);
      save();
    }
  }, [state.status, practice, save]);
  useEffect(() => {
    if (
      !turn?.bot ||
      paused ||
      state.status !== "playing" ||
      practice ||
      !game.bot
    )
      return;
    let cancel = false;
    setThinking(true);
    const timer = setTimeout(() => {
      Promise.resolve(game.bot!(stateRef.current, session.config))
        .then((action) => {
          if (!cancel && action) dispatch(action);
        })
        .catch((e) => {
          if (!cancel) {
            setError(String(e));
            setPaused(true);
          }
        })
        .finally(() => {
          if (!cancel) setThinking(false);
        });
    }, 500);
    return () => {
      cancel = true;
      clearTimeout(timer);
      setThinking(false);
    };
  }, [
    turn?.player,
    turn?.bot,
    state.moves,
    state.phase,
    state.stage,
    state.status,
    paused,
    practice,
    dispatch,
    game,
    session.config,
  ]);
  const startPractice = async () => {
    try {
      const demo = await game.create(session.config, 42);
      setPractice({ state: stateRef.current, elapsed: elapsedRef.current });
      stateRef.current = demo;
      setState(demo);
      setPaused(false);
      setRevealed(null);
    } catch (e) {
      setError(String(e));
    }
  };
  const endPractice = () => {
    if (practice) {
      practiceRef.current = null;
      stateRef.current = practice.state;
      setState(practice.state);
      setElapsed(practice.elapsed);
      setPractice(null);
      setPaused(true);
    }
  };
  return (
    <section className="play-page">
      <div className="play-heading">
        <button
          className="text-button"
          onClick={() => {
            endPractice();
            save();
            onExit();
          }}
        >
          ← {tr(locale, "Colección", "Collection")}
        </button>
        <span className="eyebrow">
          {practice
            ? tr(locale, "PRÁCTICA · NO CUENTA", "PRACTICE · NOT RECORDED")
            : tr(locale, "GUARDADO AUTOMÁTICO", "AUTOSAVED")}
        </span>
      </div>
      <div className="play-title">
        <h1>{game.name[locale]}</h1>
        <div className="controls">
          <button
            onClick={() => {
              setPaused(true);
              setGuide(!guide);
            }}
          >
            {tr(locale, "Guía", "Guide")} ?
          </button>
          <button
            onClick={() => {
              setPaused((v) => !v);
              if (!paused) save();
            }}
            disabled={state.status !== "playing" && !practice}
          >
            {paused
              ? tr(locale, "Reanudar", "Resume")
              : tr(locale, "Pausa", "Pause")}{" "}
            Ⅱ
          </button>
          <button
            onClick={() => {
              setPaused(true);
              save();
              onNew();
            }}
          >
            {tr(locale, "Nueva", "New")} ↗
          </button>
        </div>
      </div>
      <div className="game-hud">
        <span>
          {tr(locale, "Puntuación", "Score")} <b>{state.score}</b>
        </span>
        <span>
          {tr(locale, "Tiempo", "Time")} <b>{timeText(elapsed)}</b>
        </span>
        <span>
          {tr(locale, "Movimientos", "Moves")} <b>{state.moves}</b>
        </span>
        {thinking ? (
          <span className="thinking">
            {tr(locale, "El bot está pensando…", "Bot is thinking…")}
          </span>
        ) : null}
      </div>
      {guide ? (
        <div className="guide-panel">
          <Guide
            game={game}
            locale={locale}
            dispatch={practice ? dispatch : undefined}
          />
          <div className="controls">
            <button onClick={practice ? endPractice : startPractice}>
              {practice
                ? tr(locale, "Terminar práctica", "End practice")
                : tr(locale, "Abrir práctica guiada", "Start guided practice")}
            </button>
            <button onClick={() => setGuide(false)}>
              {tr(locale, "Cerrar guía", "Close guide")}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
      {session.config.language && session.config.language !== locale ? (
        <p className="notice">
          {tr(
            locale,
            "Contenido de esta partida en inglés; la interfaz sigue en español.",
            "This game uses Spanish content; the interface remains English.",
          )}
        </p>
      ) : null}
      <div className="game-stage">
        {hidden ? (
          <div className="handoff">
            <span className="game-icon">▣</span>
            <h2>{tr(locale, "Pasa el dispositivo", "Pass the device")}</h2>
            <p>
              {tr(locale, "Turno del jugador", "Player")} {turn!.player + 1}.{" "}
              {tr(
                locale,
                "Las manos permanecen ocultas hasta continuar.",
                "Hands stay hidden until you continue.",
              )}
            </p>
            <button
              onClick={() => {
                setRevealed(turnKey);
                setPaused(false);
              }}
            >
              {tr(locale, "Estoy listo", "I am ready")}
            </button>
          </div>
        ) : (
          <>
            <game.View
              state={state}
              dispatch={dispatch}
              config={session.config}
              locale={locale}
              paused={paused}
            />
            {paused && state.status === "playing" && !guide ? (
              <div className="pause-overlay">
                <span>Ⅱ</span>
                <h2>{tr(locale, "Una pequeña pausa", "A little pause")}</h2>
                <button className="primary" onClick={() => setPaused(false)}>
                  {tr(locale, "Continuar", "Continue")} →
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      {state.message ? (
        <p className="game-message" role="status">
          {localizedMessage(state.message, locale)}
        </p>
      ) : null}
      {state.status !== "playing" ? (
        <div className="result">
          <h2>
            {state.status === "won"
              ? tr(locale, "Partida completada", "Game complete")
              : state.status === "draw"
                ? tr(locale, "Tablas", "Draw")
                : tr(locale, "Fin de partida", "Game over")}
          </h2>
          <p>
            {tr(
              locale,
              "Resultado registrado en tu historial.",
              "Result recorded in your history.",
            )}
          </p>
          <button onClick={onNew}>
            {tr(locale, "Otra partida", "Play again")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
function Guide({
  game,
  locale,
  dispatch,
}: {
  game: GameDefinition;
  locale: Locale;
  dispatch?: (a: Action) => void;
}) {
  const [step, setStep] = useState(0);
  const current = game.guide[step];
  return (
    <section className="guide">
      <div className="guide-tabs">
        {game.guide.map((g, i) => (
          <button key={i} aria-pressed={i === step} onClick={() => setStep(i)}>
            {i + 1}. {g.title[locale]}
          </button>
        ))}
      </div>
      <h3>{current.title[locale]}</h3>
      <p>{current.text[locale]}</p>
      {current.diagram ? (
        <pre className="guide-diagram">{current.diagram}</pre>
      ) : null}
      {current.action && dispatch ? (
        <button onClick={() => dispatch(current.action!)}>
          {tr(locale, "Probar este paso", "Try this step")} →
        </button>
      ) : null}
    </section>
  );
}
function Stats({ data, locale }: { data: SaveData; locale: Locale }) {
  const [filter, setFilter] = useState("all");
  const history = data.history.filter(
    (s) => filter === "all" || s.gameId === filter,
  );
  return (
    <>
      <PageTitle
        title={tr(locale, "Cada pausa cuenta", "Every break counts")}
        subtitle={tr(
          locale,
          "Tu historial vive aquí, en este dispositivo.",
          "Your history lives here, on this device.",
        )}
      />
      <div className="stat-grid">
        <div>
          <span>{tr(locale, "Partidas terminadas", "Finished games")}</span>
          <strong>{history.length}</strong>
        </div>
        <div>
          <span>{tr(locale, "Tiempo jugado", "Time played")}</span>
          <strong>
            {timeText(history.reduce((sum, s) => sum + s.elapsed, 0))}
          </strong>
        </div>
        <div>
          <span>{tr(locale, "Completadas / ganadas", "Completed / won")}</span>
          <strong>
            {history.filter((s) => s.state.status === "won").length}
          </strong>
        </div>
      </div>
      <label className="setting">
        <span>{tr(locale, "Juego", "Game")}</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{tr(locale, "Todos", "All")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name[locale]}
            </option>
          ))}
        </select>
      </label>
      <div className="game-statistics">
        {games
          .filter((g) => filter === "all" || filter === g.id)
          .map((g) => {
            const records = history.filter((s) => s.gameId === g.id);
            if (!records.length) return null;
            const variants = [
              ...new Set(records.map((s) => variantKey(s.config))),
            ];
            return (
              <article key={g.id}>
                <h3>{g.name[locale]}</h3>
                {variants.map((v) => {
                  const group = records.filter(
                    (s) => variantKey(s.config) === v,
                  );
                  return (
                    <p key={v}>
                      {configDescription(g, group[0].config, locale) ||
                        tr(locale, "General", "Standard")}
                      : {group.length} {tr(locale, "partidas", "games")} ·{" "}
                      {group.filter((s) => s.state.status === "won").length}{" "}
                      {tr(locale, "completadas / ganadas", "completed / won")} ·{" "}
                      {tr(locale, "Mejor", "Best")}:{" "}
                      {Math.max(...group.map((s) => s.state.score))} ·{" "}
                      {tr(locale, "Tiempo", "Time")}:{" "}
                      {timeText(group.reduce((t, s) => t + s.elapsed, 0))}
                    </p>
                  );
                })}
              </article>
            );
          })}
      </div>
      <h2>{tr(locale, "Resultados anteriores", "Past results")}</h2>
      {history.map((s) => (
        <details key={s.id} className="history-row">
          <summary>
            <span>{gameById(s.gameId)?.name[locale] || s.gameId}</span>
            <span>
              {s.state.score} pts · {timeText(s.elapsed)} ·{" "}
              {new Date(s.finishedAt || s.updatedAt).toLocaleDateString(locale)}
            </span>
          </summary>
          <p>
            {resultLabels[s.state.status][locale]} ·{" "}
            {configDescription(gameById(s.gameId), s.config, locale)}
          </p>
          <dl className="result-metrics">
            {Object.entries(
              gameById(s.gameId)?.summarize?.(s.state, s.config) || {},
            ).map(([key, value]) => (
              <div key={key}>
                <dt>{metricLabel(key, locale)}</dt>
                <dd>
                  {typeof value === "string"
                    ? localizedMessage(value, locale)
                    : value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      {!history.length ? (
        <p className="empty-state">
          {tr(
            locale,
            "Termina tu primera partida para ver resultados.",
            "Finish your first game to see results.",
          )}
        </p>
      ) : null}
    </>
  );
}
function Settings({
  data,
  locale,
  onPreferences,
  onImport,
  onWarning,
}: {
  data: SaveData;
  locale: Locale;
  onPreferences: (p: Partial<SaveData["preferences"]>) => void;
  onImport: (d: SaveData) => Promise<void>;
  onWarning: (s: string) => void;
}) {
  const [incoming, setIncoming] = useState<SaveData | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState("merge"),
    [prefer, setPrefer] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageTitle
        title={tr(locale, "A tu manera", "Make it yours")}
        subtitle={tr(
          locale,
          "Aspecto, idioma y datos. Todo bajo tu control.",
          "Appearance, language and data. All in your control.",
        )}
      />
      <section className="settings-card">
        <h2>{tr(locale, "Aspecto", "Appearance")}</h2>
        <label className="setting">
          <span>{tr(locale, "Tema", "Theme")}</span>
          <select
            value={data.preferences.theme}
            onChange={(e) => onPreferences({ theme: e.target.value })}
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>{tr(locale, "Modo", "Mode")}</span>
          <select
            value={data.preferences.mode}
            onChange={(e) => onPreferences({ mode: e.target.value as any })}
          >
            <option value="system">{tr(locale, "Sistema", "System")}</option>
            <option value="light">{tr(locale, "Claro", "Light")}</option>
            <option value="dark">{tr(locale, "Oscuro", "Dark")}</option>
          </select>
        </label>
        <label className="setting">
          <span>{tr(locale, "Idioma", "Language")}</span>
          <select
            value={locale}
            onChange={(e) =>
              onPreferences({ locale: e.target.value as Locale })
            }
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>
      <section className="settings-card">
        <h2>{tr(locale, "Sonido", "Sound")}</h2>
        <label className="setting">
          <span>{tr(locale, "Efectos de sonido", "Sound effects")}</span>
          <input
            type="checkbox"
            checked={data.preferences.sound}
            onChange={(e) => onPreferences({ sound: e.target.checked })}
          />
        </label>
        <p className="muted">
          {tr(
            locale,
            "Sonidos discretos generados en tu dispositivo. El navegador los activa tras tu primer toque.",
            "Subtle sounds generated on your device. Your browser activates them after your first interaction.",
          )}
        </p>
      </section>
      <section className="settings-card">
        <h2>{tr(locale, "Tus datos, contigo", "Take your data with you")}</h2>
        <p>
          {tr(
            locale,
            "Exporta ajustes, favoritos, historial y partidas pendientes. Importa la misma copia en la web o la edición portable.",
            "Export settings, favorites, history and unfinished games. Import the same backup in the web or portable edition.",
          )}
        </p>
        <div className="controls">
          <button onClick={() => downloadJson(data)}>
            {tr(locale, "Exportar todos los datos", "Export all data")} ↗
          </button>
          <button onClick={() => input.current?.click()}>
            {tr(locale, "Importar copia", "Import backup")} ↙
          </button>
          <button
            onClick={async () => {
              try {
                const backup = await lastBackup();
                if (!backup) {
                  setError(
                    tr(
                      locale,
                      "No hay una copia previa.",
                      "No earlier backup is available.",
                    ),
                  );
                  return;
                }
                setIncoming(backup);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            {tr(locale, "Recuperar copia anterior", "Recover previous backup")}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 100 * 1024 * 1024) throw Error("File too large");
              const imported = validateSave(JSON.parse(await file.text()));
              for (const s of [...imported.sessions, ...imported.history]) {
                const g = gameById(s.gameId);
                if (!g) throw Error("Unknown game: " + s.gameId);
                validateGameSession(s, g);
              }
              setIncoming(imported);
              setError("");
            } catch (e) {
              setError(String(e));
            } finally {
              e.target.value = "";
            }
          }}
        />
        {incoming ? (
          <div className="import-preview">
            <h3>{tr(locale, "Vista previa", "Preview")}</h3>
            <p>
              {incoming.sessions.length}{" "}
              {tr(locale, "pendientes", "unfinished")} ·{" "}
              {incoming.history.length} {tr(locale, "resultados", "results")} ·{" "}
              {conflicts(data, incoming)}{" "}
              {tr(locale, "conflictos", "conflicts")}
            </p>
            <label className="setting">
              <span>{tr(locale, "Modo de importación", "Import mode")}</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="merge">
                  {tr(
                    locale,
                    "Combinar y evitar duplicados",
                    "Merge without duplicates",
                  )}
                </option>
                <option value="replace">
                  {tr(locale, "Reemplazar todos los datos", "Replace all data")}
                </option>
              </select>
            </label>
            {mode === "merge" && conflicts(data, incoming) ? (
              <label className="setting">
                <span>{tr(locale, "En conflictos", "On conflicts")}</span>
                <select
                  value={prefer ? "incoming" : "local"}
                  onChange={(e) => setPrefer(e.target.value === "incoming")}
                >
                  <option value="local">
                    {tr(
                      locale,
                      "Conservar datos actuales",
                      "Keep current data",
                    )}
                  </option>
                  <option value="incoming">
                    {tr(locale, "Usar datos importados", "Use imported data")}
                  </option>
                </select>
              </label>
            ) : null}
            <div className="controls">
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await backupData(data);
                    for (const lang of new Set(
                      incoming.sessions
                        .filter((s) => languageGames.includes(s.gameId))
                        .map((s) => (s.config.language === "en" ? "en" : "es")),
                    ))
                      await loadLexicon(lang as Locale);
                    await onImport(
                      mode === "replace"
                        ? incoming
                        : mergeData(data, incoming, prefer),
                    );
                    setIncoming(null);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                {tr(locale, "Confirmar importación", "Confirm import")}
              </button>
              <button onClick={() => setIncoming(null)}>
                {tr(locale, "Cancelar", "Cancel")}
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="notice">
            {error}
          </p>
        ) : null}
        <p className="muted small">
          {tr(
            locale,
            "Mover el HTML, cambiar de navegador o borrar los datos del sitio puede separar o eliminar tus guardados. Conserva una copia exportada.",
            "Moving the HTML, changing browsers or clearing site data may separate or remove saves. Keep an exported backup.",
          )}
        </p>
      </section>
    </>
  );
}
