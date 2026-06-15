import { describe, expect, it } from 'vitest';
import { RaceState, createRaceState } from '../src/domain/gameState';
import { solveImpulse, step } from '../src/domain/physics';
import { createRng } from '../src/domain/rng';
import { Vec2 } from '../src/domain/vec2';
import { cars } from '../src/data/cars';
import { surfaceAt } from '../src/domain/track';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { advanceTurn } from '../src/systems/simulation';

const SEED = 42;
const car = cars[0];

// Séquence d'impulsions "modèle A" (ordre direct du pilote), alignées sur l'inertie
// pour rester dans le régime sans angleGripLoss (où le modèle B inverse exactement A).
const impulsesA: Vec2[] = [
  { x: 20, y: 0 },
  { x: 18, y: 0 },
  { x: 16, y: 0 },
  { x: 14, y: 0 },
];

const run = (inputs: Vec2[]): string[] => {
  let state: RaceState = createRaceState(createRng(SEED), track01.start);
  const trace: string[] = [JSON.stringify(state)];
  for (const impulse of inputs) {
    if (state.phase !== 'idle') break;
    state = advanceTurn(state, track01, TUNING, car, impulse);
    trace.push(JSON.stringify(state));
  }
  return trace;
};

describe('non-régression A↔B (PRD 11)', () => {
  it('le modèle B (cible -> solveImpulse) reproduit les impulsions du modèle A', () => {
    // On rejoue A en notant, à chaque tour, la cible (endpoint) que A produit ;
    // le modèle B doit retrouver la MÊME impulsion à partir de cette cible.
    let state = createRaceState(createRng(SEED), track01.start);
    for (const impA of impulsesA) {
      if (state.phase !== 'idle') break;
      const { pos, vel } = state.car;
      const surf = surfaceAt(track01, pos.x, pos.y);
      const v = step(vel, impA, surf, car);
      const target: Vec2 = { x: pos.x + v.x, y: pos.y + v.y }; // cible visée par le geste B
      const impB = solveImpulse(pos, vel, target, surf, car);
      expect(impB.x).toBeCloseTo(impA.x, 6);
      expect(impB.y).toBeCloseTo(impA.y, 6);
      state = advanceTurn(state, track01, TUNING, car, impA);
    }
  });

  it('step inchangé : impulsions finales identiques -> suites de RaceState identiques', () => {
    // Puisque step est inchangé, une même séquence d'impulsions donne la même course
    // (garantie centrale du déterminisme et du rejeu fantôme, PRD 06).
    expect(run(impulsesA)).toEqual(run(impulsesA));
  });

  it('un fantôme (séquence d’impulsions enregistrée) se rejoue à l’identique', () => {
    const first = run(impulsesA);
    const replay = run(impulsesA);
    expect(replay).toEqual(first);
  });
});
