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

  it('la ligne de course (départ, checkpoints, arrivée) est dégagée : roulable et sans obstacle', () => {
    for (const seed of [0, 3, 42, 314, 777]) {
      const t = generateTrack(seed, GEN);
      const gates = [t.finishLine, ...t.checkpoints];
      const points = [t.start.pos, ...gates.map((g) => ({ x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 }))];
      for (const p of points) {
        const c = Math.floor(p.x / t.tileSize);
        const r = Math.floor(p.y / t.tileSize);
        const tile = t.tiles[r * t.width + c];
        expect(t.palette[tile.surface].solid).toBe(false); // roulable
        expect(tile.obstacle).toBeUndefined(); // jamais d'obstacle sur la ligne de course
      }
    }
  });

  it('bords irréguliers : la largeur du couloir varie entre laneWidth et laneWidthMax', () => {
    // On mesure sur la dernière ligne droite (vers l'arrivée), garantie purement
    // horizontale (ys[columns] === ys[columns-1]) : pas de jonction qui élargit le couloir.
    const widths = new Set<number>();
    for (const seed of [0, 1, 2, 5, 11, 42, 100, 314]) {
      const t = generateTrack(seed, GEN);
      const cf = Math.floor((t.finishLine.a.x + t.finishLine.b.x) / 2 / t.tileSize);
      const rf = Math.floor((t.finishLine.a.y + t.finishLine.b.y) / 2 / t.tileSize);
      for (const c of [cf, cf + 1, cf + 2]) {
        if (t.palette[t.tiles[rf * t.width + c].surface].solid) continue;
        let w = 1;
        for (let r = rf - 1; r >= 0 && !t.palette[t.tiles[r * t.width + c].surface].solid; r--) w++;
        for (let r = rf + 1; r < t.height && !t.palette[t.tiles[r * t.width + c].surface].solid; r++) w++;
        expect(w).toBeGreaterThanOrEqual(GEN.laneWidth);
        expect(w).toBeLessThanOrEqual(GEN.laneWidthMax);
        widths.add(w);
      }
    }
    expect(widths.size).toBeGreaterThan(1); // la largeur n'est pas constante
  });

  it('sols en taches : transitions de surface au sein du couloir (pas de blocs uniformes)', () => {
    const t = generateTrack(42, GEN);
    let transitions = 0;
    for (let r = 0; r < t.height; r++)
      for (let c = 0; c + 1 < t.width; c++) {
        const a = t.tiles[r * t.width + c];
        const b = t.tiles[r * t.width + c + 1];
        const aDrivable = !t.palette[a.surface].solid;
        const bDrivable = !t.palette[b.surface].solid;
        if (aDrivable && bDrivable && a.surface !== b.surface) transitions++;
      }
    expect(transitions).toBeGreaterThan(0); // au moins une transition de sol horizontale
  });

  it('eau : flaques présentes et bornées en couverture', () => {
    const t = generateTrack(7, GEN);
    let water = 0;
    for (const tile of t.tiles) if (tile.surface === GEN.waterId) water++;
    expect(water).toBeGreaterThan(0);
    const r = GEN.waterPatchRadius;
    const maxPerPatch = (2 * r + 1) ** 2; // borne haute lâche d'un disque
    expect(water).toBeLessThanOrEqual(GEN.waterPatches * maxPerPatch);
  });

  it('obstacles : présents, regroupés, jamais sur le mur', () => {
    const t = generateTrack(123, GEN);
    const obstacles: { c: number; r: number }[] = [];
    for (let r = 0; r < t.height; r++)
      for (let c = 0; c < t.width; c++) {
        const tile = t.tiles[r * t.width + c];
        if (t.palette[tile.surface].solid) {
          expect(tile.obstacle).toBeUndefined(); // pas d'obstacle sur le mur
        } else if (tile.obstacle) {
          obstacles.push({ c, r });
        }
      }
    expect(obstacles.length).toBeGreaterThan(0);
    // regroupés : chaque obstacle a un voisin proche (dans 2× le rayon de foyer)
    const near = 2 * GEN.obstacleClusterRadius;
    const grouped = obstacles.filter((o) =>
      obstacles.some((q) => q !== o && Math.abs(q.c - o.c) <= near && Math.abs(q.r - o.r) <= near),
    );
    expect(grouped.length).toBeGreaterThan(obstacles.length / 2); // majorité en grappes
  });
});
