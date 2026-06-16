import { describe, expect, it } from 'vitest';
import { generateTrack } from '../src/domain/trackgen';
import { Peloton, PlayerProgress } from '../src/systems/race';
import { GEN } from '../src/data/genParams';
import { TUNING } from '../src/data/tuning';
import { cars } from '../src/data/cars';
import { BOT_PROFILES, START_GRID } from '../src/data/bots';

const track = generateTrack(42, GEN);
const car = cars[0];
const SEED = 7;

const makePeloton = (profiles = BOT_PROFILES) =>
  new Peloton(track, TUNING, car, SEED, profiles, START_GRID);

describe('Peloton (course contre bots)', () => {
  it('déterministe : même seed -> mêmes positions de bots après N tours', () => {
    const a = makePeloton();
    const b = makePeloton();
    for (let i = 0; i < 15; i++) {
      a.advance();
      b.advance();
    }
    expect(a.views(1)).toEqual(b.views(1));
  });

  it('pas de collision voiture-voiture : un bot avance pareil seul ou en peloton', () => {
    const solo = makePeloton(BOT_PROFILES.slice(0, 1));
    const full = makePeloton(BOT_PROFILES.slice(0, 3));
    for (let i = 0; i < 12; i++) {
      solo.advance();
      full.advance();
    }
    // Le 1er bot a son propre flux RNG (dérivé du seed) : sa trajectoire ne dépend
    // pas des autres voitures (elles se traversent).
    expect(full.views(1)[0]).toEqual(solo.views(1)[0]);
  });

  it('un bot crashé/arrivé n’avance plus (élimination)', () => {
    const p = makePeloton();
    p.runToEnd();
    const before = p.views(1);
    p.advance();
    expect(p.views(1)).toEqual(before); // tous figés (arrivés ou crashés)
  });

  it('quelqu’un finit par franchir l’arrivée', () => {
    const p = makePeloton();
    p.runToEnd();
    expect(p.anyFinished).toBe(true);
  });

  it('classement : les arrivés passent avant ceux encore en course', () => {
    const p = makePeloton();
    p.runToEnd();
    const player: PlayerProgress = {
      pos: track.start.pos,
      nextCp: 0,
      finished: false,
      finishTurn: null,
      crashed: false,
    };
    const rows = p.standings(player);
    expect(rows.length).toBe(BOT_PROFILES.length + 1);
    // tous les "arrivés" précèdent les "non arrivés"
    const lastFinished = rows.map((r) => r.finished).lastIndexOf(true);
    const firstUnfinished = rows.map((r) => r.finished).indexOf(false);
    if (lastFinished >= 0 && firstUnfinished >= 0) {
      expect(lastFinished).toBeLessThan(firstUnfinished);
    }
    expect(rows.some((r) => r.isPlayer)).toBe(true);
  });
});
