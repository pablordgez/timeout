export const positions: Record<number, [number, number][]> = {
  0: [],
  1: [[15, 15]],
  2: [
    [7, 7],
    [23, 23],
  ],
  3: [
    [7, 7],
    [15, 15],
    [23, 23],
  ],
  4: [
    [7, 7],
    [23, 7],
    [7, 23],
    [23, 23],
  ],
  5: [
    [7, 7],
    [23, 7],
    [15, 15],
    [7, 23],
    [23, 23],
  ],
  6: [
    [7, 7],
    [23, 7],
    [7, 15],
    [23, 15],
    [7, 23],
    [23, 23],
  ],
};
function Pip({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 30 30" aria-hidden="true">
      {positions[value].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" />
      ))}
    </svg>
  );
}
export function DominoTile({ left, right }: { left: number; right: number }) {
  return (
    <span className="domino-tile" role="img" aria-label={`${left}–${right}`}>
      <Pip value={left} />
      <Pip value={right} />
    </span>
  );
}
