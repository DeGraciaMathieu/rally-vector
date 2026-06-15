// Tous les réglages "feeling" au même endroit. Donnée inerte : aucune logique.

import type { Tuning } from '../domain/gameState';

export const TUNING: Tuning = {
  anim: { min: 180, max: 480, pxPerMs: 0.34 }, // durée d'animation du déplacement
  aim: { cancelRadius: 8, commitMinDrag: 6 }, // zone morte d'annulation + seuil anti-tap
  // Cône d'incertitude (PRD 12). base ≈ 2° ; +~26° à vitesse max ; +~15° sur gravier
  // (grip 0.4) ; jitter de magnitude ±16 %. Angles en radians. Réglage « impactant » :
  // tir au pixel impossible à grande vitesse / faible grip, marge obligatoire.
  dispersion: { coneBase: 0.04, kV: 0.45, kSurf: 0.38, magJitter: 0.16 },
  contact: {
    fatalSpeedFrac: 0.7, // au-dessus de 70% de maxSpeed, tout contact est fatal
    spinSpeedFrac: 0.25, // entre 25% et 70% : tête-à-queue ; en deçà : frôlement
    grazeSpeedKeep: 0.5, // un frôlement conserve la moitié de la vitesse
  },
  camera: {
    viewport: { width: 720, height: 480 }, // fenêtre de jeu (ratio 3:2)
    followZoom: 1.35, // « on roule dans » la spéciale
    smoothing: 0.12, // suivi lissé : caméra molle mais sans retard gênant
    lookAhead: 1.2, // anticipe la direction de poussée
    deadZone: 3, // micro-visée : pas d'anticipation
  },
};
