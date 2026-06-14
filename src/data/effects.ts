// Seuils purement VISUELS du game feel (PRD 08). Donnée inerte : aucun effet sur la
// simulation ni le déterminisme. Budgets pensés pour une dégradation gracieuse mobile.

export const FX = {
  skidThreshold: 0.2, // intensité de dérapage (angle×vitesse) mini pour laisser une trace
  traceFadeMs: 3500, // durée de vie d'une trace de pneu
  traceMax: 500, // budget de marques de pneu
  particleMax: 240, // budget de particules simultanées
  particlesPerFrame: 3, // émission par frame en mouvement
  particleLifeMs: 600, // durée de vie d'une particule
  shakeMaxPx: 9, // amplitude de secousse à pleine vitesse (impact fatal)
  shakeMs: 320, // durée de la secousse
} as const;
