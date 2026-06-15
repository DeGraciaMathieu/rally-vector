import { describe, expect, it } from 'vitest';
import { surfaceAt } from '../src/domain/track';
import { generateTrack, isTerminable } from '../src/domain/trackgen';
import { crossesForward, Segment } from '../src/domain/geometry';
import { Vec2 } from '../src/domain/vec2';
import { GEN } from '../src/data/genParams';

const MIN_COVERAGE = 0.25; // part minimale de tuiles roulables (réduction des marges mortes)

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

  it('couverture roulable : le tracé remplit la carte (peu de marges mortes)', () => {
    for (const seed of [0, 7, 42, 314, 999]) {
      const t = generateTrack(seed, GEN);
      let drivable = 0;
      for (const tile of t.tiles) if (!t.palette[tile.surface].solid) drivable++;
      expect(drivable / t.tiles.length).toBeGreaterThanOrEqual(MIN_COVERAGE);
    }
  });

  it('anti-fusion : les passes parallèles ne fusionnent pas (couloirs séparés, ≤ laneWidthMax)', () => {
    for (const seed of [0, 1, 5, 42, 123]) {
      const t = generateTrack(seed, GEN);
      // Sur une colonne au milieu de la carte, on doit voir des bandes roulables
      // distinctes séparées par du mur, chacune d'épaisseur bornée -> jamais de plaza.
      const c = Math.floor(t.width / 2);
      let run = 0;
      let groups = 0;
      for (let r = 0; r < t.height; r++) {
        if (!t.palette[t.tiles[r * t.width + c].surface].solid) {
          run++;
        } else {
          if (run > 0) groups++;
          expect(run).toBeLessThanOrEqual(GEN.laneWidthMax); // pas de fusion verticale
          run = 0;
        }
      }
      if (run > 0) {
        groups++;
        expect(run).toBeLessThanOrEqual(GEN.laneWidthMax);
      }
      expect(groups).toBeGreaterThanOrEqual(2); // serpentin : plusieurs passes séparées
    }
  });

  it('trajet A→B : départ et arrivée roulables, gates sur la piste, ordre cohérent', () => {
    for (const seed of [0, 7, 99, 500, 999]) {
      const t = generateTrack(seed, GEN);
      expect(surfaceAt(t, t.start.pos.x, t.start.pos.y).solid).toBe(false); // départ sur piste
      const mid = (g: Segment): Vec2 => ({ x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 });
      for (const cp of [...t.checkpoints, t.finishLine]) {
        const m = mid(cp);
        expect(surfaceAt(t, m.x, m.y).solid).toBe(false); // chaque porte sur la piste
      }
      const fm = mid(t.finishLine);
      // départ en haut, arrivée en bas du serpentin : éloignés verticalement (A→B)
      expect(Math.abs(fm.y - t.start.pos.y)).toBeGreaterThan(t.height * t.tileSize * 0.4);
    }
  });

  it('portes orientées selon le sens local : franchissables dans un sens, pas l’autre', () => {
    const t = generateTrack(42, GEN);
    for (const gate of [...t.checkpoints, t.finishLine]) {
      const m = { x: (gate.a.x + gate.b.x) / 2, y: (gate.a.y + gate.b.y) / 2 };
      const d = { x: gate.b.x - gate.a.x, y: gate.b.y - gate.a.y };
      const u = { x: d.y, y: -d.x }; // normale telle que -u -> +u soit le sens AVANT
      const prev = { x: m.x - u.x * 0.01, y: m.y - u.y * 0.01 };
      const nextP = { x: m.x + u.x * 0.01, y: m.y + u.y * 0.01 };
      expect(crossesForward(gate, prev, nextP)).toBe(true); // bon sens
      expect(crossesForward(gate, nextP, prev)).toBe(false); // contresens refusé
    }
  });

  it('largeur de couloir contenue (≤ laneWidthMax sur une ligne droite)', () => {
    const widths = new Set<number>();
    for (const seed of [0, 1, 2, 5, 11, 42, 100, 314]) {
      const t = generateTrack(seed, GEN);
      // mesure autour du centre de l'arrivée (ligne droite, sens horizontal)
      const cf = Math.floor((t.finishLine.a.x + t.finishLine.b.x) / 2 / t.tileSize);
      const rf = Math.floor((t.finishLine.a.y + t.finishLine.b.y) / 2 / t.tileSize);
      let w = 1;
      for (let r = rf - 1; r >= 0 && !t.palette[t.tiles[r * t.width + cf].surface].solid; r--) w++;
      for (let r = rf + 1; r < t.height && !t.palette[t.tiles[r * t.width + cf].surface].solid; r++) w++;
      expect(w).toBeGreaterThanOrEqual(GEN.laneWidth);
      expect(w).toBeLessThanOrEqual(GEN.laneWidthMax);
      widths.add(w);
    }
    expect(widths.size).toBeGreaterThan(1); // bords irréguliers : largeur non constante
  });

  it('sols en taches : transitions de surface au sein du couloir (pas de blocs uniformes)', () => {
    const t = generateTrack(42, GEN);
    let transitions = 0;
    for (let r = 0; r < t.height; r++)
      for (let c = 0; c + 1 < t.width; c++) {
        const a = t.tiles[r * t.width + c];
        const b = t.tiles[r * t.width + c + 1];
        if (!t.palette[a.surface].solid && !t.palette[b.surface].solid && a.surface !== b.surface) transitions++;
      }
    expect(transitions).toBeGreaterThan(0);
  });

  it('eau : flaques présentes et bornées en couverture', () => {
    const t = generateTrack(7, GEN);
    let water = 0;
    for (const tile of t.tiles) if (tile.surface === GEN.waterId) water++;
    expect(water).toBeGreaterThan(0);
    const r = GEN.waterPatchRadius;
    expect(water).toBeLessThanOrEqual(GEN.waterPatches * (2 * r + 1) ** 2);
  });

  it('aucun obstacle à proximité de la ligne d’arrivée', () => {
    for (const seed of [0, 1, 7, 42, 123, 500, 999]) {
      const t = generateTrack(seed, GEN);
      const fc = Math.floor((t.finishLine.a.x + t.finishLine.b.x) / 2 / t.tileSize);
      const fr = Math.floor((t.finishLine.a.y + t.finishLine.b.y) / 2 / t.tileSize);
      for (let r = 0; r < t.height; r++)
        for (let c = 0; c < t.width; c++) {
          if (!t.tiles[r * t.width + c].obstacle) continue;
          const near = Math.abs(c - fc) <= GEN.finishClearRadius && Math.abs(r - fr) <= GEN.finishClearRadius;
          expect(near).toBe(false);
        }
    }
  });

  it('obstacles : présents, regroupés, jamais sur le mur', () => {
    const t = generateTrack(123, GEN);
    const obstacles: { c: number; r: number }[] = [];
    for (let r = 0; r < t.height; r++)
      for (let c = 0; c < t.width; c++) {
        const tile = t.tiles[r * t.width + c];
        if (t.palette[tile.surface].solid) {
          expect(tile.obstacle).toBeUndefined();
        } else if (tile.obstacle) {
          obstacles.push({ c, r });
        }
      }
    expect(obstacles.length).toBeGreaterThan(0);
    const near = 2 * GEN.obstacleClusterRadius;
    const grouped = obstacles.filter((o) =>
      obstacles.some((q) => q !== o && Math.abs(q.c - o.c) <= near && Math.abs(q.r - o.r) <= near),
    );
    expect(grouped.length).toBeGreaterThan(obstacles.length / 2);
  });
});
