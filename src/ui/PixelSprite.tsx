import type { Palette, Sprite } from "./pixel-art";
const geometry = new WeakMap<
  Sprite,
  { width: number; paths: Record<string, string> }
>();
function shape(sprite: Sprite) {
  const cached = geometry.get(sprite);
  if (cached) return cached;
  const paths: Record<string, string> = {};
  sprite.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const pixel = row[x],
        start = x;
      while (x < row.length && row[x] === pixel) x++;
      if (pixel !== ".")
        paths[pixel] =
          (paths[pixel] || "") + `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  });
  const result = { width: Math.max(...sprite.map((row) => row.length)), paths };
  geometry.set(sprite, result);
  return result;
}
export function PixelSprite({
  sprite,
  palette,
  className = "",
}: {
  sprite: Sprite;
  palette: Palette;
  className?: string;
}) {
  const { width, paths } = shape(sprite);
  return (
    <svg
      className={`pixel-sprite ${className}`}
      viewBox={`0 0 ${width} ${sprite.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {Object.entries(paths).map(([pixel, d]) =>
        palette[pixel] ? (
          <path key={pixel} d={d} fill={palette[pixel]} />
        ) : null,
      )}
    </svg>
  );
}
export { suits } from "./pixel-art";
