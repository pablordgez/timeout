import {
  difficulty,
  labels,
  select,
  tr,
  type Config,
  type GameDefinition,
  type GameViewProps,
  type GuideStep,
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
            <button className="sd-button"
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
              <button className="sd-button"
                disabled={paused || !human || can.length > 0 || !s.stock.length}
                onClick={() => dispatch({ type: "DRAW" })}
              >
                {tr(l, "Robar", "Draw")} · {s.stock.length}
              </button>
            )}
            <button className="sd-button"
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

const dominoGuidesByMode: Record<string, GuideStep[]> = {
  fives: [
    {
      title: labels("Encaja una ficha", "Match a tile"),
      text: labels(
        "Se reparten 7 fichas a 2 jugadores, o 5 a 3-4. El primer turno se sortea y puede abrir con cualquier ficha. Coloca haciendo coincidir el número con uno de los extremos libres. Las flechas indican los extremos donde encaja cada ficha.",
        "7 tiles are dealt to 2 players, or 5 to 3-4. The first turn is random and can lead any tile. Match your numbers with open ends. Arrows show available placement ends.",
      ),
      diagram: "[2|6] [6|3] → 2 o 3",
    },
    {
      title: labels("Todos cincos: suma los extremos", "All Fives: add the ends"),
      text: labels(
        "Si la suma de todos los extremos abiertos es múltiplo de 5 (5, 10, 15, 20…), ganas esos puntos inmediatamente. Un doble expuesto cuenta sus dos mitades: el 5–5 suma 10. Las flechas muestran los puntos que daría cada jugada.",
        "If all open ends total a multiple of 5 (5, 10, 15, 20…), you score those points immediately. An exposed double counts both halves: 5–5 adds 10. Arrows show points each move would score.",
      ),
      diagram: "2 + 3 = 5 → +5",
    },
    {
      title: labels("El primer doble abre ramas", "The first double opens branches"),
      text: labels(
        "Solo el primer doble jugado permite construir en cuatro direcciones (spinner). Primero se juega a sus dos extremos laterales; después se pueden abrir ramas arriba y abajo. Una vez cubiertos ambos laterales, el doble deja de contar para la suma de extremos.",
        "Only the first double played allows branching in four directions (spinner). Play on its sides first, then branch above and below. The spinner stops counting once its sides are covered.",
      ),
      diagram: "← [5|5] →     ↑ / ↓",
    },
    {
      title: labels("Robar, pasar y final de ronda", "Draw, pass and round end"),
      text: labels(
        "Sin jugada válida, roba del pozo hasta poder jugar o agotar el montón; entonces pasa. Vaciar la mano gana la ronda; si todos pasan y se cierra la partida, gana quien tenga menor suma restante. El ganador suma los puntos restantes de los rivales, redondeados al múltiplo de 5 más cercano.",
        "Without a valid move, draw until you can play or the boneyard empties, then pass. Emptying your hand wins the round; on a block, the lowest remaining total wins. The winner scores opponents' remaining pips rounded to the nearest multiple of 5.",
      ),
    },
  ],
  pairs: [
    {
      title: labels("Domino por parejas", "Partnership dominoes"),
      text: labels(
        "4 jugadores repartidos en dos equipos: los jugadores 1 y 3 juegan juntos contra los jugadores 2 y 4. Cada jugador recibe 7 fichas. Se abre la primera ronda con el doble seis [6|6].",
        "4 players in two teams: players 1 & 3 team up against players 2 & 4. Each player receives 7 tiles. The first round opens with the double six [6|6].",
      ),
      diagram: "[Equipo A: 1 & 3]  vs  [Equipo B: 2 & 4]",
    },
    {
      title: labels("Sin robo: o juegas o pasas", "No drawing: play or pass"),
      text: labels(
        "En el dominó por parejas no hay pozo de robo (las 28 fichas están repartidas). Si no tienes ninguna ficha que encaje en los extremos, debes pasar inmediatamente el turno al siguiente jugador.",
        "In partners domino there is no boneyard (all 28 tiles are dealt). If you have no matching tile, you must pass your turn immediately.",
      ),
      diagram: "[6|4] … [2|5]   |   pasar si no encajas",
    },
    {
      title: labels("Estrategia en equipo y cierre", "Team strategy and blocked game"),
      text: labels(
        "Observa qué números castigan o faltan a tus rivales y qué necesita tu compañero. Si la partida se cierra (nadie puede poner ficha), ambos equipos suman los puntos de las fichas que les quedan en mano; el equipo con menos puntos gana.",
        "Pay attention to which numbers opponents pass on and support your partner. If the game is blocked, both teams sum remaining pips; the team with the lowest total wins.",
      ),
    },
    {
      title: labels("Puntuación de la ronda", "Round scoring"),
      text: labels(
        "El equipo del jugador que domine (vacíe su mano), o del que tenga menos puntos en un cierre, suma los puntos de las fichas restantes del equipo rival. El primer equipo en alcanzar la puntuación objetivo gana.",
        "The team of the player who dominos (empties hand), or has the lowest pips on a block, scores all remaining pips from the opposing team. First team to the point target wins.",
      ),
    },
  ],
  draw: [
    {
      title: labels("Encaja una ficha", "Match a tile"),
      text: labels(
        "Cada jugador recibe 7 fichas (o 5 si son 3-4 jugadores). Abre la ronda el jugador con el doble más alto repartido. En tu turno, coloca una ficha que coincida con uno de los dos extremos abiertos de la cadena.",
        "Each player receives 7 tiles (5 with 3-4 players). The player holding the highest double leads. Match one of your tiles with either of the two open ends.",
      ),
      diagram: "[2|6] [6|3] → extremos 2 y 3",
    },
    {
      title: labels("Robar del pozo y pasar", "Draw from the boneyard and pass"),
      text: labels(
        "Si no tienes ninguna ficha que encaje en los extremos, debes robar del pozo (boneyard) una a una hasta obtener una que puedas colocar. Cuando el pozo se agote, si no puedes jugar, pasas tu turno.",
        "If you cannot play, you must draw from the boneyard until you find a playable tile. When the boneyard is empty, you must pass if you have no legal move.",
      ),
      diagram: "Sin jugada → robar del pozo",
    },
    {
      title: labels("Dobles y colocación", "Doubles and placement"),
      text: labels(
        "Los dobles se colocan transversalmente. En el modo clásico, la cadena se expande únicamente por dos extremos principales en línea continua.",
        "Doubles are placed crosswise. In classic mode, play extends from two open line ends.",
      ),
      diagram: "─ [3|3] ─",
    },
    {
      title: labels("Final de ronda y recuento", "Round end and counting"),
      text: labels(
        "La ronda termina cuando un jugador vacía su mano (¡Dominó!) o cuando la partida se cierra porque nadie puede jugar. El ganador suma los puntos de las fichas que les quedaron a todos los rivales en la mano.",
        "The round ends when a player plays their last tile (Domino!) or when the board is blocked. The winner scores the sum of all pips left in opponents' hands.",
      ),
    },
  ],
};

const getDominoGuide = (mode?: string): GuideStep[] =>
  dominoGuidesByMode[mode || "draw"] || dominoGuidesByMode.draw;

const dominoGuideFn = (c?: Config): GuideStep[] =>
  getDominoGuide(c?.mode as string);

export const domino: GameDefinition<DominoState> = {
  id: "domino",
  name: labels("Dominó", "Dominoes"),
  icon: "🁠",
  category: "board",
  version: 2,
  description: labels(
    "Tradicional con robo, por parejas y Todos Cincos.",
    "Traditional draw, partners and All Fives.",
  ),
  defaults: {
    mode: "draw",
    players: 2,
    humans: 1,
    target: 100,
    difficulty: "medium",
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
  guide: dominoGuideFn as any,
  summarize: (s) => ({ rounds: s.round, points: s.points[0] }),
};
