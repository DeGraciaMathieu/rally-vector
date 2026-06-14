// État de course et transitions pures. C'est la frontière structurelle du PRD 00 :
// tout ce qui est déterministe vit ici ; l'animation et les chronos (wall-clock)
// restent dans systems/. domain/ ne mute jamais ses arguments.

import { firstHit } from './collision';
import { step } from './physics';
import { RngState } from './rng';
import { Surface } from './surfaces';
import { Vec2, ZERO, add, length, angle } from './vec2';

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
  readonly armed: boolean; // checkpoint validé sur la boucle en cours
  readonly rng: RngState;
}

// Réglages d'équilibrage. La TABLE de valeurs vit dans data/tuning.ts ;
// step() n'en lit qu'un sous-ensemble (maxSpeed, angleGripLoss).
export interface Tuning {
  readonly TILE: number;
  readonly COLS: number;
  readonly ROWS: number;
  readonly maxImpulse: number;
  readonly maxSpeed: number;
  readonly angleGripLoss: number;
  readonly anim: { readonly min: number; readonly max: number; readonly pxPerMs: number };
}

// Résultat déterministe d'un tour : où l'on arrive, à quelle vitesse, et si on tape.
// La durée d'animation (cosmétique) est calculée par systems/, pas ici.
export interface ResolvedMove {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly newVel: Vec2;
  readonly heading: number;
  readonly crash: boolean;
}

export function createRaceState(seed: RngState, startPos: Vec2): RaceState {
  return {
    car: { pos: startPos, vel: ZERO, heading: 0 },
    phase: 'idle',
    impulse: ZERO,
    turns: 0,
    laps: 0,
    armed: false,
    rng: seed,
  };
}

export function setImpulse(state: RaceState, impulse: Vec2): RaceState {
  return { ...state, impulse };
}

// Calcule le déplacement d'un tour : impulsion + inertie, puis collision.
export function resolveMove(
  state: RaceState,
  surf: Surface,
  tuning: Tuning,
  isSolid: (x: number, y: number) => boolean,
): ResolvedMove {
  const { car, impulse } = state;
  const newVel = step(car.vel, impulse, surf, tuning);
  const target = add(car.pos, newVel);
  const hit = firstHit(car.pos.x, car.pos.y, target.x, target.y, isSolid);
  const to = hit ? { x: hit.x, y: hit.y } : target;
  const delta = { x: to.x - car.pos.x, y: to.y - car.pos.y };
  const heading = length(delta) > 0.5 ? angle(delta) : car.heading;
  return { from: car.pos, to, newVel, heading, crash: !!hit };
}

// Entre en phase animée (transitoire, pilotée par systems/). L'animation est
// cosmétique : elle ne change rien d'autre dans l'état.
export function beginMove(state: RaceState): RaceState {
  return { ...state, phase: 'animating' };
}

// Applique un déplacement résolu et produit l'état post-tour.
// Crash = fin (P2) : vitesse annulée, phase 'crashed', le tour ne compte pas.
export function applyMove(state: RaceState, move: ResolvedMove): RaceState {
  if (move.crash) {
    return {
      ...state,
      car: { pos: move.to, vel: ZERO, heading: move.heading },
      phase: 'crashed',
    };
  }
  return {
    ...state,
    car: { pos: move.to, vel: move.newVel, heading: move.heading },
    phase: 'idle',
    impulse: ZERO,
    turns: state.turns + 1,
  };
}

// Transitions de boucle — le DÉTECTION géométrique vit dans systems/lap.ts,
// mais la mutation d'état passe toujours par domain/.
export function arm(state: RaceState): RaceState {
  return state.armed ? state : { ...state, armed: true };
}

export function completeLap(state: RaceState): RaceState {
  return { ...state, laps: state.laps + 1, armed: false };
}
