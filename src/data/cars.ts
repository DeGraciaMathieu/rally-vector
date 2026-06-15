// Table des voitures jouables. Donnée inerte : ajouter/retirer une voiture = une
// entrée ici, sans toucher au domaine ni au rendu. `livery` = simple couleur.
// Trois caractères de pilotage nettement distincts (P2) :
// - Équilibrée : référence du proto.
// - Vive : maniable (poussée haute, tient en virage) mais pointe basse.
// - Fusée : grosse pointe mais lourde à placer (faible grip, décroche en courbe).

import type { Car } from '../domain/car';

export const cars: readonly Car[] = [
  {
    id: 'balanced',
    label: 'Équilibrée',
    maxImpulse: 35,
    maxSpeed: 200,
    gripFactor: 1,
    dragFactor: 1,
    angleGripLoss: 0.45,
    livery: '#ff5252',
  },
  {
    id: 'nimble',
    label: 'Vive',
    maxImpulse: 43,
    maxSpeed: 160,
    gripFactor: 1.2,
    dragFactor: 1.1,
    angleGripLoss: 0.28,
    livery: '#4ade80',
  },
  {
    id: 'rocket',
    label: 'Fusée',
    maxImpulse: 30,
    maxSpeed: 270,
    gripFactor: 0.8,
    dragFactor: 0.85,
    angleGripLoss: 0.62,
    livery: '#38bdf8',
  },
];

export const carById = (id: string): Car => cars.find((c) => c.id === id) ?? cars[0];
