// Table des OBSTACLES posables sur les tuiles. Donnée inerte : ajouter un obstacle
// = une ligne ici + une branche de rendu, zéro logique de jeu nouvelle (PRD 03).

import type { Obstacle, ObstacleId } from '../domain/obstacles';

export const O: Record<ObstacleId, Obstacle> = {
  // Arbre : solide (contact = crash, cf. PRD 04), hitbox = tronc/couronne centré.
  TREE: { id: 'TREE', label: 'arbre', solid: true, hazard: false, radius: 0.4 },
};
