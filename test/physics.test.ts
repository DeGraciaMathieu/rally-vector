import { describe, expect, it } from 'vitest';
import { step } from '../src/domain/physics';
import { S } from '../src/data/surfaces';
import { TUNING } from '../src/data/tuning';

describe('physics.step', () => {
  it('impulsion nulle = roue libre décroissante (v·(1-drag))', () => {
    const v = step({ x: 10, y: 0 }, { x: 0, y: 0 }, S.ROAD, TUNING);
    // ROAD drag 0.22 -> 10 * 0.78 = 7.8
    expect(v.x).toBeCloseTo(7.8, 6);
    expect(v.y).toBeCloseTo(0, 6);
    expect(Math.hypot(v.x, v.y)).toBeLessThan(10); // décroît
  });

  it('perte de grip en braquage à vitesse max : la poussée mord moins', () => {
    // contre-braquage plein à vitesse max -> grip réduit -> moins d'autorité
    const v = step({ x: 150, y: 0 }, { x: -26, y: 0 }, S.ROAD, TUNING);
    // grip = 0.92 * (1 - 0.45*1*1) = 0.506 ; vx = (150 - 26*0.506)*0.78
    expect(v.x).toBeCloseTo(106.73832, 4);

    // sans perte de grip le frein mordrait plus -> vx serait plus bas
    const noLoss = (150 - 26 * 0.92) * 0.78;
    expect(v.x).toBeGreaterThan(noLoss);
  });

  it('plafonne la vitesse à maxSpeed', () => {
    const v = step({ x: 0, y: 0 }, { x: 1000, y: 0 }, S.ROAD, TUNING);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(TUNING.maxSpeed, 6);
  });
});
