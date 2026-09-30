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
/** Avalanche nearby seeds before assigning personal profiles or generation bands. */
export function mixSeed(seed:number,salt=0) {
  let x=(seed^salt)>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b);
  x=Math.imul(x^(x>>>13),0xc2b2ae35);
  return (x^(x>>>16))>>>0 || 1;
}
