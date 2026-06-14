// Type d'un circuit + lookups purs. L'INSTANCE d'un circuit est une donnée
// (data/tracks/*.ts) ; ici, seulement la forme et la lecture, sans DOM ni effet.

import { Surface } from './surfaces';
import { Vec2 } from './vec2';

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Track {
  readonly TILE: number;
  readonly COLS: number;
  readonly ROWS: number;
  readonly grid: readonly Surface[]; // longueur COLS*ROWS, indexé r*COLS+c
  readonly outOfBounds: Surface; // surface renvoyée hors-grille (mur, solide)
  readonly startPos: Vec2;
  readonly finishX: number; // ligne d'arrivée verticale
  readonly checkpoint: Rect; // à valider avant qu'une boucle compte
}

export const trackWidth = (t: Track): number => t.COLS * t.TILE;
export const trackHeight = (t: Track): number => t.ROWS * t.TILE;

export function surfaceAt(t: Track, x: number, y: number): Surface {
  const c = Math.floor(x / t.TILE);
  const r = Math.floor(y / t.TILE);
  if (c < 0 || r < 0 || c >= t.COLS || r >= t.ROWS) return t.outOfBounds;
  return t.grid[r * t.COLS + c];
}

export const isSolid = (t: Track, x: number, y: number): boolean =>
  surfaceAt(t, x, y).solid;
