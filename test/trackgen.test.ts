import { describe, expect, it } from 'vitest';
import { surfaceAt } from '../src/domain/track';
import { generateTrack, isTerminable } from '../src/domain/trackgen';
import { GEN } from '../src/data/genParams';

describe('trackgen', () => {
  it('même seed -> circuit identique (reproductibilité, P5)', () => {
    expect(JSON.stringify(generateTrack(42, GEN))).toEqual(JSON.stringify(generateTrack(42, GEN)));
  });

  it('deux seeds -> circuits différents', () => {
    expect(JSON.stringify(generateTrack(1, GEN))).not.toEqual(JSON.stringify(generateTrack(2, GEN)));
  });

  it('sur 1000 seeds : 100 % de spéciales terminables (départ -> arrivée)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(isTerminable(generateTrack(seed, GEN))).toBe(true);
    }
  });

  it('checkpoints ordonnés gauche->droite, sur la piste, arrivée après le dernier', () => {
    for (const seed of [0, 7, 99, 500, 999]) {
      const t = generateTrack(seed, GEN);
      expect(t.checkpoints.length).toBe(GEN.columns - 1);
      let prevX = -Infinity;
      for (const cp of t.checkpoints) {
        expect(cp.a.x).toBeGreaterThan(prevX); // ordonnés en x
        prevX = cp.a.x;
        const mid = { x: (cp.a.x + cp.b.x) / 2, y: (cp.a.y + cp.b.y) / 2 };
        expect(surfaceAt(t, mid.x, mid.y).solid).toBe(false); // porte sur la piste
      }
      expect(t.finishLine.a.x).toBeGreaterThan(prevX); // arrivée après le dernier CP
      expect(surfaceAt(t, t.start.pos.x, t.start.pos.y).solid).toBe(false); // départ sur piste
    }
  });

  it('densité d’obstacles dans les bornes et jamais sur le mur', () => {
    const t = generateTrack(123, GEN);
    let drivable = 0;
    let withObstacle = 0;
    for (const tile of t.tiles) {
      if (t.palette[tile.surface].solid) {
        expect(tile.obstacle).toBeUndefined(); // pas d'obstacle sur le mur
      } else {
        drivable++;
        if (tile.obstacle) withObstacle++;
      }
    }
    const ratio = withObstacle / drivable;
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(GEN.obstacleDensity + 0.1); // borne haute lâche
  });
});
