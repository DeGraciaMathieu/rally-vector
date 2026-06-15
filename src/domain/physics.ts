// Cœur de simulation — fonction pure, déterministe (P5). Aucun accès global :
// les caractéristiques arrivent via la VOITURE passée en paramètre.
//
// Modèle : v' = (v + impulsion·gripEff)·(1 - drag), puis pos += v' (côté gameState).
// gripEff = grip surface · gripFactor voiture, chute quand on braque fort à grande
// vitesse -> sensation de glisse rallye. drag = drag surface · dragFactor voiture.
// Les paramètres effectifs (grip, drag, vitesse entrante, maxImpulse) passent par le
// modificateur de tour `mods` (PRD 13) ; `NEUTRAL` = identité (comportement actuel).

import { Car } from './car';
import { clampToDisk } from './geometry';
import { Surface } from './surfaces';
import { TurnMods, NEUTRAL, effectiveParams, effectiveTurn } from './turnmods';
import { Vec2 } from './vec2';

export function step(vel: Vec2, impulse: Vec2, surf: Surface, car: Car, mods: TurnMods = NEUTRAL): Vec2 {
  const eff = effectiveTurn(surf, car, vel, mods);
  const v = eff.vel; // vitesse entrante (scrubée par le frein à main, sinon = vel)
  const speed = Math.hypot(v.x, v.y);
  let grip = eff.grip;
  if (speed > 1 && (impulse.x || impulse.y)) {
    const imag = Math.hypot(impulse.x, impulse.y) || 1;
    const cos = (v.x * impulse.x + v.y * impulse.y) / (speed * imag); // écart d'angle
    const turn = (1 - cos) / 2; // 0 (tout droit) -> 1 (demi-tour)
    const speedFac = Math.min(speed / car.maxSpeed, 1);
    grip *= 1 - car.angleGripLoss * turn * speedFac;
  }
  const drag = eff.drag; // (1-drag) > 0 garanti par le garde-fou 0.95
  let vx = (v.x + impulse.x * grip) * (1 - drag);
  let vy = (v.y + impulse.y * grip) * (1 - drag);
  const sp = Math.hypot(vx, vy);
  if (sp > car.maxSpeed) {
    const k = car.maxSpeed / sp;
    vx *= k;
    vy *= k;
  }
  return { x: vx, y: vy };
}

// PRD 11 — « plier la trajectoire ». L'endpoint atteignable décrit un DISQUE centré
// sur l'endpoint de roue libre `pos + v(1-drag)`, de rayon `maxImpulse·grip·(1-drag)`.
// Le grip est donc littéralement le rayon de ce qu'on peut plier (petit sur gravier,
// large sur route). On utilise le grip de BASE (hors angleGripLoss). `mods` l'agrandit
// (frein à main) ou ajuste l'autorité de poussée (PRD 13).
export function reachableRadius(surf: Surface, car: Car, mods: TurnMods = NEUTRAL): number {
  const eff = effectiveParams(surf, car, mods);
  return eff.maxImpulse * eff.grip * (1 - eff.drag);
}

// Mapping pur cible -> impulsion : quelle impulsion amène l'endpoint sur `target` ?
// `target` est d'abord clampé dans le disque atteignable, ce qui garantit
// |impulse| ≤ maxImpulse effectif. Inverse de step HORS angleGripLoss (step reste
// l'autorité finale) : round-trip exact tant qu'angleGripLoss n'agit pas.
//   impulse = ((target - pos) - vEff·(1-drag)) / (grip·(1-drag))
export function solveImpulse(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  surf: Surface,
  car: Car,
  mods: TurnMods = NEUTRAL,
): Vec2 {
  const eff = effectiveTurn(surf, car, vel, mods);
  const grip = eff.grip;
  if (grip === 0) return { x: 0, y: 0 }; // sol sans adhérence (mur) : rien à plier
  const drag = eff.drag;
  const coast: Vec2 = { x: pos.x + eff.vel.x * (1 - drag), y: pos.y + eff.vel.y * (1 - drag) };
  const clamped = clampToDisk(target, coast, reachableRadius(surf, car, mods));
  const k = grip * (1 - drag);
  return { x: (clamped.x - coast.x) / k, y: (clamped.y - coast.y) / k };
}
