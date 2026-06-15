// Cœur de simulation — fonction pure, déterministe (P5). Aucun accès global :
// les caractéristiques arrivent via la VOITURE passée en paramètre.
//
// Modèle : v' = (v + impulsion·gripEff)·(1 - drag), puis pos += v' (côté gameState).
// gripEff = grip surface · gripFactor voiture, chute quand on braque fort à grande
// vitesse -> sensation de glisse rallye. drag = drag surface · dragFactor voiture.

import { Car } from './car';
import { clampToDisk } from './geometry';
import { Surface } from './surfaces';
import { Vec2 } from './vec2';

// Grip et drag de BASE (surface × voiture). Le grip exclut volontairement
// `angleGripLoss` (qui dépend de l'impulsion, non encore connue lors du solve) :
// c'est ce grip de base qui dimensionne la zone atteignable du modèle B (PRD 11).
const baseGrip = (surf: Surface, car: Car): number => surf.grip * car.gripFactor;
const effDrag = (surf: Surface, car: Car): number => Math.min(0.95, surf.drag * car.dragFactor);

export function step(vel: Vec2, impulse: Vec2, surf: Surface, car: Car): Vec2 {
  const speed = Math.hypot(vel.x, vel.y);
  let grip = baseGrip(surf, car);
  if (speed > 1 && (impulse.x || impulse.y)) {
    const imag = Math.hypot(impulse.x, impulse.y) || 1;
    const cos = (vel.x * impulse.x + vel.y * impulse.y) / (speed * imag); // écart d'angle
    const turn = (1 - cos) / 2; // 0 (tout droit) -> 1 (demi-tour)
    const speedFac = Math.min(speed / car.maxSpeed, 1);
    grip *= 1 - car.angleGripLoss * turn * speedFac;
  }
  const drag = effDrag(surf, car); // (1-drag) > 0 garanti par le garde-fou 0.95
  let vx = (vel.x + impulse.x * grip) * (1 - drag);
  let vy = (vel.y + impulse.y * grip) * (1 - drag);
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
// large sur route). On utilise le grip de BASE (hors angleGripLoss).
export function reachableRadius(surf: Surface, car: Car): number {
  return car.maxImpulse * baseGrip(surf, car) * (1 - effDrag(surf, car));
}

// Mapping pur cible -> impulsion : quelle impulsion amène l'endpoint sur `target` ?
// `target` est d'abord clampé dans le disque atteignable, ce qui garantit
// |impulse| ≤ maxImpulse. Inverse de step HORS angleGripLoss (step reste l'autorité
// finale et inchangé) : round-trip exact tant qu'angleGripLoss n'agit pas.
//   impulse = ((target - pos) - v·(1-drag)) / (grip·(1-drag))
export function solveImpulse(pos: Vec2, vel: Vec2, target: Vec2, surf: Surface, car: Car): Vec2 {
  const grip = baseGrip(surf, car);
  if (grip === 0) return { x: 0, y: 0 }; // sol sans adhérence (mur) : rien à plier
  const drag = effDrag(surf, car);
  const coast: Vec2 = { x: pos.x + vel.x * (1 - drag), y: pos.y + vel.y * (1 - drag) };
  const clamped = clampToDisk(target, coast, reachableRadius(surf, car));
  const k = grip * (1 - drag);
  return { x: (clamped.x - coast.x) / k, y: (clamped.y - coast.y) / k };
}
