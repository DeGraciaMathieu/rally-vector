import { describe, expect, it } from 'vitest';
import { RngState, createRng, nextRandom } from '../src/domain/rng';

const sample = (seed: number, n: number): number[] => {
  let rng: RngState = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextRandom(rng);
    out.push(r.value);
    rng = r.rng;
  }
  return out;
};

describe('rng (mulberry32 seedé)', () => {
  it('même seed -> même flux', () => {
    expect(sample(42, 8)).toEqual(sample(42, 8));
  });

  it('deux seeds -> flux différents', () => {
    expect(sample(42, 8)).not.toEqual(sample(43, 8));
  });

  it('produit des valeurs dans [0, 1)', () => {
    for (const v of sample(7, 50)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
