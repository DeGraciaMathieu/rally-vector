import { describe, expect, it } from 'vitest';
import { classifyContact, firstHit } from '../src/domain/collision';
import type { Tile, Track } from '../src/domain/track';
import { isSolid } from '../src/domain/track';
import { track01 } from '../src/data/tracks/track-01';
import { O } from '../src/data/obstacles';
import { S } from '../src/data/surfaces';

const TILE = 36;
// Grille 3x3 ROAD avec un arbre solide au centre (1,1).
const treeTrack: Track = {
  id: 't',
  name: 't',
  width: 3,
  height: 3,
  tileSize: TILE,
  tiles: Array.from({ length: 9 }, (_, i): Tile =>
    i === 4 ? { surface: 'ROAD', obstacle: 'TREE' } : { surface: 'ROAD' },
  ),
  palette: S,
  obstacles: O,
  outOfBounds: 'WALL',
  start: { pos: { x: 0, y: 0 }, heading: 0 },
  finishLine: { a: { x: 0, y: 0 }, b: { x: 0, y: TILE } },
  checkpoints: [],
};

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
    const start = track01.start.pos;
    const hit = firstHit(start.x, start.y, -50, start.y, solid);
    expect(hit).not.toBeNull();
  });

  it('déclenche firstHit sur un obstacle solide au milieu d’une tuile roulable', () => {
    const solid = (x: number, y: number): boolean => isSolid(treeTrack, x, y);
    const cy = 1.5 * TILE; // traverse la tuile centrale horizontalement
    const hit = firstHit(0, cy, 3 * TILE, cy, solid);
    expect(hit).not.toBeNull();
    // touché autour du centre (54 px), pas au bord de tuile
    expect(hit!.x).toBeGreaterThan(TILE);
    expect(hit!.x).toBeLessThan(2 * TILE);
  });
});

describe('classifyContact', () => {
  const TH = { fatalSpeed: 105, spinSpeed: 37.5 };

  it('cible fatale = toujours fatal, quelle que soit la vitesse', () => {
    expect(classifyContact('fatal', 10, TH, false)).toBe('fatal');
    expect(classifyContact('fatal', 200, TH, false)).toBe('fatal');
  });

  it('mode strict = toujours fatal, même cible souple', () => {
    expect(classifyContact('soft', 10, TH, true)).toBe('fatal');
    expect(classifyContact('soft', 50, TH, true)).toBe('fatal');
  });

  it('cible souple : graduation par vitesse à l’impact', () => {
    expect(classifyContact('soft', 120, TH, false)).toBe('fatal'); // >= fatalSpeed
    expect(classifyContact('soft', 60, TH, false)).toBe('spin'); // [spin, fatal[
    expect(classifyContact('soft', 20, TH, false)).toBe('graze'); // < spinSpeed
  });
});
