import { describe, expect, it } from 'vitest';
import { reachableRadius, solveImpulse, step } from '../src/domain/physics';
import { aimToImpulse } from '../src/systems/input';
import { cars } from '../src/data/cars';
import { S } from '../src/data/surfaces';
import type { Vec2 } from '../src/domain/vec2';

const endpoint = (pos: Vec2, vel: Vec2, impulse: Vec2, surf: typeof S.ROAD, car: typeof cars[0]): Vec2 => {
  const v = step(vel, impulse, surf, car);
  return { x: pos.x + v.x, y: pos.y + v.y };
};

const balanced = cars[0];
const nimble = cars.find((c) => c.id === 'nimble')!;
const rocket = cars.find((c) => c.id === 'rocket')!;

describe('physics.step', () => {
  it('impulsion nulle = roue libre décroissante (v·(1-drag))', () => {
    const v = step({ x: 10, y: 0 }, { x: 0, y: 0 }, S.ROAD, balanced);
    // ROAD drag 0.22, dragFactor 1 -> 10 * 0.78 = 7.8
    expect(v.x).toBeCloseTo(7.8, 6);
    expect(v.y).toBeCloseTo(0, 6);
    expect(Math.hypot(v.x, v.y)).toBeLessThan(10); // décroît
  });

  it('perte de grip en braquage à grande vitesse : la poussée mord moins', () => {
    const v = step({ x: 150, y: 0 }, { x: -26, y: 0 }, S.ROAD, balanced);
    // speedFac = 150/200 = 0.75 ; grip = 0.92 * (1 - 0.45*1*0.75) = 0.6095 ; vx = (150 - 26*0.6095)*0.78
    expect(v.x).toBeCloseTo(104.63934, 4);
    const noLoss = (150 - 26 * 0.92) * 0.78;
    expect(v.x).toBeGreaterThan(noLoss);
  });

  it('plafonne la vitesse à la pointe de la voiture', () => {
    expect(Math.hypot(...vof(step({ x: 0, y: 0 }, { x: 1000, y: 0 }, S.ROAD, nimble)))).toBeCloseTo(
      nimble.maxSpeed,
      6,
    );
    expect(Math.hypot(...vof(step({ x: 0, y: 0 }, { x: 1000, y: 0 }, S.ROAD, rocket)))).toBeCloseTo(
      rocket.maxSpeed,
      6,
    );
  });

  it('le grip varie selon la voiture (gripFactor par-dessus la surface)', () => {
    // même poussée sur gravier : la voiture qui accroche le mieux avance le plus
    const imp = { x: 20, y: 0 };
    const vn = step({ x: 0, y: 0 }, imp, S.GRAVEL, nimble).x;
    const vb = step({ x: 0, y: 0 }, imp, S.GRAVEL, balanced).x;
    const vr = step({ x: 0, y: 0 }, imp, S.GRAVEL, rocket).x;
    expect(vn).toBeGreaterThan(vb);
    expect(vb).toBeGreaterThan(vr);
  });
});

describe('aimToImpulse', () => {
  it('borne l’impulsion à maxImpulse propre à la voiture', () => {
    const far = { x: 1000, y: 0 };
    expect(Math.hypot(...vof(aimToImpulse({ x: 0, y: 0 }, far, nimble.maxImpulse)))).toBeCloseTo(
      nimble.maxImpulse,
      6,
    );
    expect(Math.hypot(...vof(aimToImpulse({ x: 0, y: 0 }, far, rocket.maxImpulse)))).toBeCloseTo(
      rocket.maxImpulse,
      6,
    );
  });
});

const vof = (v: { x: number; y: number }): [number, number] => [v.x, v.y];

describe('reachableRadius (PRD 11)', () => {
  it('= maxImpulse·grip·(1-drag)', () => {
    // ROAD : 35 * (0.92*1) * (1 - 0.22) = 25.116
    expect(reachableRadius(S.ROAD, balanced)).toBeCloseTo(25.116, 6);
  });

  it('croît avec le grip : gravier < route', () => {
    expect(reachableRadius(S.GRAVEL, balanced)).toBeLessThan(reachableRadius(S.ROAD, balanced));
  });

  it('croît avec l’adhérence de la voiture : fusée < équilibrée < vive', () => {
    expect(reachableRadius(S.ROAD, rocket)).toBeLessThan(reachableRadius(S.ROAD, balanced));
    expect(reachableRadius(S.ROAD, balanced)).toBeLessThan(reachableRadius(S.ROAD, nimble));
  });
});

describe('solveImpulse (PRD 11)', () => {
  const pos: Vec2 = { x: 100, y: 100 };

  it('round-trip à v≈0 : solveImpulse puis step retombe sur la cible (poignée sur la voiture)', () => {
    const vel: Vec2 = { x: 0, y: 0 };
    const target: Vec2 = { x: 110, y: 105 }; // dans le disque (rayon 18.66)
    const imp = solveImpulse(pos, vel, target, S.ROAD, balanced);
    const got = endpoint(pos, vel, imp, S.ROAD, balanced);
    expect(got.x).toBeCloseTo(target.x, 6);
    expect(got.y).toBeCloseTo(target.y, 6);
  });

  it('round-trip en mouvement, impulsion alignée (pas d’angleGripLoss)', () => {
    const vel: Vec2 = { x: 12, y: 0 };
    const coast: Vec2 = { x: pos.x + 12 * 0.78, y: pos.y }; // endpoint roue libre
    const target: Vec2 = { x: coast.x + 8, y: coast.y }; // tout droit, dans le disque
    const imp = solveImpulse(pos, vel, target, S.ROAD, balanced);
    const got = endpoint(pos, vel, imp, S.ROAD, balanced);
    expect(got.x).toBeCloseTo(target.x, 6);
    expect(got.y).toBeCloseTo(target.y, 6);
  });

  it('clampe la cible dans le disque : |impulse| ≤ maxImpulse', () => {
    const vel: Vec2 = { x: 0, y: 0 };
    const far: Vec2 = { x: 9999, y: -9999 };
    const imp = solveImpulse(pos, vel, far, S.ROAD, balanced);
    expect(Math.hypot(imp.x, imp.y)).toBeLessThanOrEqual(balanced.maxImpulse + 1e-9);
    // la cible hors disque sature exactement la poussée
    expect(Math.hypot(imp.x, imp.y)).toBeCloseTo(balanced.maxImpulse, 6);
  });

  it('cible hors disque : l’endpoint atteint = la cible CLAMPÉE (bord du disque)', () => {
    const vel: Vec2 = { x: 0, y: 0 };
    const far: Vec2 = { x: pos.x + 1000, y: pos.y };
    const imp = solveImpulse(pos, vel, far, S.ROAD, balanced);
    const got = endpoint(pos, vel, imp, S.ROAD, balanced);
    expect(got.x).toBeCloseTo(pos.x + reachableRadius(S.ROAD, balanced), 6);
    expect(got.y).toBeCloseTo(pos.y, 6);
  });

  it('sol sans adhérence (grip 0) : impulsion nulle', () => {
    const imp = solveImpulse(pos, { x: 0, y: 0 }, { x: 200, y: 200 }, S.WALL, balanced);
    expect(imp).toEqual({ x: 0, y: 0 });
  });
});
