// État de course et transitions pures. C'est la frontière structurelle du PRD 00 :
// tout ce qui est déterministe vit ici ; l'animation et les chronos (wall-clock)
// restent dans systems/. domain/ ne mute jamais ses arguments.

import { Car } from './car';
import { Contact, ContactPolicy, classifyContact, firstHit } from './collision';
import { step } from './physics';
import { RngState, nextRandom } from './rng';
import { Surface } from './surfaces';
import { TrackStart } from './track';
import { Vec2, ZERO, add, angle, length, scale } from './vec2';

const TAU = Math.PI * 2;

export type RacePhase = 'idle' | 'animating' | 'crashed';

export interface CarState {
  readonly pos: Vec2;
  readonly vel: Vec2;
  readonly heading: number; // angle de la voiture (rad)
}

export interface RaceState {
  readonly car: CarState;
  readonly phase: RacePhase;
  readonly impulse: Vec2; // visée courante (ordre du pilote)
  readonly turns: number;
  readonly laps: number;
  readonly rng: RngState;
}

// Réglages d'équilibrage GLOBAUX (indépendants de la voiture et du circuit). Les
// caractéristiques véhicule (maxImpulse, maxSpeed, grip…) vivent désormais dans le
// Car ; la géométrie du circuit dans le Track.
export interface Tuning {
  readonly anim: { readonly min: number; readonly max: number; readonly pxPerMs: number };
  // Conséquences au contact (PRD 04). Seuils en fraction de maxSpeed.
  readonly contact: {
    readonly fatalSpeedFrac: number; // au-dessus -> fatal même sur cible souple
    readonly spinSpeedFrac: number; // [spin, fatal[ -> tête-à-queue ; en deçà -> graze
    readonly grazeSpeedKeep: number; // part de vitesse conservée après un frôlement
  };
  // Caméra (cosmétique, systems/render uniquement — hors déterminisme).
  readonly camera: {
    readonly viewport: { readonly width: number; readonly height: number };
    readonly followZoom: number; // zoom en mode suivi
    readonly smoothing: number; // facteur de lerp par frame vers la cible (0..1)
    readonly lookAhead: number; // multiplicateur de l'impulsion pour anticiper
    readonly deadZone: number; // impulsion en deçà (px) = pas d'anticipation
  };
}

// Résultat déterministe d'un tour : où l'on arrive, à quelle vitesse, et la
// conséquence du contact éventuel (null = aucun contact). La durée d'animation
// (cosmétique) est calculée par systems/, pas ici.
export interface ResolvedMove {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly newVel: Vec2;
  readonly heading: number;
  readonly contact: Contact | null;
}

export function createRaceState(seed: RngState, start: TrackStart): RaceState {
  return {
    car: { pos: start.pos, vel: ZERO, heading: start.heading },
    phase: 'idle',
    impulse: ZERO,
    turns: 0,
    laps: 0,
    rng: seed,
  };
}

export function setImpulse(state: RaceState, impulse: Vec2): RaceState {
  return { ...state, impulse };
}

// Calcule le déplacement d'un tour : impulsion + inertie, puis collision. Le contact
// éventuel est classé (fatal/spin/graze) selon la cible heurtée et la vitesse à
// l'impact ; `strict` force toujours fatal (mode crash = fin).
export function resolveMove(
  state: RaceState,
  surf: Surface,
  tuning: Tuning,
  car: Car,
  isSolid: (x: number, y: number) => boolean,
  contactAt: (x: number, y: number) => ContactPolicy,
  strict: boolean,
): ResolvedMove {
  const { car: body, impulse } = state;
  const newVel = step(body.vel, impulse, surf, car);
  const target = add(body.pos, newVel);
  const hit = firstHit(body.pos.x, body.pos.y, target.x, target.y, isSolid);
  const to = hit ? { x: hit.x, y: hit.y } : target;
  const delta = { x: to.x - body.pos.x, y: to.y - body.pos.y };
  const heading = length(delta) > 0.5 ? angle(delta) : body.heading;
  let contact: Contact | null = null;
  if (hit) {
    const kind = classifyContact(
      contactAt(hit.x, hit.y),
      length(newVel),
      {
        fatalSpeed: car.maxSpeed * tuning.contact.fatalSpeedFrac,
        spinSpeed: car.maxSpeed * tuning.contact.spinSpeedFrac,
      },
      strict,
    );
    contact = { kind };
  }
  return { from: body.pos, to, newVel, heading, contact };
}

// Entre en phase animée (transitoire, pilotée par systems/). L'animation est
// cosmétique : elle ne change rien d'autre dans l'état.
export function beginMove(state: RaceState): RaceState {
  return { ...state, phase: 'animating' };
}

// Applique un déplacement résolu et produit l'état post-tour, selon la conséquence :
// - aucun contact : tour normal (inertie conservée).
// - fatal : crash = fin (P2), vitesse annulée, phase 'crashed', le tour ne compte pas.
// - spin : tête-à-queue = arrêt + réorientation ALÉATOIRE SEEDÉE (consomme le RNG
//   de course — premier usage gameplay de P5). Le tour compte, on continue.
// - graze : frôlement = perte de vitesse sans arrêt. Le tour compte, on continue.
export function applyMove(state: RaceState, move: ResolvedMove, tuning: Tuning): RaceState {
  const contact = move.contact;
  if (!contact) {
    return {
      ...state,
      car: { pos: move.to, vel: move.newVel, heading: move.heading },
      phase: 'idle',
      impulse: ZERO,
      turns: state.turns + 1,
    };
  }
  if (contact.kind === 'fatal') {
    return {
      ...state,
      car: { pos: move.to, vel: ZERO, heading: move.heading },
      phase: 'crashed',
    };
  }
  if (contact.kind === 'spin') {
    const { value, rng } = nextRandom(state.rng);
    return {
      ...state,
      car: { pos: move.to, vel: ZERO, heading: value * TAU },
      phase: 'idle',
      impulse: ZERO,
      turns: state.turns + 1,
      rng,
    };
  }
  // graze
  return {
    ...state,
    car: { pos: move.to, vel: scale(move.newVel, tuning.contact.grazeSpeedKeep), heading: move.heading },
    phase: 'idle',
    impulse: ZERO,
    turns: state.turns + 1,
  };
}

// Compte une boucle. La détection géométrique ordonnée vit dans systems/lap.ts
// (LapTracker) ; la mutation du compteur passe toujours par domain/.
export function completeLap(state: RaceState): RaceState {
  return { ...state, laps: state.laps + 1 };
}
