// Tous les réglages "feeling" au même endroit. Donnée inerte : aucune logique.

import type { Tuning } from '../domain/gameState';

export const TUNING: Tuning = {
  maxImpulse: 26, // poussée max par tour (longueur de la flèche)
  maxSpeed: 150, // garde-fou : vitesse plafonnée
  angleGripLoss: 0.45, // perte d'adhérence quand on braque fort à grande vitesse
  anim: { min: 180, max: 480, pxPerMs: 0.34 }, // durée d'animation du déplacement
};
