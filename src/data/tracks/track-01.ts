// Circuit 01 — le tracé du proto, extrait en données. La grille est AUTORÉE
// (anneau roulable + zones de surface peintes) puis figée : c'est une table, pas
// de la logique de gameplay. Un seul circuit au PRD 00 (la procgen = PRD 07).

import type { Surface } from '../../domain/surfaces';
import type { Track } from '../../domain/track';
import { S } from '../surfaces';

const TILE = 36;
const COLS = 24;
const ROWS = 16;

// Anneau roulable : deux bandes horizontales + deux bandes verticales.
const inRing = (c: number, r: number): boolean => {
  const topBot = (r >= 1 && r <= 3) || (r >= 12 && r <= 14);
  const leftRite = (c >= 1 && c <= 3) || (c >= 20 && c <= 22);
  const bandH = topBot && c >= 1 && c <= 22;
  const bandV = leftRite && r >= 1 && r <= 14;
  return bandH || bandV;
};

const buildGrid = (): Surface[] => {
  const grid: Surface[] = new Array(COLS * ROWS);
  const idx = (c: number, r: number): number => r * COLS + c;

  // 1) base : anneau = ROUTE, le reste = MUR.
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) grid[idx(c, r)] = inRing(c, r) ? S.ROAD : S.WALL;

  // 2) zones de surface peintes (rectangles), bornées à l'anneau.
  const paint = (c0: number, r0: number, c1: number, r1: number, surf: Surface): void => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (inRing(c, r)) grid[idx(c, r)] = surf;
  };
  paint(6, 12, 17, 14, S.DIRT); // ligne droite du bas = terre
  paint(17, 1, 22, 3, S.GRAVEL); // corde du virage rapide haut-droite = gravier
  paint(1, 12, 5, 14, S.GRAVEL); // sortie du virage bas-gauche = gravier
  paint(11, 13, 12, 14, S.WATER); // flaque posée sur la terre (démo obstacle)

  return grid;
};

// start : sur la ligne droite du haut, sens horaire (vers la droite).
const start = { c: 6, r: 2 };

export const track01: Track = {
  TILE,
  COLS,
  ROWS,
  grid: buildGrid(),
  outOfBounds: S.WALL,
  startPos: { x: (start.c + 0.5) * TILE, y: (start.r + 0.5) * TILE },
  // ligne d'arrivée (verticale) à gauche du départ : franchie après un tour complet.
  finishX: 4 * TILE,
  // checkpoint (bas) à valider avant qu'une boucle compte.
  checkpoint: { x0: 9 * TILE, y0: 12 * TILE, x1: 15 * TILE, y1: 15 * TILE },
};
