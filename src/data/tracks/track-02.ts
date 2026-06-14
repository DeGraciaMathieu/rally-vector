// Circuit 02 — tracé manuel plus technique : voies 2 tuiles de large (au lieu de 3),
// surfaces plus glissantes (terre/gravier/flaques) et 4 checkpoints ordonnés. Même
// dimensions de grille que le circuit 01 (canvas identique). Iso-format, pas iso-visuel.

import type { SurfaceId } from '../../domain/surfaces';
import type { ObstacleId } from '../../domain/obstacles';
import type { Tile, Track } from '../../domain/track';
import { O } from '../obstacles';
import { S } from '../surfaces';

const TILE = 36;
const WIDTH = 24;
const HEIGHT = 16;

// Anneau roulable étroit : bandes de 2 tuiles.
const inRing = (c: number, r: number): boolean => {
  const topBot = (r >= 1 && r <= 2) || (r >= 13 && r <= 14);
  const leftRite = (c >= 1 && c <= 2) || (c >= 21 && c <= 22);
  const bandH = topBot && c >= 1 && c <= 22;
  const bandV = leftRite && r >= 1 && r <= 14;
  return bandH || bandV;
};

const buildTiles = (): Tile[] => {
  const tiles: Tile[] = new Array(WIDTH * HEIGHT);
  const idx = (c: number, r: number): number => r * WIDTH + c;

  for (let r = 0; r < HEIGHT; r++)
    for (let c = 0; c < WIDTH; c++) tiles[idx(c, r)] = { surface: inRing(c, r) ? 'ROAD' : 'WALL' };

  const paint = (c0: number, r0: number, c1: number, r1: number, surf: SurfaceId): void => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (inRing(c, r)) tiles[idx(c, r)] = { ...tiles[idx(c, r)], surface: surf };
  };
  paint(21, 1, 22, 14, 'DIRT'); // toute la droite = terre
  paint(1, 13, 22, 14, 'GRAVEL'); // toute la ligne du bas = gravier
  paint(10, 13, 12, 14, 'WATER'); // flaque au milieu du bas
  paint(1, 9, 2, 14, 'GRAVEL'); // sortie du virage bas-gauche = gravier
  paint(17, 1, 20, 2, 'GRAVEL'); // corde du virage haut-droite = gravier

  // Obstacle de design : un arbre sur la ligne droite du haut, sur la voie
  // extérieure (rang 1) — à lire et contourner par la voie intérieure (rang 2).
  const place = (c: number, r: number, obstacle: ObstacleId): void => {
    tiles[idx(c, r)] = { ...tiles[idx(c, r)], obstacle };
  };
  place(13, 1, 'TREE');
  // Bottes de paille sur la voie intérieure du haut : cible souple (en mode
  // conséquences, un contact lent donne un tête-à-queue plutôt qu'une fin).
  place(15, 2, 'BALES');

  return tiles;
};

// start : ligne droite du haut, sens horaire (vers la droite).
const start = { c: 4, r: 1 };

export const track02: Track = {
  id: 'track-02',
  name: 'Spéciale technique',
  width: WIDTH,
  height: HEIGHT,
  tileSize: TILE,
  tiles: buildTiles(),
  palette: S,
  obstacles: O,
  outOfBounds: 'WALL',
  start: { pos: { x: (start.c + 0.5) * TILE, y: (start.r + 0.5) * TILE }, heading: 0 },
  finishLine: { a: { x: 3 * TILE, y: 1 * TILE }, b: { x: 3 * TILE, y: 3 * TILE } },
  // Quatre portes ordonnées dans le sens horaire : droite, bas (x2), gauche.
  checkpoints: [
    { a: { x: 23 * TILE, y: 8 * TILE }, b: { x: 21 * TILE, y: 8 * TILE } }, // droite, vers le bas
    { a: { x: 16 * TILE, y: 15 * TILE }, b: { x: 16 * TILE, y: 13 * TILE } }, // bas-droite, vers la gauche
    { a: { x: 8 * TILE, y: 15 * TILE }, b: { x: 8 * TILE, y: 13 * TILE } }, // bas-gauche, vers la gauche
    { a: { x: 1 * TILE, y: 8 * TILE }, b: { x: 3 * TILE, y: 8 * TILE } }, // gauche, vers le haut
  ],
};
