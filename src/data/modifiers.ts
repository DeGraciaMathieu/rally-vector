// Table des modificateurs de tour (PRD 13). Donnée inerte : ajouter un mod = une
// entrée ici, sans toucher au domaine. `charges < 0` = illimité ; `charges ≥ 0` =
// ressource de run (décrémentée à l'usage). On en livre deux pour valider le système :
// - Boost : +40 % d'autorité de poussée, grip ×0.8 (contrôle dégradé), 3 charges/run.
//   net portée ×1.12 (mesurablement accrue) ; arbitrage vitesse vs contrôle.
// - Frein à main : pivot serré (grip ×1.5 -> disque atteignable agrandi, PRD 11) au
//   prix de la vitesse entrante (×0.5, on perd la progression avant) ; illimité.
// Valeurs de départ tunables (l'équilibrage se règle en jeu, pas figé ici).

import { ModId, NEUTRAL, TurnMods } from '../domain/turnmods';

export interface Modifier {
  readonly id: ModId;
  readonly label: string;
  readonly mods: TurnMods;
  readonly charges: number; // < 0 = illimité ; sinon nombre de charges par run
}

export const MODIFIERS: readonly Modifier[] = [
  { id: 'none', label: 'Aucun', mods: NEUTRAL, charges: -1 },
  { id: 'boost', label: 'Boost', mods: { impulse: 1.4, grip: 0.8, drag: 1, vel: 1 }, charges: 3 },
  { id: 'handbrake', label: 'Frein à main', mods: { impulse: 1, grip: 1.5, drag: 1, vel: 0.5 }, charges: -1 },
];

export const modifierById = (id: ModId): Modifier => MODIFIERS.find((m) => m.id === id) ?? MODIFIERS[0];

// Charges de boost au départ d'une run (seul mod limité). Sert à initialiser RaceState.
export const BOOST_CHARGES = modifierById('boost').charges;
