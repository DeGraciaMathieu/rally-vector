// Géométrie de segments — pure. Sert au franchissement des lignes (arrivée,
// checkpoints) : le déplacement d'un tour est un SEGMENT droit (potentiellement
// long), donc on teste une intersection de segments, jamais une appartenance à une
// zone — sinon une grande vitesse « saute » par-dessus une ligne fine (P5/robustesse).

import { Vec2 } from './vec2';

export interface Segment {
  readonly a: Vec2;
  readonly b: Vec2;
}

// Produit vectoriel (b-o) x (c-o). Signe = côté de c par rapport à la droite o->b.
const cross3 = (o: Vec2, b: Vec2, c: Vec2): number =>
  (b.x - o.x) * (c.y - o.y) - (b.y - o.y) * (c.x - o.x);

const EPS = 1e-9;

// q est-il dans la boîte englobante du segment [p, r] ? (cas colinéaires)
const onSegment = (p: Vec2, q: Vec2, r: Vec2): boolean =>
  Math.min(p.x, r.x) - EPS <= q.x &&
  q.x <= Math.max(p.x, r.x) + EPS &&
  Math.min(p.y, r.y) - EPS <= q.y &&
  q.y <= Math.max(p.y, r.y) + EPS;

// Les segments [p1,p2] et [p3,p4] se croisent-ils (y compris contacts/colinéaires) ?
export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross3(p3, p4, p1);
  const d2 = cross3(p3, p4, p2);
  const d3 = cross3(p1, p2, p3);
  const d4 = cross3(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;
  return false;
}

// Clampe un point dans le disque (centre, rayon). Sert à la zone atteignable du
// PRD 11 : la cible de visée ne peut sortir de ce que le grip permet de plier.
export function clampToDisk(p: Vec2, center: Vec2, radius: number): Vec2 {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius || d === 0) return p;
  const k = radius / d;
  return { x: center.x + dx * k, y: center.y + dy * k };
}

// Côté signé d'un point par rapport au segment orienté a->b (>0 : à gauche).
export const sideOf = (gate: Segment, p: Vec2): number => cross3(gate.a, gate.b, p);

// Le déplacement prev->next franchit-il `gate` dans le sens AVANT ?
// Convention : sens avant = de la gauche (côté > 0) vers la droite (côté < 0) de a->b.
// Les circuits orientent leurs portes a->b selon le sens de course.
export function crossesForward(gate: Segment, prev: Vec2, next: Vec2): boolean {
  if (!segmentsIntersect(gate.a, gate.b, prev, next)) return false;
  return sideOf(gate, prev) > 0 && sideOf(gate, next) < 0;
}
