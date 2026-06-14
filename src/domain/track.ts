// Type d'un circuit data-driven + lookups purs. L'INSTANCE d'un circuit est une
// donnée (data/tracks/*.ts) ; ici, seulement la forme et la lecture, sans DOM ni
// effet. La tilemap est une liste d'IDs ; la palette (donnée) résout id -> Surface.

import { Segment } from './geometry';
import { Surface, SurfaceId } from './surfaces';
import { Vec2 } from './vec2';

export interface TrackStart {
  readonly pos: Vec2;
  readonly heading: number; // angle initial de la voiture (rad)
}

export interface Track {
  readonly id: string;
  readonly name: string;
  readonly width: number; // en tuiles
  readonly height: number; // en tuiles
  readonly tileSize: number; // px par tuile
  readonly tiles: readonly SurfaceId[]; // longueur width*height, indexé r*width+c
  readonly palette: Readonly<Record<SurfaceId, Surface>>; // résolution id -> Surface
  readonly outOfBounds: SurfaceId; // hors-grille (mur, solide)
  readonly start: TrackStart;
  readonly finishLine: Segment; // orienté selon le sens de course
  readonly checkpoints: readonly Segment[]; // ORDONNÉS, orientés sens de course
}

export const trackWidthPx = (t: Track): number => t.width * t.tileSize;
export const trackHeightPx = (t: Track): number => t.height * t.tileSize;

export function surfaceAt(t: Track, x: number, y: number): Surface {
  const c = Math.floor(x / t.tileSize);
  const r = Math.floor(y / t.tileSize);
  if (c < 0 || r < 0 || c >= t.width || r >= t.height) return t.palette[t.outOfBounds];
  return t.palette[t.tiles[r * t.width + c]];
}

export const isSolid = (t: Track, x: number, y: number): boolean =>
  surfaceAt(t, x, y).solid;
