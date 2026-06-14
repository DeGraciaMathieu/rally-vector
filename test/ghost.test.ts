import { describe, expect, it } from 'vitest';
import { createRaceState } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import type { Vec2 } from '../src/domain/vec2';
import { cars } from '../src/data/cars';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { SIM_VERSION } from '../src/data/version';
import { buildGhost } from '../src/systems/ghost';
import type { Recording } from '../src/systems/recorder';
import { advanceTurn } from '../src/systems/simulation';

const SEED = 7;
const car = cars[0];
const inputs: Vec2[] = [
  { x: 18, y: 0 },
  { x: 16, y: 0 },
  { x: 14, y: 0 },
  { x: 12, y: 0 },
];

const recording: Recording = {
  simVersion: SIM_VERSION,
  seed: SEED,
  carId: car.id,
  trackId: track01.id,
  strict: true,
  timeMs: 1000,
  impulses: inputs,
};

describe('ghost', () => {
  it('position fantôme au tour N = position réelle au tour N de la course source', () => {
    let src = createRaceState(createRng(SEED), track01.start);
    const positions: Vec2[] = [src.car.pos];
    for (const imp of inputs) {
      src = advanceTurn(src, track01, TUNING, car, imp, true);
      positions.push(src.car.pos);
    }
    const frames = buildGhost(recording, TUNING, SIM_VERSION)!;
    expect(frames).not.toBeNull();
    expect(frames.length).toBe(positions.length);
    frames.forEach((f, i) => expect(f.pos).toEqual(positions[i]));
  });

  it('rejette une simVersion divergente (jamais rejoué faux)', () => {
    expect(buildGhost({ ...recording, simVersion: SIM_VERSION + 1 }, TUNING, SIM_VERSION)).toBeNull();
  });

  it('rejette une Recording absente', () => {
    expect(buildGhost(null, TUNING, SIM_VERSION)).toBeNull();
  });
});
