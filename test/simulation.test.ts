import { describe, expect, it } from 'vitest';
import { createRaceState } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import type { Tile, Track } from '../src/domain/track';
import { cars } from '../src/data/cars';
import { O } from '../src/data/obstacles';
import { S } from '../src/data/surfaces';
import { TUNING } from '../src/data/tuning';
import { advanceTurn } from '../src/systems/simulation';

const car = cars[0]; // équilibrée (gripFactor/dragFactor = 1, valeurs du proto)

const TILE = 36;

// Couloir horizontal de ROAD avec des bottes de paille (cible 'soft') en colonne 6 ;
// la voiture part en colonne 5, juste à gauche, pour heurter à vitesse contrôlée.
function corridor(): Track {
  const tiles: Tile[] = [];
  for (let c = 0; c < 10; c++)
    tiles.push(c === 6 ? { surface: 'ROAD', obstacle: 'BALES' } : { surface: 'ROAD' });
  return {
    id: 't',
    name: 't',
    kind: 'loop',
    width: 10,
    height: 1,
    tileSize: TILE,
    tiles,
    palette: S,
    obstacles: O,
    outOfBounds: 'WALL',
    start: { pos: { x: 5.5 * TILE, y: 0.5 * TILE }, heading: 0 },
    finishLine: { a: { x: 0, y: 0 }, b: { x: 0, y: TILE } },
    checkpoints: [],
  };
}

const track = corridor();
const initial = createRaceState(createRng(1), track.start);

describe('conséquences au contact (PRD 04)', () => {
  it('mode strict : tout contact sur cible souple reste fatal', () => {
    const s = advanceTurn(initial, track, TUNING, car, { x: 35, y: 0 }, true, false);
    expect(s.phase).toBe('crashed');
  });

  it('spin : arrêt + réorientation seedée, RNG consommé, reproductible', () => {
    // impulsion calibrée pour une vitesse d'impact dans la bande spin [0.25·maxSpeed, 0.7·maxSpeed]
    const a = advanceTurn(initial, track, TUNING, car, { x: 80, y: 0 }, false, false);
    const b = advanceTurn(initial, track, TUNING, car, { x: 80, y: 0 }, false, false);
    expect(a.phase).toBe('idle'); // pas de fin de course
    expect(a.car.vel).toEqual({ x: 0, y: 0 }); // tête-à-queue = arrêt
    expect(a.turns).toBe(1); // le tour compte
    expect(a.rng).not.toEqual(initial.rng); // RNG consommé (P5)
    expect(a).toEqual(b); // même seed + mêmes inputs -> même réorientation
  });

  it('graze : frôlement, garde de la vitesse, sans consommer le RNG', () => {
    const g = advanceTurn(initial, track, TUNING, car, { x: 35, y: 0 }, false, false);
    expect(g.phase).toBe('idle');
    expect(Math.hypot(g.car.vel.x, g.car.vel.y)).toBeGreaterThan(0); // pas d'arrêt
    expect(g.rng).toEqual(initial.rng); // un frôlement ne tire pas le RNG
  });

  it('impact rapide sur cible souple : fatal malgré le mode conséquences', () => {
    const f = advanceTurn(initial, track, TUNING, car, { x: 200, y: 0 }, false, false);
    expect(f.phase).toBe('crashed');
  });
});
