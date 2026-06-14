import { describe, expect, it } from 'vitest';
import { firstHit } from '../src/domain/collision';
import { isSolid } from '../src/domain/track';
import { track01 } from '../src/data/tracks/track-01';

describe('collision.firstHit', () => {
  it('détecte le premier point solide le long du segment', () => {
    const solid = (x: number): boolean => x >= 100;
    const hit = firstHit(0, 0, 200, 0, (x) => solid(x));
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(100, 6);
    expect(hit!.t).toBeGreaterThan(0);
    expect(hit!.t).toBeLessThanOrEqual(1);
  });

  it('renvoie null sur un segment entièrement libre', () => {
    const hit = firstHit(0, 0, 200, 0, () => false);
    expect(hit).toBeNull();
  });

  it("traite l'hors-grille comme solide", () => {
    // un point hors de la grille du circuit est solide (mur)
    expect(isSolid(track01, -5, 50)).toBe(true);
    const solid = (x: number, y: number): boolean => isSolid(track01, x, y);
    // depuis le départ vers la gauche hors-grille : on finit par taper
    const start = track01.startPos;
    const hit = firstHit(start.x, start.y, -50, start.y, solid);
    expect(hit).not.toBeNull();
  });
});
