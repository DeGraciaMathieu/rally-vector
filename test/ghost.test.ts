import { describe, expect, it } from 'vitest';
import { createRaceState, setMod } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import type { Vec2 } from '../src/domain/vec2';
import { cars } from '../src/data/cars';
import { BOOST_CHARGES } from '../src/data/modifiers';
import { track01 } from '../src/data/tracks/track-01';
import { TUNING } from '../src/data/tuning';
import { SIM_VERSION } from '../src/data/version';
import { buildGhost } from '../src/systems/ghost';
import type { Recording, TurnInput } from '../src/systems/recorder';
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
  dispersion: true,
  timeMs: 1000,
  turns: inputs.map((impulse) => ({ impulse, mod: 'none' })),
};

describe('ghost', () => {
  it('position fantôme au tour N = position réelle au tour N de la course source', () => {
    let src = createRaceState(createRng(SEED), track01.start, BOOST_CHARGES);
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

  it('capture et rejeu des mods : un run avec boost + frein à main est rejoué à l’identique', () => {
    const turns: TurnInput[] = [
      { impulse: { x: 20, y: 0 }, mod: 'boost' },
      { impulse: { x: 16, y: 0 }, mod: 'handbrake' },
      { impulse: { x: 14, y: 0 }, mod: 'none' },
    ];
    // course source : on re-sélectionne le mod avant chaque tour (comme le ferait le joueur)
    let src = createRaceState(createRng(SEED), track01.start, BOOST_CHARGES);
    const positions: Vec2[] = [src.car.pos];
    for (const t of turns) {
      src = advanceTurn(setMod(src, t.mod), track01, TUNING, car, t.impulse, true);
      positions.push(src.car.pos);
    }
    const frames = buildGhost({ ...recording, turns }, TUNING, SIM_VERSION)!;
    expect(frames.length).toBe(positions.length);
    frames.forEach((f, i) => expect(f.pos).toEqual(positions[i]));
    // le boost a bien été consommé (une charge en moins) sur la course source
    expect(src.boosts).toBe(BOOST_CHARGES - 1);
  });

  it('rejette une simVersion divergente (jamais rejoué faux)', () => {
    expect(buildGhost({ ...recording, simVersion: SIM_VERSION + 1 }, TUNING, SIM_VERSION)).toBeNull();
  });

  it('rejette une Recording absente', () => {
    expect(buildGhost(null, TUNING, SIM_VERSION)).toBeNull();
  });
});
