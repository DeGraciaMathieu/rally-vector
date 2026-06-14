import { describe, expect, it } from 'vitest';
import { RaceState, createRaceState } from '../src/domain/gameState';
import { Vec2 } from '../src/domain/vec2';
import { createRng } from '../src/domain/rng';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { advanceTurn } from '../src/systems/simulation';

// Rejoue une séquence d'impulsions depuis un seed et sérialise chaque RaceState.
const run = (seed: number, inputs: Vec2[]): string[] => {
  let state: RaceState = createRaceState(createRng(seed), track01.startPos);
  const trace: string[] = [JSON.stringify(state)];
  for (const impulse of inputs) {
    if (state.phase !== 'idle') break; // course finie (crash)
    state = advanceTurn(state, track01, TUNING, impulse).state;
    trace.push(JSON.stringify(state));
  }
  return trace;
};

const inputs: Vec2[] = [
  { x: 22, y: 0 },
  { x: 18, y: 4 },
  { x: 10, y: -6 },
  { x: 24, y: 2 },
  { x: 12, y: 8 },
];

describe('déterminisme (P5)', () => {
  it('même seed + même séquence -> même suite de RaceState (bit pour bit)', () => {
    expect(run(123, inputs)).toEqual(run(123, inputs));
  });

  it('la suite avance réellement (au moins un tour appliqué)', () => {
    const trace = run(123, inputs);
    expect(trace.length).toBeGreaterThan(1);
  });
});
