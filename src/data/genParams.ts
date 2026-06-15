// Paramètres de génération procédurale des spéciales (PRD 07). Donnée inerte :
// elle fournit au générateur (domain/trackgen, qui n'importe pas data/) la palette,
// la table d'obstacles et les bornes (largeur de couloir, densité d'obstacles…).

import type { GenConfig } from '../domain/trackgen';
import { O } from './obstacles';
import { S } from './surfaces';

export const GEN: GenConfig = {
  width: 28,
  height: 24,
  tileSize: 36,
  columns: 5,
  laneWidth: 3, // largeur MINIMALE garantie (spine) ≥ marge pour la voiture la plus rapide
  laneWidthMax: 5, // largeur MAX après dilatation organique des bords
  surfaceNoiseScale: 5, // échelle (tuiles) des taches de sol (P4) — plus grand = taches larges
  edgeThreshold: 0.45, // seuil de dilatation des bords (haut = couloir plus étroit)
  roughChance: 0.45, // part de sol terre/gravier dans le champ de bruit (P4)
  waterPatches: 3, // nombre de flaques d'eau (hazard ponctuel)
  waterPatchRadius: 1, // rayon (tuiles) d'une flaque
  obstacleClusters: 4, // nombre de foyers d'obstacles (regroupés, pas éparpillés)
  obstacleClusterRadius: 2, // rayon (tuiles) d'un foyer
  obstacleDensity: 0.35, // proba d'obstacle sur une tuile DANS un foyer (hors spine)
  roadId: 'ROAD',
  roughIds: ['DIRT', 'GRAVEL'],
  waterId: 'WATER',
  obstacleIds: ['TREE', 'BALES'],
  outOfBounds: 'WALL',
  palette: S,
  obstacles: O,
};
