import { describe, expect, it } from 'vitest';
import { NEUTRAL, effectiveTurn } from '../src/domain/turnmods';
import { reachableRadius, step } from '../src/domain/physics';
import { createRaceState, setMod } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import { cars } from '../src/data/cars';
import { modifierById } from '../src/data/modifiers';
import { S } from '../src/data/surfaces';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { advanceTurn, resolveTurnMods } from '../src/systems/simulation';
import type { Vec2 } from '../src/domain/vec2';

const car = cars[0];
const boost = modifierById('boost').mods;
const handbrake = modifierById('handbrake').mods;
const vel: Vec2 = { x: 80, y: 0 };

describe('effectiveTurn (PRD 13)', () => {
  it('neutre = identité (grip/drag/vitesse/maxImpulse de base)', () => {
    const eff = effectiveTurn(S.ROAD, car, vel, NEUTRAL);
    expect(eff.grip).toBeCloseTo(S.ROAD.grip * car.gripFactor, 9);
    expect(eff.drag).toBeCloseTo(Math.min(0.95, S.ROAD.drag * car.dragFactor), 9);
    expect(eff.vel).toEqual(vel);
    expect(eff.maxImpulse).toBe(car.maxImpulse);
  });

  it('boost : autorité de poussée accrue, grip dégradé', () => {
    const eff = effectiveTurn(S.ROAD, car, vel, boost);
    expect(eff.maxImpulse).toBeGreaterThan(car.maxImpulse);
    expect(eff.grip).toBeLessThan(S.ROAD.grip * car.gripFactor);
  });

  it('frein à main : vitesse entrante scrubée, grip (pivot) accru', () => {
    const eff = effectiveTurn(S.ROAD, car, vel, handbrake);
    expect(Math.hypot(eff.vel.x, eff.vel.y)).toBeLessThan(Math.hypot(vel.x, vel.y));
    expect(eff.grip).toBeGreaterThan(S.ROAD.grip * car.gripFactor);
  });
});

describe('step : mods neutres = comportement actuel (non-régression)', () => {
  it('step(...) sans mods === step(..., NEUTRAL)', () => {
    const imp: Vec2 = { x: 20, y: -10 };
    expect(step(vel, imp, S.GRAVEL, car, NEUTRAL)).toEqual(step(vel, imp, S.GRAVEL, car));
  });

  it('roue libre neutre inchangée (v·(1-drag))', () => {
    expect(step({ x: 10, y: 0 }, { x: 0, y: 0 }, S.ROAD, car, NEUTRAL).x).toBeCloseTo(7.8, 6);
  });
});

describe('zone atteignable selon le mod (PRD 11 + 13)', () => {
  it('boost agrandit la portée du tour', () => {
    expect(reachableRadius(S.ROAD, car, boost)).toBeGreaterThan(reachableRadius(S.ROAD, car));
  });

  it('frein à main agrandit le disque (pivot plus serré)', () => {
    expect(reachableRadius(S.ROAD, car, handbrake)).toBeGreaterThan(reachableRadius(S.ROAD, car));
  });

  it('frein à main raccourcit la roue libre (progression avant consommée)', () => {
    const normal = step(vel, { x: 0, y: 0 }, S.ROAD, car);
    const braked = step(vel, { x: 0, y: 0 }, S.ROAD, car, handbrake);
    expect(Math.hypot(braked.x, braked.y)).toBeLessThan(Math.hypot(normal.x, normal.y));
  });
});

describe('resolveTurnMods : bornes des charges (PRD 13)', () => {
  it('boost sans charge -> coup normal (pas d’usage sans charge)', () => {
    const r = resolveTurnMods('boost', 0);
    expect(r.mods).toBe(NEUTRAL);
    expect(r.useBoost).toBe(false);
  });

  it('boost avec charge -> applique le mod et consomme', () => {
    const r = resolveTurnMods('boost', 2);
    expect(r.mods).toBe(boost);
    expect(r.useBoost).toBe(true);
  });

  it('frein à main : illimité, ne consomme pas de charge', () => {
    expect(resolveTurnMods('handbrake', 0)).toEqual({ mods: handbrake, useBoost: false });
  });

  it('aucun -> neutre', () => {
    expect(resolveTurnMods('none', 3)).toEqual({ mods: NEUTRAL, useBoost: false });
  });
});

describe('charges de boost bornées à ≥ 0 (PRD 13)', () => {
  it('décrémente puis ne descend jamais sous zéro ni n’agit sans charge', () => {
    const imp: Vec2 = { x: 20, y: 0 };
    let s = createRaceState(createRng(1), track01.start, 1); // 1 seule charge
    s = advanceTurn(setMod(s, 'boost'), track01, TUNING, car, imp, true, false);
    expect(s.boosts).toBe(0); // charge consommée
    s = advanceTurn(setMod(s, 'boost'), track01, TUNING, car, imp, true, false);
    expect(s.boosts).toBe(0); // plus de charge -> coup normal, jamais négatif
  });
});
