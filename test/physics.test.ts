import { describe, expect, it } from 'vitest';
import { step } from '../src/domain/physics';
import { aimToImpulse } from '../src/systems/input';
import { cars } from '../src/data/cars';
import { S } from '../src/data/surfaces';

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

  it('perte de grip en braquage à vitesse max : la poussée mord moins', () => {
    const v = step({ x: 150, y: 0 }, { x: -26, y: 0 }, S.ROAD, balanced);
    // grip = 0.92 * (1 - 0.45*1*1) = 0.506 ; vx = (150 - 26*0.506)*0.78
    expect(v.x).toBeCloseTo(106.73832, 4);
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
