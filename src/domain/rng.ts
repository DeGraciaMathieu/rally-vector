// RNG seedé (mulberry32) — porté dans RaceState pour préparer P5 (fantômes,
// tête-à-queue). Immuable : nextRandom renvoie la valeur ET le nouvel état.
// Pas encore consommé par le gameplay au PRD 00, mais déjà déterministe.

export interface RngState {
  readonly s: number; // entier 32 bits
}

export const createRng = (seed: number): RngState => ({ s: seed >>> 0 });

export function nextRandom(rng: RngState): { value: number; rng: RngState } {
  let t = (rng.s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { s: t >>> 0 } };
}
