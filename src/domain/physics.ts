// Cœur de simulation — fonction pure, déterministe (P5). Aucun accès global :
// les réglages d'équilibrage arrivent en paramètre.
//
// Modèle : v' = (v + impulsion·gripEff)·(1 - drag), puis pos += v' (côté gameState).
// gripEff chute quand on braque fort à grande vitesse -> sensation de glisse rallye.

import { Surface } from './surfaces';
import { Vec2 } from './vec2';

export interface PhysicsTuning {
  readonly maxSpeed: number; // garde-fou : vitesse plafonnée
  readonly angleGripLoss: number; // perte d'adhérence en braquage à grande vitesse
}

export function step(
  vel: Vec2,
  impulse: Vec2,
  surf: Surface,
  tuning: PhysicsTuning,
): Vec2 {
  const speed = Math.hypot(vel.x, vel.y);
  let grip = surf.grip;
  if (speed > 1 && (impulse.x || impulse.y)) {
    const imag = Math.hypot(impulse.x, impulse.y) || 1;
    const cos = (vel.x * impulse.x + vel.y * impulse.y) / (speed * imag); // écart d'angle
    const turn = (1 - cos) / 2; // 0 (tout droit) -> 1 (demi-tour)
    const speedFac = Math.min(speed / tuning.maxSpeed, 1);
    grip *= 1 - tuning.angleGripLoss * turn * speedFac;
  }
  let vx = (vel.x + impulse.x * grip) * (1 - surf.drag);
  let vy = (vel.y + impulse.y * grip) * (1 - surf.drag);
  const sp = Math.hypot(vx, vy);
  if (sp > tuning.maxSpeed) {
    const k = tuning.maxSpeed / sp;
    vx *= k;
    vy *= k;
  }
  return { x: vx, y: vy };
}
