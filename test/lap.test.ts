import { describe, expect, it } from 'vitest';
import { Vec2 } from '../src/domain/vec2';
import { track01 } from '../src/data/tracks/track-01';
import { track02 } from '../src/data/tracks/track-02';
import { LapEvent, LapTracker } from '../src/systems/lap';

// Points de part et d'autre de chaque porte de track-01, dans le sens de course.
// CP0 (droite, vers le bas), CP1 (bas, vers la gauche), CP2 (gauche, vers le haut),
// puis finishLine (haut, vers la droite).
const crossCp0: [Vec2, Vec2] = [{ x: 774, y: 250 }, { x: 774, y: 320 }];
const crossCp1: [Vec2, Vec2] = [{ x: 470, y: 486 }, { x: 400, y: 486 }];
const crossCp2: [Vec2, Vec2] = [{ x: 90, y: 320 }, { x: 90, y: 250 }];
const crossFinish: [Vec2, Vec2] = [{ x: 120, y: 90 }, { x: 170, y: 90 }];

const feed = (tracker: LapTracker, segs: Array<[Vec2, Vec2]>): LapEvent[] => {
  const all: LapEvent[] = [];
  for (const [prev, next] of segs) all.push(...tracker.update(prev, next));
  return all;
};

describe('LapTracker (tours ordonnés)', () => {
  it('compte un tour : tous les checkpoints dans l’ordre puis la ligne', () => {
    const t = new LapTracker(track01);
    const events = feed(t, [crossCp0, crossCp1, crossCp2, crossFinish]);
    expect(events).toEqual([
      { type: 'checkpoint', index: 0 },
      { type: 'checkpoint', index: 1 },
      { type: 'checkpoint', index: 2 },
      { type: 'lapComplete', lap: 1 },
    ]);
  });

  it('ne compte jamais la ligne sans tous les checkpoints (raccourci)', () => {
    const t = new LapTracker(track01);
    // franchir la ligne d’emblée : ignoré
    expect(feed(t, [crossFinish])).toEqual([]);
    // un seul checkpoint puis la ligne : toujours pas de tour
    const events = feed(t, [crossCp0, crossFinish]);
    expect(events).toEqual([{ type: 'checkpoint', index: 0 }]);
  });

  it('respecte l’ordre : un checkpoint hors séquence est ignoré', () => {
    const t = new LapTracker(track01);
    // CP1 avant CP0 : rien (on attend CP0)
    expect(feed(t, [crossCp1])).toEqual([]);
    // CP0 ensuite : accepté
    expect(feed(t, [crossCp0])).toEqual([{ type: 'checkpoint', index: 0 }]);
  });

  it('ignore un franchissement dans le mauvais sens', () => {
    const t = new LapTracker(track01);
    // CP0 traversé vers le HAUT (sens inverse) : ignoré
    const wrong: [Vec2, Vec2] = [{ x: 774, y: 320 }, { x: 774, y: 250 }];
    expect(feed(t, [wrong])).toEqual([]);
  });

  it('anti double-comptage : repasser la ligne sans refaire les checkpoints', () => {
    const t = new LapTracker(track01);
    feed(t, [crossCp0, crossCp1, crossCp2, crossFinish]); // tour 1
    // repasser la ligne tout de suite : ignoré (checkpoints non refaits)
    expect(feed(t, [crossFinish])).toEqual([]);
  });

  it('compte une ligne fine même si le déplacement la « saute » (intersection)', () => {
    const t = new LapTracker(track01);
    feed(t, [crossCp0, crossCp1, crossCp2]);
    // un seul déplacement très long qui dépasse largement la ligne x=144
    const bigJump: [Vec2, Vec2] = [{ x: 100, y: 90 }, { x: 2000, y: 90 }];
    expect(feed(t, [bigJump])).toEqual([{ type: 'lapComplete', lap: 1 }]);
  });

  it('déterminisme : même suite de positions -> mêmes LapEvent', () => {
    const segs = [crossCp0, crossCp1, crossCp2, crossFinish];
    expect(feed(new LapTracker(track01), segs)).toEqual(feed(new LapTracker(track01), segs));
  });
});

describe('LapTracker sur track-02 (4 checkpoints)', () => {
  // Portes de track-02 dans le sens horaire : droite (bas), bas-droite (gauche),
  // bas-gauche (gauche), gauche (haut), puis finishLine (haut, vers la droite).
  const segs: Array<[Vec2, Vec2]> = [
    [{ x: 792, y: 250 }, { x: 792, y: 320 }], // CP0 droite, vers le bas
    [{ x: 600, y: 504 }, { x: 540, y: 504 }], // CP1 bas-droite, vers la gauche
    [{ x: 310, y: 504 }, { x: 260, y: 504 }], // CP2 bas-gauche, vers la gauche
    [{ x: 72, y: 320 }, { x: 72, y: 250 }], // CP3 gauche, vers le haut
    [{ x: 90, y: 72 }, { x: 130, y: 72 }], // finishLine, vers la droite
  ];

  it('complète un tour avec les 4 checkpoints dans l’ordre', () => {
    const events = feed(new LapTracker(track02), segs);
    expect(events).toEqual([
      { type: 'checkpoint', index: 0 },
      { type: 'checkpoint', index: 1 },
      { type: 'checkpoint', index: 2 },
      { type: 'checkpoint', index: 3 },
      { type: 'lapComplete', lap: 1 },
    ]);
  });
});
