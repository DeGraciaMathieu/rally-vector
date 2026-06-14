// Circuit 01 — le tracé du proto, au format data-driven (iso-visuel). La tilemap
// est AUTORÉE (anneau roulable + zones de surface peintes) puis figée : une table,
// pas de logique de gameplay. Portes (arrivée + checkpoints) en SEGMENTS orientés
// dans le sens horaire de la course. Un seul circuit historique ; procgen = PRD 07.

import type { SurfaceId } from '../../domain/surfaces';
import type { Track } from '../../domain/track';
import { S } from '../surfaces';

const TILE = 36;
const WIDTH = 24;
const HEIGHT = 16;

// Anneau roulable : deux bandes horizontales + deux bandes verticales.
const inRing = (c: number, r: number): boolean => {
  const topBot = (r >= 1 && r <= 3) || (r >= 12 && r <= 14);
  const leftRite = (c >= 1 && c <= 3) || (c >= 20 && c <= 22);
  const bandH = topBot && c >= 1 && c <= 22;
  const bandV = leftRite && r >= 1 && r <= 14;
  return bandH || bandV;
};

const buildTiles = (): SurfaceId[] => {
  const tiles: SurfaceId[] = new Array(WIDTH * HEIGHT);
  const idx = (c: number, r: number): number => r * WIDTH + c;

  // 1) base : anneau = ROUTE, le reste = MUR.
  for (let r = 0; r < HEIGHT; r++)
    for (let c = 0; c < WIDTH; c++) tiles[idx(c, r)] = inRing(c, r) ? 'ROAD' : 'WALL';

  // 2) zones de surface peintes (rectangles), bornées à l'anneau.
  const paint = (c0: number, r0: number, c1: number, r1: number, surf: SurfaceId): void => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (inRing(c, r)) tiles[idx(c, r)] = surf;
  };
  paint(6, 12, 17, 14, 'DIRT'); // ligne droite du bas = terre
  paint(17, 1, 22, 3, 'GRAVEL'); // corde du virage rapide haut-droite = gravier
  paint(1, 12, 5, 14, 'GRAVEL'); // sortie du virage bas-gauche = gravier
  paint(11, 13, 12, 14, 'WATER'); // flaque posée sur la terre (démo obstacle)

  return tiles;
};

// start : ligne droite du haut, sens horaire (vers la droite).
const start = { c: 6, r: 2 };

export const track01: Track = {
  id: 'track-01',
  name: 'Spéciale historique',
  width: WIDTH,
  height: HEIGHT,
  tileSize: TILE,
  tiles: buildTiles(),
  palette: S,
  outOfBounds: 'WALL',
  start: { pos: { x: (start.c + 0.5) * TILE, y: (start.r + 0.5) * TILE }, heading: 0 },
  // Ligne d'arrivée verticale sur la droite du haut, orientée a->b (vers le bas)
  // pour que le sens AVANT soit le franchissement vers la droite.
  finishLine: { a: { x: 4 * TILE, y: 1 * TILE }, b: { x: 4 * TILE, y: 4 * TILE } },
  // Checkpoints ordonnés dans le sens horaire : droite (bas), bas (gauche),
  // gauche (haut). Orientés a->b pour que le sens de course = sens avant.
  checkpoints: [
    { a: { x: 23 * TILE, y: 8 * TILE }, b: { x: 20 * TILE, y: 8 * TILE } }, // droite, vers le bas
    { a: { x: 12 * TILE, y: 15 * TILE }, b: { x: 12 * TILE, y: 12 * TILE } }, // bas, vers la gauche
    { a: { x: 1 * TILE, y: 8 * TILE }, b: { x: 4 * TILE, y: 8 * TILE } }, // gauche, vers le haut
  ],
};
