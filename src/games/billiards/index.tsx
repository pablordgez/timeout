import { useState, type CSSProperties } from "react";
import {
  difficulty,
  labels,
  select,
  tr,
  type GameDefinition,
  type GameViewProps,
} from "../../core/types";
import { PoolSurface } from "./surface";
import { previewShot } from "./preview";
import {
  BOTTOM,
  HEAD,
  LEFT,
  R,
  RIGHT,
  TOP,
  createPool,
  groupOf,
  pockets,
  poolBot,
  poolReducer,
  permittedTargets,
  type PoolState,
} from "./engine";
import "./billiards.css";
const ballTokens = [
  "white",
  "yellow",
  "blue",
  "red",
  "purple",
  "orange",
  "green",
  "maroon",
  "black",
  "yellow",
  "blue",
  "red",
  "purple",
  "orange",
  "green",
  "maroon",
];
const ballFallbacks = [
  "card-bg",
  "piece-o",
  "piece-j",
  "piece-z",
  "piece-t",
  "piece-l",
  "piece-s",
  "piece-z",
  "card-black",
  "piece-o",
  "piece-j",
  "piece-z",
  "piece-t",
  "piece-l",
  "piece-s",
  "piece-z",
];
const ballColorVar = (id: number) =>
  `var(--pool-ball-${ballTokens[id]}, var(--${ballFallbacks[id]}))`;
function draw(
  ctx: CanvasRenderingContext2D,
  s: PoolState,
  c: Record<string, string>,
  practice = false,
) {
  const css = getComputedStyle(document.documentElement),
    token = (name: string, fallback: string) =>
      css.getPropertyValue("--" + name).trim() || fallback;
  const numberFace = token("pool-number-face", token("card-bg", c.surface)),
    numberInk = token("pool-number-ink", token("card-black", c.text)),
    stripeBase = token("pool-stripe-base", numberFace),
    outline = token("pool-ball-outline", numberInk);
  const ballColors = ballTokens.map((name, i) =>
    token("pool-ball-" + name, token(ballFallbacks[i], c.text)),
  );
  ctx.clearRect(0, 0, 720, 400);
  ctx.fillStyle = token("pool-rail", c.surface);
  ctx.fillRect(0, 0, 720, 400);
  ctx.fillStyle = token("pool-cloth", c.felt);
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
  ctx.fillStyle = "#00000020";
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, 4);
  ctx.fillRect(LEFT, TOP, 4, BOTTOM - TOP);
  ctx.strokeStyle = "#ffffff15";
  ctx.lineWidth = 2;
  ctx.strokeRect(LEFT + 2, TOP + 2, RIGHT - LEFT - 4, BOTTOM - TOP - 4);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(HEAD, TOP);
  ctx.lineTo(HEAD, BOTTOM);
  ctx.stroke();
  ctx.setLineDash([]);
  pockets.forEach(([x, y], i) => {
    ctx.fillStyle = token("pool-pocket", c.bg);
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.text;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x, y < 200 ? 17 : 392);
    if (
      !practice &&
      i === s.calledPocket &&
      !s.breakShot &&
      s.phase === "aim"
    ) {
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 21, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  const cue = s.balls.find((b) => b.id === 0)!;
  if (s.phase === "aim" && !s.inHand) {
    const preview = previewShot(s);
    if (preview) {
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      for (const line of preview.lines) {
        ctx.strokeStyle =
          line.kind === "object"
            ? c.accent
            : line.kind === "bounce"
              ? c.muted
              : c.text;
        ctx.beginPath();
        ctx.moveTo(line.from.x, line.from.y);
        ctx.lineTo(line.to.x, line.to.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = c.text;
      ctx.beginPath();
      ctx.arc(preview.contact.x, preview.contact.y, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    const pull = Math.min(130, Number(s.pull) || 0);
    ctx.strokeStyle = token("pool-cue", c.accent);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(
      cue.x - Math.cos(s.angle) * (16 + pull),
      cue.y - Math.sin(s.angle) * (16 + pull),
    );
    ctx.lineTo(
      cue.x - Math.cos(s.angle) * (85 + pull),
      cue.y - Math.sin(s.angle) * (85 + pull),
    );
    ctx.stroke();
    if (pull) {
      ctx.fillStyle = c.border;
      ctx.fillRect(265, 8, 190, 5);
      ctx.fillStyle = c.accent;
      ctx.fillRect(265, 8, (190 * s.power) / 1100, 5);
    }
  }
  s.balls
    .filter((b) => !b.pocketed)
    .forEach((b) => {
      ctx.fillStyle = "#00000038";
      ctx.beginPath();
      ctx.ellipse(b.x + 2, b.y + 3, R, R * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.id > 8 ? stripeBase : ballColors[b.id];
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();
      if (b.id > 8) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = ballColors[b.id];
        ctx.fillRect(b.x - R, b.y - 4, R * 2, 8);
        ctx.restore();
      }
      ctx.strokeStyle =
        !practice && b.id === s.calledBall && !s.breakShot && s.phase === "aim"
          ? c.accent
          : outline;
      ctx.lineWidth = !practice && b.id === s.calledBall ? 2 : 1;
      ctx.stroke();
      if (b.id) {
        ctx.fillStyle = numberFace;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = numberInk;
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.id), b.x, b.y + 0.5);
      }
      ctx.textBaseline = "alphabetic";
      ctx.save();
      const shade = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, R);
      shade.addColorStop(0, "#ffffff55");
      shade.addColorStop(0.4, "#ffffff00");
      shade.addColorStop(1, "#00000050");
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
}
function PoolView({
  state: s,
  dispatch,
  config: c,
  locale: l,
  paused,
}: GameViewProps<PoolState>) {
  const targets = permittedTargets(s, c);
  const ready =
    s.phase === "aim" &&
    !paused &&
    s.status === "playing" &&
    (c.mode === "practice" || s.turn < Number(c.humans || 1));
  const [placeX, setPlaceX] = useState(20),
    [placeY, setPlaceY] = useState(50);
  const [locked, setLocked] = useState(true);
  const [shotBlocked, setShotBlocked] = useState(false);
  const missingCall =
    c.mode !== "practice" &&
    !s.breakShot &&
    (!targets.includes(s.calledBall) ||
      !Number.isInteger(s.calledPocket) ||
      s.calledPocket < 0 ||
      s.calledPocket >= pockets.length);
  const act: typeof dispatch = (action) => {
    if (action.type === "SHOOT" && ready && !s.inHand) {
      setShotBlocked(missingCall);
    }
    dispatch(action);
  };
  // Practice saves from earlier builds can contain this incorrect eight-ball warning.
  const oldPracticeWarning =
    c.mode === "practice" &&
    s.event.es === "Anuncia una bola disponible y la tronera antes de tirar.";
  return (
    <div className="pool-game">
      <div className="pool-scores">
        {Array.from({ length: c.mode === "practice" ? 1 : 2 }, (_, i) => (
          <div key={i} className={s.turn === i ? "active" : ""}>
            <strong>
              {tr(l, "Jugador", "Player")} {i + 1}
            </strong>
            <span>
              {s.groups[i]
                ? s.groups[i] === "solid"
                  ? tr(l, "Lisas 1–7", "Solids 1–7")
                  : tr(l, "Rayadas 9–15", "Stripes 9–15")
                : tr(l, "Mesa abierta", "Open table")}
            </span>
            <span>
              {s.shots[i]} {tr(l, "tiros", "shots")} · {s.fouls[i]}{" "}
              {tr(l, "faltas", "fouls")}
            </span>
          </div>
        ))}
      </div>
      {ready && !s.inHand && missingCall && (
        <p
          className={`pool-call-notice ${shotBlocked ? "blocked" : ""}`}
          role={shotBlocked ? "alert" : "status"}
        >
          {shotBlocked && (
            <strong>{tr(l, "Tiro bloqueado. ", "Shot blocked. ")}</strong>
          )}
          {tr(
            l,
            "Antes de tirar, anuncia una bola y una tronera. Tócalas en la mesa o elígelas en los selectores de abajo.",
            "Before shooting, call a ball and pocket. Tap them on the table or use the selectors below.",
          )}
        </p>
      )}
      <PoolSurface
        state={s}
        dispatch={act}
        config={c}
        locale={l}
        paused={paused}
        draw={draw}
        locked={locked}
      />
      {!missingCall && !oldPracticeWarning && <p role="status">{s.event[l]}</p>}
      {s.phase === "break-choice" ? (
        <div className="pool-controls">
          <button
            disabled={paused}
            onClick={() => dispatch({ type: "BREAK_CHOICE", choice: "accept" })}
          >
            {tr(
              l,
              "Aceptar mesa y reponer la 8",
              "Accept table and spot the 8",
            )}
          </button>
          <button
            disabled={paused}
            onClick={() => dispatch({ type: "BREAK_CHOICE", choice: "rerack" })}
          >
            {tr(l, "Montar y sacar yo", "Re-rack and break myself")}
          </button>
          {s.breakChoice?.illegal && (
            <button
              disabled={paused}
              onClick={() =>
                dispatch({ type: "BREAK_CHOICE", choice: "other" })
              }
            >
              {tr(
                l,
                "Montar y devolver el saque",
                "Re-rack and let the other player break",
              )}
            </button>
          )}
        </div>
      ) : null}
      {c.mode !== "practice" && !s.breakShot && s.phase !== "break-choice" && (
        <div className="pool-controls">
          <label>
            {tr(l, "Bola anunciada", "Called ball")}
            <select
              disabled={!ready}
              value={targets.includes(s.calledBall) ? s.calledBall : ""}
              onChange={(e) =>
                dispatch({ type: "CALL_BALL", id: Number(e.target.value) })
              }
            >
              <option value="" disabled>
                {tr(l, "Elige una bola", "Choose a ball")}
              </option>
              {targets.map((id) => (
                <option key={id} value={id}>
                  {id} ·{" "}
                  {groupOf(id) === "solid"
                    ? tr(l, "lisa", "solid")
                    : id === 8
                      ? "8"
                      : tr(l, "rayada", "stripe")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr(l, "Tronera anunciada", "Called pocket")}
            <select
              value={s.calledPocket}
              disabled={!ready}
              onChange={(e) =>
                dispatch({
                  type: "CALL_POCKET",
                  pocket: Number(e.target.value),
                })
              }
            >
              {pockets.map((_, i) => (
                <option key={i} value={i}>
                  {i + 1} ·{" "}
                  {
                    [
                      tr(l, "arriba izquierda", "top left"),
                      tr(l, "arriba centro", "top middle"),
                      tr(l, "arriba derecha", "top right"),
                      tr(l, "abajo izquierda", "bottom left"),
                      tr(l, "abajo centro", "bottom middle"),
                      tr(l, "abajo derecha", "bottom right"),
                    ][i]
                  }
                </option>
              ))}
            </select>
          </label>
          <small>
            {tr(
              l,
              "También puedes tocar la bola y la tronera.",
              "You can also tap the ball and pocket.",
            )}
          </small>
        </div>
      )}
      {s.phase !== "break-choice" && (
        <details className="pool-precision">
          <summary>
            {tr(
              l,
              "Controles precisos y teclado",
              "Precise controls and keyboard",
            )}
          </summary>
          <div className="pool-shot-controls">
            <label>
              {tr(l, "Potencia", "Power")} {Math.round(s.power / 11)}%
              <input
                aria-label={tr(l, "Potencia", "Power")}
                className="pool-power-slider"
                style={
                  {
                    "--power-fill": `${((s.power - 80) / 1020) * 100}%`,
                  } as CSSProperties
                }
                type="range"
                min="80"
                max="1100"
                step="10"
                value={s.power}
                disabled={!ready}
                onChange={(e) =>
                  dispatch({ type: "POWER", power: Number(e.target.value) })
                }
              />
            </label>
            <button
              disabled={!ready || s.inHand}
              onClick={() => act({ type: "SHOOT" })}
            >
              {s.phase === "moving"
                ? tr(l, "Bolas en movimiento…", "Balls moving…")
                : s.breakShot
                  ? tr(l, "Sacar", "Break")
                  : tr(l, "Disparar", "Shoot")}
            </button>
            <small>
              {tr(
                l,
                "← → afina el ángulo · Mayús para ajustes de 0,1° · Espacio tira",
                "← → fine aim · Shift for 0.1° steps · Space shoots",
              )}
            </small>
          </div>
          <div className="pool-controls">
            {s.inHand && (
              <>
                <label>
                  {tr(l, "Posición horizontal (%)", "Horizontal position (%)")}
                  <input
                    type="number"
                    min="0"
                    max={s.behindHead ? 24 : 100}
                    value={placeX}
                    disabled={!ready}
                    onChange={(e) => setPlaceX(Number(e.target.value))}
                  />
                </label>
                <label>
                  {tr(l, "Posición vertical (%)", "Vertical position (%)")}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={placeY}
                    disabled={!ready}
                    onChange={(e) => setPlaceY(Number(e.target.value))}
                  />
                </label>
                <button
                  disabled={!ready}
                  onClick={() =>
                    dispatch({
                      type: "PLACE",
                      x: LEFT + R + (placeX / 100) * (RIGHT - LEFT - 2 * R),
                      y: TOP + R + (placeY / 100) * (BOTTOM - TOP - 2 * R),
                    })
                  }
                >
                  {tr(l, "Colocar blanca", "Place cue ball")}
                </button>
              </>
            )}
            <label>
              {tr(l, "Ángulo", "Angle")}
              <input
                aria-label={tr(l, "Ángulo de tiro", "Shot angle")}
                type="range"
                min="-180"
                max="180"
                step=".5"
                value={(s.angle * 180) / Math.PI}
                disabled={!ready}
                onChange={(e) =>
                  dispatch({
                    type: "AIM",
                    angle: (Number(e.target.value) * Math.PI) / 180,
                  })
                }
              />
            </label>
          </div>
          <label className="pool-aim-lock">
            <input
              type="checkbox"
              checked={locked}
              disabled={!ready}
              onChange={(e) => setLocked(e.target.checked)}
            />
            {tr(
              l,
              "Mantener la dirección al cargar el tiro",
              "Keep the chosen direction while charging",
            )}
          </label>
        </details>
      )}
      <div className="pool-pocketed">
        {tr(l, "Embocadas", "Pocketed")}:{" "}
        {s.balls
          .filter((b) => b.id && b.pocketed)
          .map((b) => (
            <span
              key={b.id}
              className={b.id > 8 ? "stripe" : ""}
              style={{ "--ball-color": ballColorVar(b.id) } as CSSProperties}
            >
              <i>{b.id}</i>
            </span>
          ))}
      </div>
      <small>
        {tr(
          l,
          c.mode === "practice"
            ? "Práctica libre: no hace falta anunciar bola ni tronera."
            : "Bola 8 con tiro anunciado. Simulación 2D sin efectos ni saltos.",
          c.mode === "practice"
            ? "Free practice: no need to call a ball or pocket."
            : "Eight-ball with called shots. 2D simulation without spin or jump shots.",
        )}
      </small>
    </div>
  );
}
export const billiards: GameDefinition<PoolState> = {
  id: "billiards",
  name: labels("Billar", "Pool"),
  description: labels(
    "Bola 8 contra un rival o práctica individual.",
    "Eight-ball against an opponent or solo practice.",
  ),
  category: "board",
  icon: "⑧",
  version: 1,
  defaults: { mode: "eight", humans: 1, difficulty: "medium" },
  playerCount: (c) => (c.mode === "practice" ? 1 : 2),
  options: [
    select(
      "mode",
      "Modalidad",
      "Mode",
      [
        ["eight", "Bola 8 · 2 jugadores", "Eight-ball · 2 players"],
        ["practice", "Práctica individual", "Solo practice"],
      ],
      "eight",
    ),
    select(
      "humans",
      "Humanos (bola 8)",
      "Humans (eight-ball)",
      [
        [1, "1 + bot", "1 + bot"],
        [2, "2 locales", "2 local"],
      ],
      1,
      (c) => c.mode === "eight",
    ),
    {
      ...difficulty,
      visibleWhen: (c) => c.mode === "eight" && Number(c.humans) < 2,
    },
  ],
  create: createPool,
  reducer: poolReducer,
  View: PoolView,
  bot: poolBot,
  getTurn: (s, c) =>
    s.status !== "playing" || s.phase === "moving"
      ? null
      : {
          player: s.turn,
          bot: c.mode !== "practice" && s.turn >= Number(c.humans || 1),
          hidden: false,
        },
  guide: [
    {
      title: labels(
        "Apunta, tira hacia atrás y suelta",
        "Aim, pull back and release",
      ),
      text: labels(
        "Coloca la blanca en un espacio libre. Con ratón, apunta moviéndolo sobre la mesa, pulsa, arrastra hacia atrás y suelta para tirar. En pantalla táctil, toca o arrastra para apuntar y después tira hacia atrás desde la blanca. Cuanto más tiras, más potencia; si vuelves al punto inicial, cancelas el tiro. Escape también cancela. Los controles precisos reúnen potencia, ángulo y botón de tiro. Las flechas afinan la dirección; Mayús permite ajustes de 0,1° y Espacio tira.",
        "Place the cue ball on empty cloth. With a mouse, move over the table to aim, press, pull back and release to shoot. On touchscreens, tap or drag to aim, then pull back from the cue ball. A longer pull means more power; returning to the starting point cancels the shot. Escape also cancels. Precise controls contain power, angle and the shot button. Arrow keys fine-tune aim; Shift uses 0.1° steps and Space shoots.",
      ),
      diagram: "tira ← taco ── ○ blanca → ● objetivo → ◉ tronera",
    },
    {
      title: labels("Saque y mesa abierta", "Break and open table"),
      text: labels(
        "La blanca comienza detrás de la línea. Un saque legal emboca una bola o lleva cuatro bolas a banda. La 8 en el saque se repone o se vuelve a montar. Las lisas o rayadas se asignan después de embocar legalmente una bola anunciada, nunca en el saque.",
        "Begin behind the head string. A legal break pockets a ball or sends four object balls to rails. An 8 on the break is spotted or re-racked. Solids and stripes are assigned by a legally pocketed called ball, never on the break.",
      ),
      diagram: "LISAS 1–7  ↔  RAYADAS 9–15 · 8 al final",
    },
    {
      title: labels("Anuncia bola y tronera", "Call ball and pocket"),
      text: labels(
        "Elige la bola y la tronera numerada antes del tiro. Si embocas la bola anunciada legalmente, sigues jugando; si no, pasa el turno. Solo anuncia la 8 después de retirar todas las bolas de tu grupo.",
        "Choose the ball and numbered pocket before shooting. Legally pocket your called ball to keep shooting; otherwise the turn passes. Call the 8 only after clearing your group.",
      ),
      diagram: "① ↗ ◉ 2 → bola 1, tronera 2",
    },
    {
      title: labels("Faltas y bola en mano", "Fouls and ball in hand"),
      text: labels(
        "Primero toca tu grupo (la 8 cuando ya no quedan). Después debe embocarse una bola o tocar una banda. No tocar ninguna, tocar la incorrecta o embocar la blanca es falta. El rival coloca la blanca; tras falta de saque, detrás de la línea. Embocar la 8 antes de tiempo, en otra tronera o con falta pierde la partida.",
        "Hit your group first (the 8 when your group is cleared). Then pocket a ball or reach a rail. No contact, wrong first ball or pocketing the cue ball is a foul. Opponent places the cue ball; behind the head string after a break foul. An early 8, wrong pocket or foul with the 8 loses the game.",
      ),
    },
    {
      title: labels("Práctica sin rival", "Solo practice"),
      text: labels(
        "Emboca todas las bolas en el menor número de tiros. Puedes elegir cualquier bola. Las faltas descuentan 25 puntos y permiten recolocar la blanca. La simulación usa choques, rozamiento y bandas, sin efectos ni saltos.",
        "Pocket all balls in as few shots as possible. Choose any target. Fouls subtract 25 points and allow cue-ball placement. Simulation models collisions, friction and rails without spin or jump shots.",
      ),
    },
  ],
  summarize: (s) => ({
    shots: s.shots[0],
    fouls: s.fouls[0],
    pocketed: s.balls.filter((b) => b.id && b.pocketed).length,
  }),
};
