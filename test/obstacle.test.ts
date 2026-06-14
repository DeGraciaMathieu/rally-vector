import { describe, expect, it } from 'vitest';
import type { Obstacle } from '../src/domain/obstacles';
import type { Tile, Track } from '../src/domain/track';
import { isSolid, obstacleAt, surfaceAt } from '../src/domain/track';
import { O } from '../src/data/obstacles';
import { S } from '../src/data/surfaces';

const TILE = 36;
// Obstacle de test : hazard NON solide (ne crashe pas).
const HAZARD: Obstacle = { id: 'PUDDLE', label: 'flaque', solid: false, hazard: true, radius: 0.4 };

// Grille 3x3 toute en ROAD ; la tuile centrale (1,1) est paramétrable.
function makeTrack(center: Tile): Track {
  const tiles: Tile[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) tiles.push(r === 1 && c === 1 ? center : { surface: 'ROAD' });
  return {
    id: 't',
    name: 't',
    kind: 'loop',
    width: 3,
    height: 3,
    tileSize: TILE,
    tiles,
    palette: S,
    obstacles: { ...O, PUDDLE: HAZARD },
    outOfBounds: 'WALL',
    start: { pos: { x: 0, y: 0 }, heading: 0 },
    finishLine: { a: { x: 0, y: 0 }, b: { x: 0, y: TILE } },
    checkpoints: [],
  };
}

const center = { x: 1.5 * TILE, y: 1.5 * TILE }; // centre de la tuile (1,1)

describe('obstacleAt', () => {
  it('résout l’obstacle posé sur la tuile, null sinon', () => {
    const t = makeTrack({ surface: 'ROAD', obstacle: 'TREE' });
    expect(obstacleAt(t, center.x, center.y)?.id).toBe('TREE');
    expect(obstacleAt(t, 0.5 * TILE, 0.5 * TILE)).toBeNull(); // tuile sans obstacle
  });

  it('superpose sol + obstacle : surfaceAt lit le sol, obstacleAt lit l’obstacle', () => {
    const t = makeTrack({ surface: 'ROAD', obstacle: 'TREE' });
    expect(surfaceAt(t, center.x, center.y).id).toBe('ROAD');
    expect(surfaceAt(t, center.x, center.y).solid).toBe(false);
    expect(obstacleAt(t, center.x, center.y)?.id).toBe('TREE');
  });
});

describe('isSolid avec obstacle', () => {
  it('un obstacle solide bloque au centre de la tuile (hitbox sous-tuile)', () => {
    const t = makeTrack({ surface: 'ROAD', obstacle: 'TREE' });
    expect(isSolid(t, center.x, center.y)).toBe(true);
    // hors du disque (coin de la tuile) : le sol ROAD n'est pas solide
    expect(isSolid(t, 1 * TILE + 2, 1 * TILE + 2)).toBe(false);
  });

  it('un obstacle hazard non-solide ne crashe pas', () => {
    const t = makeTrack({ surface: 'ROAD', obstacle: 'PUDDLE' });
    expect(obstacleAt(t, center.x, center.y)?.hazard).toBe(true);
    expect(isSolid(t, center.x, center.y)).toBe(false);
  });
});
