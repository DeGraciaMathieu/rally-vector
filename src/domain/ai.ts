// Pilote IA d'un bot — PUR et déterministe (P5). Aucun accès global, aucun
// Math.random : le bruit de visée passe par le RNG seedé porté dans l'état du bot.
//
// Heuristique : le bot VISE le prochain waypoint (centre de checkpoint puis arrivée)
// via `solveImpulse` (mapping cible -> impulsion, déjà clampé au disque atteignable,
// donc inertie prise en compte — P1 : on plie la quantité de mouvement, on ne pointe
// pas bêtement la cible). Le PROFIL module la poussée : agressivité (fraction du coup
// idéal) et anticipation (on lève le pied dans un virage serré à grande vitesse). Un
// bruit de visée seedé donne le « skill » imparfait.

import { Car } from './car';
import { firstHit } from './collision';
import { CarState } from './gameState';
import { solveImpulse, step } from './physics';
import { RngState, nextRandom } from './rng';
import { Surface } from './surfaces';
import { Vec2, add, clampLength, dot, length, scale, sub } from './vec2';

export interface BotProfile {
  readonly id: string;
  readonly label: string;
  readonly livery: string; // couleur de carrosserie
  readonly aggression: number; // fraction du coup idéal jouée (0..1) — haut = fonce
  readonly brakeMargin: number; // anticipation : lève le pied dans un virage serré rapide (0..1)
  readonly aimJitter: number; // bruit seedé sur la direction visée (rad)
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const rotate = (v: Vec2, a: number): Vec2 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
const THROTTLE_STEPS = 6; // paliers du gouverneur anti-mur (lookahead d'un tour)

// Décide l'impulsion du bot pour le tour. Pur : mêmes entrées -> même sortie, et
// renvoie le nouvel état RNG (un tirage fixe pour le bruit de visée).
// `speedLimit` est la vitesse max tolérée ce tour (freinage anticipé avant un virage,
// calculé par le peloton qui connaît la ligne de course). `isSolid` permet un lookahead
// d'un tour : le bot lève le pied jusqu'à rester hors mur ET sous la limite de vitesse,
// et freine à contresens s'il est acculé.
export function decideImpulse(
  body: CarState,
  target: Vec2,
  surf: Surface,
  car: Car,
  profile: BotProfile,
  speedLimit: number,
  isSolid: (x: number, y: number) => boolean,
  rng: RngState,
): { impulse: Vec2; rng: RngState } {
  // Coup idéal pour amener l'endpoint sur la cible (clampé au disque atteignable),
  // bruité par la visée imparfaite du profil (un tirage seedé).
  const { value, rng: next } = nextRandom(rng);
  const jit = (value * 2 - 1) * profile.aimJitter;
  const aimed = rotate(solveImpulse(body.pos, body.vel, target, surf, car), jit);

  // Anticipation : netteté du virage entre l'inertie et la direction vers la cible,
  // pondérée par la fraction de vitesse -> on freine avant un virage serré à fond.
  const speed = length(body.vel);
  const toAim = sub(target, body.pos);
  let turn = 0;
  if (speed > 1e-6 && length(toAim) > 1e-6) {
    const cos = dot(body.vel, toAim) / (speed * length(toAim));
    turn = (1 - cos) / 2; // 0 (tout droit) -> 1 (demi-tour)
  }
  const speedFrac = car.maxSpeed > 0 ? Math.min(speed / car.maxSpeed, 1) : 0;
  const base = clamp01(profile.aggression * (1 - profile.brakeMargin * turn * speedFrac));

  // Gouverneur : plus grande fraction de poussée dont le déplacement (inertie +
  // impulsion) ne tape pas un mur ce tour ET reste sous la limite de vitesse (freinage
  // anticipé avant un virage). Si rien ne convient, on freine à contresens.
  const ok = (imp: Vec2): boolean => {
    const nv = step(body.vel, imp, surf, car);
    if (length(nv) > speedLimit + 1e-6) return false;
    const to = add(body.pos, nv);
    return !firstHit(body.pos.x, body.pos.y, to.x, to.y, isSolid);
  };
  let impulse: Vec2 = { x: 0, y: 0 };
  let found = false;
  for (let k = THROTTLE_STEPS; k >= 0; k--) {
    const imp = scale(aimed, (base * k) / THROTTLE_STEPS);
    if (ok(imp)) {
      impulse = imp;
      found = true;
      break;
    }
  }
  // Acculé (mur imminent ou trop rapide) : freiner fort à contresens pour scrubber.
  if (!found) impulse = scale(body.vel, -1);

  return { impulse: clampLength(impulse, car.maxImpulse), rng: next };
}
