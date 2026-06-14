// Paramètres de génération procédurale des spéciales (PRD 07). Donnée inerte :
// elle fournit au générateur (domain/trackgen, qui n'importe pas data/) la palette,
// la table d'obstacles et les bornes (largeur de couloir, densité d'obstacles…).

import type { GenConfig } from '../domain/trackgen';
import { O } from './obstacles';
import { S } from './surfaces';

export const GEN: GenConfig = {
  width: 40,
  height: 24,
  tileSize: 36,
  columns: 7,
  laneWidth: 3, // ≥ marge pour la voiture la plus rapide (terminable au ralenti)
  roughChance: 0.45, // proportion de tronçons en terre/gravier (P4)
  obstacleDensity: 0.1, // proba d'obstacle sur une tuile de bord (hors ligne de course)
  roadId: 'ROAD',
  roughIds: ['DIRT', 'GRAVEL'],
  obstacleIds: ['TREE', 'BALES'],
  outOfBounds: 'WALL',
  palette: S,
  obstacles: O,
};
