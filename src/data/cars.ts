// Table des voitures jouables. Donnée inerte : ajouter/retirer une voiture = une
// entrée ici, sans toucher au domaine ni au rendu. `livery` = simple couleur.
// Trois caractères de pilotage nettement distincts (P2), un axe gagnant chacun. Le
// plafond `maxSpeed` MORD (croisière théorique > plafond) : c'est la vraie pointe.
// - Équilibrée : référence, milieu sur tous les axes.
// - Vive : disque atteignable max + peu de glisse (technique), mais pointe la plus basse.
// - Fusée : pointe max + garde l'inertie (lignes droites), mais disque min et glisse fort.

import type { Car } from '../domain/car';

export const cars: readonly Car[] = [
  {
    id: 'balanced',
    label: 'Équilibrée',
    maxImpulse: 33,
    maxSpeed: 130,
    gripFactor: 1,
    dragFactor: 0.8,
    angleGripLoss: 0.45,
    livery: '#ff5252',
  },
  {
    id: 'nimble',
    label: 'Vive',
    maxImpulse: 40,
    maxSpeed: 100,
    gripFactor: 1.2,
    dragFactor: 1.3,
    angleGripLoss: 0.28,
    livery: '#4ade80',
  },
  {
    id: 'rocket',
    label: 'Fusée',
    maxImpulse: 26,
    maxSpeed: 160,
    gripFactor: 0.8,
    dragFactor: 0.45,
    angleGripLoss: 0.62,
    livery: '#38bdf8',
  },
];

export const carById = (id: string): Car => cars.find((c) => c.id === id) ?? cars[0];
