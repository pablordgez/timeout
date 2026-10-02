import { tr, type Locale } from "../../core/types";
import {
  endpoint,
  spinnerReady,
  type DominoState,
  type End,
  type Placement,
} from "./engine";
import { positions } from "./tile";
const arrows = { left: "←", right: "→", up: "↑", down: "↓" };
export const endName = (end: End, l: Locale) =>
  ({
    left: tr(l, "a la izquierda", "on the left"),
    right: tr(l, "a la derecha", "on the right"),
    up: tr(l, "arriba", "above"),
    down: tr(l, "abajo", "below"),
  })[end];
export { arrows };
type Drawing = { tile: Placement; x: number; y: number; angle: number };
export function FivesBoard({
  state: s,
  locale: l,
}: {
  state: DominoState;
  locale: Locale;
}) {
  if (!s.chain.length)
    return (
      <div className="domino-chain">
        <p>
          {tr(
            l,
            "Abre con cualquier ficha de tu mano.",
            "Lead any tile from your hand.",
          )}
        </p>
      </div>
    );
  const index =
    s.fives?.spinner != null
      ? s.chain.findIndex((t) => t.id === s.fives!.spinner)
      : Math.floor(s.chain.length / 2);
  const center = s.chain[index],
    centerDouble = center.left === center.right;
  const drawn: Drawing[] = [
    { tile: center, x: 0, y: 0, angle: centerDouble ? 90 : 0 },
  ];
  const tips: { end: End; x: number; y: number }[] = [];
  for (const end of ["left", "right", "up", "down"] as End[]) {
    if ((end === "up" || end === "down") && !spinnerReady(s)) continue;
    const vertical = end === "up" || end === "down",
      sign = end === "left" || end === "up" ? -1 : 1;
    const arm =
      end === "left"
        ? s.chain.slice(0, index).reverse()
        : end === "right"
          ? s.chain.slice(index + 1)
          : s.fives![end];
    let offset = vertical ? (centerDouble ? 32 : 17) : centerDouble ? 17 : 32;
    for (const tile of arm) {
      const double = tile.left === tile.right,
        half = double ? 17 : 32;
      offset += half + 3;
      drawn.push({
        tile,
        x: vertical ? 0 : sign * offset,
        y: vertical ? sign * offset : 0,
        angle: vertical ? (double ? 0 : sign * 90) : double ? 90 : 0,
      });
      offset += half;
    }
    offset += 25;
    tips.push({
      end,
      x: vertical ? 0 : sign * offset,
      y: vertical ? sign * offset : 0,
    });
  }
  const minX = Math.min(-120, ...tips.map((t) => t.x)) - 35,
    maxX = Math.max(120, ...tips.map((t) => t.x)) + 35;
  const minY = Math.min(-80, ...tips.map((t) => t.y)) - 35,
    maxY = Math.max(80, ...tips.map((t) => t.y)) + 35;
  const width = maxX - minX,
    height = maxY - minY;
  return (
    <div
      className="domino-cross-scroll"
      tabIndex={0}
      aria-label={tr(l, "Mesa de Todos cincos", "All Fives table")}
    >
      <svg
        className="domino-cross"
        shapeRendering="crispEdges"
        viewBox={`${minX} ${minY} ${width} ${height}`}
        style={{
          minWidth: Math.max(340, width * 0.65),
          height: Math.max(230, Math.min(450, height * 0.7)),
        }}
      >
        {drawn.map(({ tile, x, y, angle }) => (
          <g
            key={tile.id}
            className={`domino-board-tile ${tile.id === s.fives?.spinner ? "spinner" : ""}`}
            transform={`translate(${x} ${y}) rotate(${angle})`}
            role="img"
            aria-label={`${tile.left}–${tile.right}${tile.id === s.fives?.spinner ? tr(l, ", doble central", ", spinner") : ""}`}
          >
            <rect className="tile-face" x="-32" y="-17" width="64" height="34" />
            <path d="M0 -13V13" />
            {[tile.left, tile.right].map((value, side) => (
              <g key={side} transform={`translate(${side * 32 - 30} -15)`}>
                {positions[value].map(([px, py], i) => (
                  <rect className="tile-pip" key={i} x={px - 2} y={py - 2} width="4" height="4" />
                ))}
              </g>
            ))}
          </g>
        ))}
        {tips.map(({ end, x, y }) => (
          <g
            key={end}
            className="domino-board-end"
            aria-label={`${endName(end, l)}: ${endpoint(s, end)}`}
          >
            <rect x={Math.round(x) - 16} y={Math.round(y) - 16} width="32" height="32" />
            <text x={x} y={y} dy=".35em" textAnchor="middle">
              {endpoint(s, end)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
