import { describe, expect, it } from 'vitest';
import { isCancelGesture, targetToImpulse } from '../src/systems/input';
import { reachableRadius, step } from '../src/domain/physics';
import { cars } from '../src/data/cars';
import { S } from '../src/data/surfaces';
import type { Vec2 } from '../src/domain/vec2';

const car = cars[0];
const pos: Vec2 = { x: 100, y: 100 };
const CANCEL = 8; // = TUNING.aim.cancelRadius

describe('targetToImpulse (geste de visée, PRD 11)', () => {
  it('zone morte : cible à moins de cancelRadius de la voiture -> impulsion nulle (roue libre)', () => {
    const target: Vec2 = { x: pos.x + 5, y: pos.y }; // < 8 px
    expect(targetToImpulse(pos, { x: 0, y: 0 }, target, S.ROAD, car, CANCEL)).toEqual({ x: 0, y: 0 });
  });

  it('hors zone morte : produit une impulsion qui amène l’endpoint sur la cible', () => {
    const vel: Vec2 = { x: 0, y: 0 };
    const target: Vec2 = { x: 112, y: 104 }; // hors zone morte, dans le disque
    const imp = targetToImpulse(pos, vel, target, S.ROAD, car, CANCEL);
    const v = step(vel, imp, S.ROAD, car);
    expect(pos.x + v.x).toBeCloseTo(target.x, 6);
    expect(pos.y + v.y).toBeCloseTo(target.y, 6);
  });

  it('cible hors disque : clampe |impulse| ≤ maxImpulse', () => {
    const imp = targetToImpulse(pos, { x: 0, y: 0 }, { x: 9999, y: 0 }, S.ROAD, car, CANCEL);
    expect(Math.hypot(imp.x, imp.y)).toBeCloseTo(car.maxImpulse, 6);
    expect(reachableRadius(S.ROAD, car)).toBeGreaterThan(0); // disque non dégénéré
  });
});

describe('isCancelGesture (seuil anti-tap, PRD 11)', () => {
  const down: Vec2 = { x: 50, y: 50 };

  it('déplacement sous le seuil = annulation (tap accidentel)', () => {
    expect(isCancelGesture(down, { x: 53, y: 50 }, 6)).toBe(true);
  });

  it('déplacement au-dessus du seuil = geste valide (commit)', () => {
    expect(isCancelGesture(down, { x: 60, y: 58 }, 6)).toBe(false);
  });
});
