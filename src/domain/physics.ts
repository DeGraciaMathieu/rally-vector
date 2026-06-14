// Cœur de simulation — fonction pure, déterministe (P5). Aucun accès global :
// les caractéristiques arrivent via la VOITURE passée en paramètre.
//
// Modèle : v' = (v + impulsion·gripEff)·(1 - drag), puis pos += v' (côté gameState).
// gripEff = grip surface · gripFactor voiture, chute quand on braque fort à grande
// vitesse -> sensation de glisse rallye. drag = drag surface · dragFactor voiture.

import { Car } from './car';
import { Surface } from './surfaces';
import { Vec2 } from './vec2';

export function step(vel: Vec2, impulse: Vec2, surf: Surface, car: Car): Vec2 {
  const speed = Math.hypot(vel.x, vel.y);
  let grip = surf.grip * car.gripFactor;
  if (speed > 1 && (impulse.x || impulse.y)) {
    const imag = Math.hypot(impulse.x, impulse.y) || 1;
    const cos = (vel.x * impulse.x + vel.y * impulse.y) / (speed * imag); // écart d'angle
    const turn = (1 - cos) / 2; // 0 (tout droit) -> 1 (demi-tour)
    const speedFac = Math.min(speed / car.maxSpeed, 1);
    grip *= 1 - car.angleGripLoss * turn * speedFac;
  }
  const drag = Math.min(0.95, surf.drag * car.dragFactor); // garde-fou : (1-drag) > 0
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
