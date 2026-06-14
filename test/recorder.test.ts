import { describe, expect, it } from 'vitest';
import { createRaceState } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import type { Vec2 } from '../src/domain/vec2';
import { cars } from '../src/data/cars';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { SIM_VERSION } from '../src/data/version';
import { Recorder } from '../src/systems/recorder';
import { advanceTurn } from '../src/systems/simulation';

const SEED = 7;
const car = cars[0];
// Impulsions douces vers la droite : reste sur la ligne droite du haut (pas de crash).
const inputs: Vec2[] = [
  { x: 18, y: 0 },
  { x: 16, y: 0 },
  { x: 14, y: 0 },
  { x: 12, y: 0 },
];

describe('recorder', () => {
  it('la séquence capturée rejouée donne la même suite de RaceState', () => {
    const rec = new Recorder();
    let src = createRaceState(createRng(SEED), track01.start);
    const srcTrace: string[] = [JSON.stringify(src)];
    for (const imp of inputs) {
      rec.record(imp);
      src = advanceTurn(src, track01, TUNING, car, imp, true);
      srcTrace.push(JSON.stringify(src));
    }
    const recording = rec.toRecording({
      simVersion: SIM_VERSION,
      seed: SEED,
      carId: car.id,
      trackId: track01.id,
      strict: true,
      timeMs: 1234,
    });

    let replay = createRaceState(createRng(recording.seed), track01.start);
    const replayTrace: string[] = [JSON.stringify(replay)];
    for (const imp of recording.impulses) {
      replay = advanceTurn(replay, track01, TUNING, car, imp, recording.strict);
      replayTrace.push(JSON.stringify(replay));
    }
    expect(replayTrace).toEqual(srcTrace);
  });

  it('toRecording fige une copie indépendante de la suite enregistrée', () => {
    const rec = new Recorder();
    rec.record({ x: 1, y: 0 });
    const snap = rec.toRecording({
      simVersion: SIM_VERSION,
      seed: SEED,
      carId: car.id,
      trackId: track01.id,
      strict: true,
      timeMs: 0,
    });
    rec.record({ x: 2, y: 0 });
    expect(snap.impulses).toHaveLength(1);
    expect(rec.length).toBe(2);
  });
});
