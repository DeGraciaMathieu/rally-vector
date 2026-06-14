// Table des OBSTACLES posables sur les tuiles. Donnée inerte : ajouter un obstacle
// = une ligne ici + une branche de rendu, zéro logique de jeu nouvelle (PRD 03).

import type { Obstacle, ObstacleId } from '../domain/obstacles';

export const O: Record<ObstacleId, Obstacle> = {
  // Arbre : solide et TOUJOURS fatal (mur végétal), hitbox = tronc/couronne centré.
  TREE: { id: 'TREE', label: 'arbre', solid: true, hazard: false, radius: 0.4, contact: 'fatal' },
  // Bottes de paille : solide mais cible SOUPLE — selon la vitesse, fin / tête-à-queue
  // / frôlement (PRD 04). N'a d'effet gradué qu'avec le mode conséquences activé.
  BALES: { id: 'BALES', label: 'bottes', solid: true, hazard: false, radius: 0.4, contact: 'soft' },
};
