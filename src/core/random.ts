export function random(seed: number): [number, number] {
  let x = seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return [(x >>> 0) / 4294967296, x >>> 0];
}
export function shuffle<T>(
  items: readonly T[],
  seed: number,
): { items: T[]; seed: number } {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const [n, next] = random(seed);
    seed = next;
    const j = Math.floor(n * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { items: a, seed };
}
export function seedNow() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] || 1;
}
