// Small seeded RNG (mulberry32) so generated problems are reproducible:
// the same seed gives the same numbers, which duels and tests rely on.
export type Rng = () => number;

export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

export const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

export const shuffle = <T,>(rng: Rng, items: readonly T[]): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
