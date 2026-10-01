import {
  difficulty,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameViewProps,
} from "../../core/types";
import {
  createDomino,
  dominoBot,
  dominoReducer,
  endTotal,
  legalEnds,
  legalTiles,
  pipSum,
  previewPoints,
  scoringEnds,
  spinnerReady,
  tiles,
  type DominoState,
} from "./engine";
import { DominoTile as Tile } from "./tile";
import { arrows, endName, FivesBoard } from "./fives-board";
import "./domino.css";
function DominoView({
  state: s,
  dispatch,
  locale: l,
  config: c,
  paused,
}: GameViewProps<DominoState>) {
  const human = s.turn < Number(c.humans || 1),
    hand = s.hands[s.turn],
    can = legalTiles(s),
    fives = c.mode === "fives";
  return (
    <div className="domino-game">
      <div className="domino-scores">
        {s.hands.map((h, i) => (
          <div key={i} className={i === s.turn ? "active" : ""}>
            <strong>
              {tr(l, "Jugador", "Player")} {i + 1}
              {c.mode === "pairs"
                ? ` · ${tr(l, "Equipo", "Team")} ${(i % 2) + 1}`
                : ""}
            </strong>
            <span>
              {s.points[i]} / {String(c.target)} {tr(l, "puntos", "points")} ·{" "}
              {h.length} {tr(l, "fichas", "tiles")}
            </span>
          </div>
        ))}
      </div>
      {fives ? (
        <>
          <div
            className="domino-end-total"
            aria-label={tr(l, "Suma de los extremos", "Open-end total")}
          >
            <span>{tr(l, "Todos cincos · Extremos", "All Fives · Ends")}</span>
            <strong>
              {s.chain.length
                ? `${scoringEnds(s).join(" + ")} = ${endTotal(s)}`
                : "—"}
            </strong>
            {!!s.fives?.lastScore && (
              <span className="domino-earned">
                +{s.fives.lastScore}{" "}
                {tr(l, "en la última jugada", "on the last play")}
              </span>
            )}
          </div>
          <FivesBoard state={s} locale={l} />
          {spinnerReady(s) &&
            (!s.fives!.up.length || !s.fives!.down.length) && (
              <small className="domino-branch-help">
                {tr(
                  l,
                  "Puedes abrir arriba y abajo. Una rama nueva suma cuando colocas su primera ficha.",
                  "You can branch above and below. A new arm counts once its first tile is played.",
                )}
              </small>
            )}
        </>
      ) : (
        <div
          className="domino-chain"
          aria-label={tr(l, "Cadena de fichas", "Tile chain")}
        >
          {s.chain.length ? (
            s.chain.map((tile) => (
              <Tile key={tile.id} left={tile.left} right={tile.right} />
            ))
          ) : (
            <p>
              {tr(l, "Comienza con", "Begin with")}{" "}
              <Tile left={tiles[s.opening][0]} right={tiles[s.opening][1]} />
            </p>
          )}
        </div>
      )}
      <p role="status">{s.event[l]}</p>
      {s.phase === "roundover" ? (
        <>
          <div className="domino-reveal">
            {s.hands.map((h, i) => (
              <div key={i}>
                <strong>
                  {tr(l, "Jugador", "Player")} {i + 1}: {pipSum(h)}
                </strong>
                <div>
                  {h.map((id) => (
                    <Tile key={id} left={tiles[id][0]} right={tiles[id][1]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {s.status === "playing" && (
            <button
              disabled={paused}
              onClick={() => dispatch({ type: "NEXT_ROUND" })}
            >
              {tr(l, "Siguiente ronda", "Next round")}
            </button>
          )}
        </>
      ) : (
        <>
          <h3>
            {tr(l, "Fichas de jugador", "Tiles of player")} {s.turn + 1}
          </h3>
          <div className="domino-rack">
            {human
              ? hand.map((id) => (
                  <div
                    key={id}
                    className={`domino-choice ${can.includes(id) ? "legal" : ""}`}
                  >
                    <Tile left={tiles[id][0]} right={tiles[id][1]} />
                    <div>
                      {legalEnds(s, id).map((end) => {
                        const points = previewPoints(s, id, end);
                        return (
                          <button
                            key={end}
                            disabled={paused}
                            aria-label={`${tr(l, "Colocar", "Play")} ${tiles[id].join("-")} ${endName(end, l)}${points ? `, +${points} ${tr(l, "puntos", "points")}` : ""}`}
                            onClick={() => dispatch({ type: "PLAY", id, end })}
                          >
                            {arrows[end]}
                            {points > 0 && (
                              <span className="domino-move-points">
                                +{points}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              : hand.map((_, i) => (
                  <span
                    key={i}
                    className="domino-hidden"
                    aria-label={tr(l, "Ficha oculta", "Hidden tile")}
                  >
                    ···
                  </span>
                ))}
          </div>
          <div className="domino-actions">
            {c.mode !== "pairs" && (
              <button
                disabled={paused || !human || can.length > 0 || !s.stock.length}
                onClick={() => dispatch({ type: "DRAW" })}
              >
                {tr(l, "Robar", "Draw")} · {s.stock.length}
              </button>
            )}
            <button
              disabled={
                paused ||
                !human ||
                can.length > 0 ||
                (c.mode !== "pairs" && s.stock.length > 0)
              }
              onClick={() => dispatch({ type: "PASS" })}
            >
              {tr(l, "Pasar", "Pass")}
            </button>
            {!fives && (
              <span>
                {tr(l, "Extremos", "Ends")}:{" "}
                {s.chain.length
                  ? `${s.chain[0].left} / ${s.chain.at(-1)!.right}`
                  : "—"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
export const domino: GameDefinition<DominoState> = {
  id: "domino",
  name: labels("Dominó", "Dominoes"),
  description: labels(
    "Clásico, por parejas o Todos cincos.",
    "Classic, partners or All Fives.",
  ),
  category: "board",
  icon: "⚅",
  version: 2,
  defaults: {
    mode: "draw",
    players: 2,
    humans: 1,
    difficulty: "medium",
    target: 100,
  },
  options: [
    select(
      "mode",
      "Modalidad",
      "Mode",
      [
        ["draw", "Individual con robo", "Individual draw"],
        [
          "fives",
          "Todos cincos · extremos y ramas",
          "All Fives · ends and branches",
        ],
        ["pairs", "Parejas · 4 jugadores", "Partners · 4 players"],
      ],
      "draw",
    ),
    select(
      "players",
      "Jugadores",
      "Players",
      [
        [2, "2", "2"],
        [3, "3", "3"],
        [4, "4", "4"],
      ],
      2,
      (c) => c.mode !== "pairs",
    ),
    select(
      "humans",
      "Humanos",
      "Humans",
      [
        [1, "1", "1"],
        [2, "2", "2"],
        [3, "3", "3"],
        [4, "4", "4"],
      ],
      1,
    ),
    select(
      "target",
      "Objetivo de puntos",
      "Point target",
      [
        [50, "50", "50"],
        [100, "100", "100"],
        [200, "200", "200"],
      ],
      100,
    ),
    {
      ...difficulty,
      visibleWhen: (c) =>
        Number(c.humans) < (c.mode === "pairs" ? 4 : Number(c.players)),
    },
  ],
  playerCount: (c) => (c.mode === "pairs" ? 4 : Number(c.players)),
  create: createDomino,
  reducer: dominoReducer,
  View: DominoView,
  bot: dominoBot,
  migrate: (state) => state,
  getTurn: (s, c) =>
    s.phase === "roundover"
      ? null
      : {
          player: s.turn,
          bot: s.turn >= Math.min(s.hands.length, Number(c.humans) || 1),
          hidden: true,
        },
  guide: [
    {
      title: labels("Encaja una ficha", "Match a tile"),
      text: labels(
        "En clásico y parejas, cada jugador recibe siete fichas y abre el doble más alto repartido. En Todos cincos se reparten siete a dos jugadores, cinco a tres o cuatro; el primer turno se sortea y puede abrir con cualquier ficha. Las flechas indican los extremos donde encaja cada ficha.",
        "Classic and partners deal seven tiles per player and start with the highest dealt double. All Fives deals seven tiles to two players, five to three or four; the first player is chosen at random and may lead any tile. Arrows show where each tile fits.",
      ),
      diagram: "[2|6] [6|3] → 2 o 3",
    },
    {
      title: labels(
        "Todos cincos: suma los extremos",
        "All Fives: add the ends",
      ),
      text: labels(
        "Si la suma de todos los extremos es 5, 10, 15… ganas esos puntos al colocar la ficha. Un doble en un extremo cuenta sus dos mitades: el 5–5 suma 10. Las flechas muestran los puntos que daría cada jugada. Gana quien alcanza el objetivo, aunque aún tenga fichas.",
        "If all open ends total 5, 10, 15… you score that many points when playing. An exposed double counts both halves: 5–5 adds 10. Arrows show the points each move would score. Reaching the target wins immediately, even with tiles left.",
      ),
      diagram: "2 + 3 = 5 → +5",
    },
    {
      title: labels(
        "El primer doble abre ramas",
        "The first double opens branches",
      ),
      text: labels(
        "Solo el primer doble permite construir en cuatro direcciones. Primero se juega a sus dos lados; después se pueden abrir arriba y abajo. El doble central deja de sumar al tener ambos lados cubiertos. Las ramas nuevas no suman hasta colocar su primera ficha; desde entonces cuenta el extremo de cada rama.",
        "Only the first double allows four directions. Play on its two sides first, then branch above and below. The spinner stops counting once both sides are covered. New arms do not count until their first tile is played; each arm then contributes its exposed end.",
      ),
      diagram: "← [5|5] →     ↑ / ↓",
    },
    {
      title: labels(
        "Robar, pasar y terminar una ronda",
        "Draw, pass and end a round",
      ),
      text: labels(
        "Sin jugada, roba hasta poder jugar o agotar el montón; entonces pasa. En parejas no se roba: 1+3 y 2+4 comparten equipo. Vaciar la mano gana la ronda; si todos pasan, gana la menor suma restante. Un empate no puntúa. El ganador suma los puntos que quedan a los rivales, redondeados al múltiplo de cinco más cercano en Todos cincos. Quien vacía la mano abre la siguiente ronda de Todos cincos; tras un cierre se sortea.",
        "Without a move, draw until you can play or the stock runs out, then pass. Partners do not draw: 1+3 and 2+4 share teams. Emptying your hand wins the round; if everyone passes, the lowest remaining total wins. Ties score nothing. The winner scores opponents’ remaining pips, rounded to the nearest five in All Fives. The player who goes out leads the next All Fives round; after a block, the lead is random.",
      ),
    },
  ],
  summarize: (s) => ({ rounds: s.round, points: s.points[0] }),
};
