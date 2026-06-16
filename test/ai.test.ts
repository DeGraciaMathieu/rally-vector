import { describe, expect, it } from 'vitest';
import { decideImpulse } from '../src/domain/ai';
import { CarState } from '../src/domain/gameState';
import { step } from '../src/domain/physics';
import { createRng } from '../src/domain/rng';
import { length } from '../src/domain/vec2';
import { cars } from '../src/data/cars';
import { S } from '../src/data/surfaces';
import { BOT_PROFILES } from '../src/data/bots';

const car = cars[0];
const surf = S.ROAD;
const profile = (id: string) => BOT_PROFILES.find((p) => p.id === id)!;
const atRest = (x: number, y: number): CarState => ({ pos: { x, y }, vel: { x: 0, y: 0 }, heading: 0 });

describe('ai.decideImpulse', () => {
  it('déterministe : mêmes entrées -> même impulsion', () => {
    const a = decideImpulse(atRest(100, 100), { x: 300, y: 100 }, surf, car, profile('pusher'), Infinity, () => false, createRng(5));
    const b = decideImpulse(atRest(100, 100), { x: 300, y: 100 }, surf, car, profile('pusher'), Infinity, () => false, createRng(5));
    expect(a.impulse).toEqual(b.impulse);
  });

  it('impulsion bornée à maxImpulse (cible lointaine)', () => {
    const { impulse } = decideImpulse(atRest(100, 100), { x: 9000, y: 100 }, surf, car, profile('wild'), Infinity, () => false, createRng(1));
    expect(length(impulse)).toBeLessThanOrEqual(car.maxImpulse + 1e-9);
  });

  it('un profil agressif pousse plus fort qu’un prudent (même situation)', () => {
    const target = { x: 600, y: 100 };
    const aggro = decideImpulse(atRest(100, 100), target, surf, car, profile('pusher'), Infinity, () => false, createRng(7));
    const calm = decideImpulse(atRest(100, 100), target, surf, car, profile('cautious'), Infinity, () => false, createRng(7));
    expect(length(aggro.impulse)).toBeGreaterThan(length(calm.impulse));
  });

  it('vise la trajectoire : l’impulsion rapproche de la cible plus que l’inertie seule', () => {
    const body = atRest(100, 100);
    const target = { x: 260, y: 160 };
    const { impulse } = decideImpulse(body, target, surf, car, profile('ace'), Infinity, () => false, createRng(3));
    const coast = step(body.vel, { x: 0, y: 0 }, surf, car); // inertie seule
    const moved = step(body.vel, impulse, surf, car); // avec le coup de l'IA
    const dColl = Math.hypot(target.x - (body.pos.x + coast.x), target.y - (body.pos.y + coast.y));
    const dMove = Math.hypot(target.x - (body.pos.x + moved.x), target.y - (body.pos.y + moved.y));
    expect(dMove).toBeLessThan(dColl);
  });
});
