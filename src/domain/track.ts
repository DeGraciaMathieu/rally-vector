// Type d'un circuit data-driven + lookups purs. L'INSTANCE d'un circuit est une
// donnée (data/tracks/*.ts) ; ici, seulement la forme et la lecture, sans DOM ni
// effet. La tilemap est une liste de Tile : un SOL (sous la voiture) + un OBSTACLE
// optionnel (posé dessus). Les palettes (données) résolvent id -> Surface/Obstacle.

import { ContactPolicy } from './collision';
import { Segment } from './geometry';
import { Obstacle, ObstacleId } from './obstacles';
import { Surface, SurfaceId } from './surfaces';
import { Vec2 } from './vec2';

export interface TrackStart {
  readonly pos: Vec2;
  readonly heading: number; // angle initial de la voiture (rad)
}

// Une case : un sol obligatoire + un obstacle optionnel posé par-dessus.
export interface Tile {
  readonly surface: SurfaceId;
  readonly obstacle?: ObstacleId;
}

// 'loop' = circuit à boucler (tours/laps) ; 'stage' = spéciale point-à-point A→B
// (franchir l'arrivée une fois = étape terminée), à la mode rallye.
export type TrackKind = 'loop' | 'stage';

export interface Track {
  readonly id: string;
  readonly name: string;
  readonly kind: TrackKind;
  readonly width: number; // en tuiles
  readonly height: number; // en tuiles
  readonly tileSize: number; // px par tuile
  readonly tiles: readonly Tile[]; // longueur width*height, indexé r*width+c
  readonly palette: Readonly<Record<SurfaceId, Surface>>; // résolution id -> Surface
  readonly obstacles: Readonly<Record<ObstacleId, Obstacle>>; // résolution id -> Obstacle
  readonly outOfBounds: SurfaceId; // hors-grille (mur, solide)
  readonly start: TrackStart;
  readonly finishLine: Segment; // orienté selon le sens de course
  readonly checkpoints: readonly Segment[]; // ORDONNÉS, orientés sens de course
}

export const trackWidthPx = (t: Track): number => t.width * t.tileSize;
export const trackHeightPx = (t: Track): number => t.height * t.tileSize;

interface TileAt {
  readonly tile: Tile;
  readonly c: number;
  readonly r: number;
}

// Tuile contenant (x, y), ou null si hors-grille.
function tileAt(t: Track, x: number, y: number): TileAt | null {
  const c = Math.floor(x / t.tileSize);
  const r = Math.floor(y / t.tileSize);
  if (c < 0 || r < 0 || c >= t.width || r >= t.height) return null;
  return { tile: t.tiles[r * t.width + c], c, r };
}

// Sol sous la voiture (grip/drag). Hors-grille = surface `outOfBounds`.
export function surfaceAt(t: Track, x: number, y: number): Surface {
  const at = tileAt(t, x, y);
  if (!at) return t.palette[t.outOfBounds];
  return t.palette[at.tile.surface];
}

// Obstacle posé sur la tuile contenant (x, y), ou null. Indépendant du sol.
export function obstacleAt(t: Track, x: number, y: number): Obstacle | null {
  const at = tileAt(t, x, y);
  if (!at || !at.tile.obstacle) return null;
  return t.obstacles[at.tile.obstacle];
}

// (x, y) est-il bloquant ? Sol solide (mur, hors-grille) OU disque d'un obstacle
// solide (hitbox sous-tuile centrée sur la tuile).
export function isSolid(t: Track, x: number, y: number): boolean {
  const at = tileAt(t, x, y);
  if (!at) return t.palette[t.outOfBounds].solid;
  if (t.palette[at.tile.surface].solid) return true;
  const obs = at.tile.obstacle ? t.obstacles[at.tile.obstacle] : undefined;
  if (obs && obs.solid && obs.radius > 0) {
    const cx = (at.c + 0.5) * t.tileSize;
    const cy = (at.r + 0.5) * t.tileSize;
    const rad = obs.radius * t.tileSize;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) return true;
  }
  return false;
}

// Politique de contact de la cible solide en (x, y). L'obstacle solide prime sur
// le sol ; défaut 'fatal' (préserve P2). À n'appeler que sur un point solide.
export function contactAt(t: Track, x: number, y: number): ContactPolicy {
  const at = tileAt(t, x, y);
  if (!at) return t.palette[t.outOfBounds].contact ?? 'fatal';
  const obs = at.tile.obstacle ? t.obstacles[at.tile.obstacle] : undefined;
  if (obs && obs.solid && obs.radius > 0) {
    const cx = (at.c + 0.5) * t.tileSize;
    const cy = (at.r + 0.5) * t.tileSize;
    const rad = obs.radius * t.tileSize;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) return obs.contact ?? 'fatal';
  }
  return t.palette[at.tile.surface].contact ?? 'fatal';
}
