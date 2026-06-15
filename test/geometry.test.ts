import { describe, expect, it } from 'vitest';
import { Segment, clampToDisk, crossesForward, segmentsIntersect, sideOf } from '../src/domain/geometry';

const v = (x: number, y: number) => ({ x, y });

describe('geometry.segmentsIntersect', () => {
  it('détecte un croisement franc (en X)', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 10), v(0, 10), v(10, 0))).toBe(true);
  });

  it('renvoie false pour des segments disjoints', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 0), v(0, 5), v(10, 5))).toBe(false);
  });

  it('parallèles non colinéaires : pas d’intersection', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 0), v(0, 1), v(10, 1))).toBe(false);
  });

  it('colinéaires qui se chevauchent : intersection', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 0), v(5, 0), v(15, 0))).toBe(true);
  });

  it('colinéaires disjoints : pas d’intersection', () => {
    expect(segmentsIntersect(v(0, 0), v(5, 0), v(6, 0), v(10, 0))).toBe(false);
  });

  it('tangents (extrémité qui touche) : intersection', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 0), v(10, 0), v(10, 10))).toBe(true);
  });
});

describe('geometry.crossesForward', () => {
  const gate: Segment = { a: v(5, 0), b: v(5, 10) }; // vertical, a->b vers le bas

  it('compte un franchissement de la gauche vers la droite (sens avant)', () => {
    // côté gauche (x<5) -> côté droit (x>5)
    expect(sideOf(gate, v(0, 5))).toBeGreaterThan(0);
    expect(sideOf(gate, v(10, 5))).toBeLessThan(0);
    expect(crossesForward(gate, v(0, 5), v(10, 5))).toBe(true);
  });

  it('ignore le franchissement en sens inverse', () => {
    expect(crossesForward(gate, v(10, 5), v(0, 5))).toBe(false);
  });

  it('ignore un déplacement qui ne croise pas la porte', () => {
    expect(crossesForward(gate, v(0, 5), v(4, 5))).toBe(false);
  });
});

describe('geometry.clampToDisk (PRD 11)', () => {
  const center = v(10, 10);

  it('point déjà dans le disque : inchangé', () => {
    expect(clampToDisk(v(13, 10), center, 5)).toEqual(v(13, 10));
  });

  it('point hors disque : projeté sur le bord (à distance = rayon du centre)', () => {
    const p = clampToDisk(v(30, 10), center, 5); // sur l'axe x
    expect(p.x).toBeCloseTo(15, 6);
    expect(p.y).toBeCloseTo(10, 6);
    expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(5, 6);
  });

  it('centre exact (distance nulle) : renvoyé tel quel sans division par zéro', () => {
    expect(clampToDisk(center, center, 5)).toEqual(center);
  });
});
