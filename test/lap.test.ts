import { describe, expect, it } from 'vitest';
import { RaceState, arm, createRaceState } from '../src/domain/gameState';
import { createRng } from '../src/domain/rng';
import { track01 } from '../src/data/tracks/track-01';
import { detectLap } from '../src/systems/lap';

const base = (): RaceState => createRaceState(createRng(1), track01.startPos);

const fx = track01.finishX; // 144
const yTop = 2 * track01.TILE; // dans la bande du haut (< 4*TILE)
const cpMid = { x: 12 * track01.TILE, y: 13 * track01.TILE }; // dans le checkpoint

describe('lap.detectLap', () => {
  it('arme le checkpoint quand on le traverse', () => {
    const { state } = detectLap(base(), track01, { x: 0, y: 0 }, cpMid);
    expect(state.armed).toBe(true);
  });

  it('ne compte pas la boucle sans checkpoint armé', () => {
    const { state, lapCompleted } = detectLap(
      base(),
      track01,
      { x: fx - 10, y: yTop },
      { x: fx + 10, y: yTop },
    );
    expect(lapCompleted).toBe(false);
    expect(state.laps).toBe(0);
  });

  it('compte la boucle : checkpoint armé + franchissement dans le bon sens', () => {
    const armed = arm(base());
    const { state, lapCompleted } = detectLap(
      armed,
      track01,
      { x: fx - 10, y: yTop },
      { x: fx + 10, y: yTop },
    );
    expect(lapCompleted).toBe(true);
    expect(state.laps).toBe(1);
    expect(state.armed).toBe(false); // ré-armable pour la boucle suivante
  });

  it('ne compte pas un franchissement dans le mauvais sens', () => {
    const armed = arm(base());
    const { lapCompleted } = detectLap(
      armed,
      track01,
      { x: fx + 10, y: yTop },
      { x: fx - 10, y: yTop },
    );
    expect(lapCompleted).toBe(false);
  });
});
