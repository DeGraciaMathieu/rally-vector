// Type d'un obstacle : un élément POSÉ sur une tuile (par-dessus le sol), distinct
// de la surface (qui, elle, est sous la voiture). La TABLE vit dans data/obstacles.ts.
// L'ID est OUVERT (string) : ajouter un obstacle = une entrée de données + une
// branche de rendu, zéro logique de jeu nouvelle (extensibilité du PRD 03).

import { ContactPolicy } from './collision';

export type ObstacleId = string;

export interface Obstacle {
  readonly id: ObstacleId;
  readonly label: string;
  // solid : le contact bloque (crash, comme un mur).
  readonly solid: boolean;
  // hazard : dangereux mais traversable (effets futurs). Cosmétique.
  readonly hazard: boolean;
  // contact : conséquence si cet obstacle solide est heurté. Défaut 'fatal'.
  readonly contact?: ContactPolicy;
  // radius : hitbox SOUS-TUILE, en fraction de tuile (0..0.5). 0 = pas de collision.
  // L'obstacle occupe un disque centré sur la tuile, pas la tuile entière.
  readonly radius: number;
}
