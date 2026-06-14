// Tous les réglages "feeling" au même endroit. Donnée inerte : aucune logique.

import type { Tuning } from '../domain/gameState';

export const TUNING: Tuning = {
  TILE: 36,
  COLS: 24,
  ROWS: 16,
  maxImpulse: 26, // poussée max par tour (longueur de la flèche)
  maxSpeed: 150, // garde-fou : vitesse plafonnée
  angleGripLoss: 0.45, // perte d'adhérence quand on braque fort à grande vitesse
  anim: { min: 180, max: 480, pxPerMs: 0.34 }, // durée d'animation du déplacement
};
