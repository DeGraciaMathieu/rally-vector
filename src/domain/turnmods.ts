// Modificateurs de tour (PRD 13) : un « second verbe » qui change la NATURE du coup
// contre un coût, pour transformer le mono-choix en arbitrage (P2). Pur et data-driven :
// la TABLE des modificateurs vit dans data/modifiers.ts ; ici, seulement la forme d'un
// mod (des multiplicateurs sur les paramètres effectifs du tour) et leur application.
//
// `NEUTRAL` = identité : un tour sans mod reproduit STRICTEMENT le comportement actuel
// (argument de non-régression — le coup normal ne change pas).

import { Car } from './car';
import { Surface } from './surfaces';
import { Vec2, ZERO } from './vec2';

export type ModId = string; // ouvert (comme SurfaceId) : ajouter un mod = une donnée

export interface TurnMods {
  readonly impulse: number; // × maxImpulse (rayon de la zone atteignable / autorité de poussée)
  readonly grip: number; // × grip (autorité ; >1 = pivot serré du frein à main)
  readonly drag: number; // × drag
  readonly vel: number; // × vitesse entrante (scrub avant le pas ; <1 = frein à main)
}

export const NEUTRAL: TurnMods = { impulse: 1, grip: 1, drag: 1, vel: 1 };

// Paramètres EFFECTIFS d'un tour après application du mod. Le grip de base exclut
// angleGripLoss (calculé ensuite par step). Drag borné (garde-fou (1-drag) > 0).
export interface EffectiveTurn {
  readonly grip: number;
  readonly drag: number;
  readonly vel: Vec2; // vitesse entrante scrubée
  readonly maxImpulse: number;
}

export function effectiveTurn(surf: Surface, car: Car, vel: Vec2, mods: TurnMods = NEUTRAL): EffectiveTurn {
  return {
    grip: surf.grip * car.gripFactor * mods.grip,
    drag: Math.min(0.95, surf.drag * car.dragFactor * mods.drag),
    vel: { x: vel.x * mods.vel, y: vel.y * mods.vel },
    maxImpulse: car.maxImpulse * mods.impulse,
  };
}

// Raccourci pour les calculs qui n'ont pas besoin de la vitesse (rayon atteignable).
export const effectiveParams = (surf: Surface, car: Car, mods: TurnMods = NEUTRAL): EffectiveTurn =>
  effectiveTurn(surf, car, ZERO, mods);
