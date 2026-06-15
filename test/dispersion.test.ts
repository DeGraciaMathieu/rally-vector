import { describe, expect, it } from 'vitest';
import { coneHalfAngle, perturb } from '../src/domain/dispersion';
import { createRng, nextRandom } from '../src/domain/rng';
import { cars } from '../src/data/cars';
import { S } from '../src/data/surfaces';
import { TUNING } from '../src/data/tuning';
import type { Vec2 } from '../src/domain/vec2';

const car = cars[0];
const D = TUNING.dispersion;
const imp: Vec2 = { x: 26, y: 0 }; // impulsion voulue de référence

const angleBetween = (a: Vec2, b: Vec2): number => {
  const dot = a.x * b.x + a.y * b.y;
  const cos = dot / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  return Math.acos(Math.min(1, Math.max(-1, cos)));
};

describe('coneHalfAngle (PRD 12)', () => {
  it('à vitesse nulle, ≈ base sur sol adhérent (quasi déterministe)', () => {
    const half = coneHalfAngle(0, S.ROAD, car, D);
    // route grip 0.92 : base + kSurf*0.08 (terme vitesse absent), proche de base
    expect(half).toBeCloseTo(D.coneBase + D.kSurf * (1 - S.ROAD.grip), 6);
    // nettement plus serré qu'à pleine vitesse (quasi déterministe à l'arrêt)
    expect(half).toBeLessThan(coneHalfAngle(car.maxSpeed, S.ROAD, car, D) * 0.5);
  });

  it('croît de façon monotone avec la vitesse', () => {
    const h0 = coneHalfAngle(0, S.ROAD, car, D);
    const hMid = coneHalfAngle(car.maxSpeed / 2, S.ROAD, car, D);
    const hMax = coneHalfAngle(car.maxSpeed, S.ROAD, car, D);
    expect(hMid).toBeGreaterThan(h0);
    expect(hMax).toBeGreaterThan(hMid);
  });

  it('croît quand le grip baisse (route < gravier < flaque)', () => {
    const v = car.maxSpeed / 2;
    expect(coneHalfAngle(v, S.GRAVEL, car, D)).toBeGreaterThan(coneHalfAngle(v, S.ROAD, car, D));
    expect(coneHalfAngle(v, S.WATER, car, D)).toBeGreaterThan(coneHalfAngle(v, S.GRAVEL, car, D));
  });

  it('plafonne la part vitesse à maxSpeed (pas d’élargissement au-delà)', () => {
    expect(coneHalfAngle(car.maxSpeed * 3, S.ROAD, car, D)).toBeCloseTo(
      coneHalfAngle(car.maxSpeed, S.ROAD, car, D),
      6,
    );
  });
});

describe('perturb (PRD 12)', () => {
  it('borne dure : tir toujours dans le cône (angle ≤ half) et la magnitude (±jitter)', () => {
    const speed = car.maxSpeed * 0.8;
    const half = coneHalfAngle(speed, S.GRAVEL, car, D);
    let rng = createRng(1);
    for (let i = 0; i < 2000; i++) {
      const r = perturb(imp, speed, S.GRAVEL, car, D, rng);
      const ang = angleBetween(imp, r.impulse);
      const mag = Math.hypot(r.impulse.x, r.impulse.y) / Math.hypot(imp.x, imp.y);
      expect(ang).toBeLessThanOrEqual(half + 1e-9);
      expect(mag).toBeGreaterThanOrEqual(1 - D.magJitter - 1e-9);
      expect(mag).toBeLessThanOrEqual(1 + D.magJitter + 1e-9);
      rng = r.rng;
    }
  });

  it('reproductible : même RNG -> même perturbation', () => {
    const a = perturb(imp, 100, S.ROAD, car, D, createRng(42));
    const b = perturb(imp, 100, S.ROAD, car, D, createRng(42));
    expect(a.impulse).toEqual(b.impulse);
    expect(a.rng).toEqual(b.rng);
  });

  it('consomme EXACTEMENT 2 tirages RNG par tour (pas de désynchro de rejeu)', () => {
    const r0 = createRng(7);
    const after = perturb(imp, 100, S.ROAD, car, D, r0).rng;
    const twice = nextRandom(nextRandom(r0).rng).rng;
    expect(after).toEqual(twice);
  });

  it('impulsion nulle (roue libre) : reste nulle mais consomme quand même 2 tirages', () => {
    const r0 = createRng(3);
    const r = perturb({ x: 0, y: 0 }, 120, S.GRAVEL, car, D, r0);
    expect(r.impulse).toEqual({ x: 0, y: 0 });
    expect(r.rng).toEqual(nextRandom(nextRandom(r0).rng).rng);
  });
});
