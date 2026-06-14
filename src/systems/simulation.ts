// Driver de simulation : gère idle | animating | crashed et le timing (wall-clock)
// de l'animation entre deux tours. L'animation est COSMÉTIQUE : elle n'influence
// jamais l'état déterministe, qui ne change qu'au franchissement du tour via domain/.
// Le comptage de tours est délégué au LapTracker (ordonné) ; le compteur du
// RaceState est mis à jour via domain/completeLap.

import {
  RaceState,
  ResolvedMove,
  Tuning,
  applyMove,
  beginMove,
  completeLap,
  createRaceState,
  resolveMove,
  setImpulse,
} from '../domain/gameState';
import { Car } from '../domain/car';
import { ContactKind } from '../domain/collision';
import { createRng } from '../domain/rng';
import { Track, contactAt, isSolid, surfaceAt } from '../domain/track';
import { Vec2, length, sub } from '../domain/vec2';
import { LapEvent, LapTracker } from './lap';

// Vue d'animation lue par render/ (jamais écrite par lui). Purement visuelle.
export interface AnimView {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly heading: number;
  readonly t0: number; // début (wall-clock ms)
  readonly dur: number; // durée (ms)
}

interface Anim extends AnimView {
  readonly move: ResolvedMove;
}

// Progression interpolée (easing out) d'un tour animé, dans [0, 1]. Cosmétique.
export function animEase(anim: AnimView, now: number): number {
  const t = Math.min(1, (now - anim.t0) / anim.dur);
  return 1 - Math.pow(1 - t, 2);
}

// Position interpolée de la voiture pendant un tour animé. Cosmétique : lue par
// render/ (dessin) et par la caméra (suivi), jamais réinjectée dans l'état.
export function animPos(anim: AnimView, now: number): Vec2 {
  const e = animEase(anim, now);
  return { x: anim.from.x + (anim.to.x - anim.from.x) * e, y: anim.from.y + (anim.to.y - anim.from.y) * e };
}

// Cœur déterministe d'un tour, sans animation ni comptage : setImpulse → résoudre
// → appliquer. Utilisé par les tests de déterminisme du RaceState et réutilisable.
// `strict` (défaut true) = mode crash = fin systématique (préserve P2).
export function advanceTurn(
  state: RaceState,
  track: Track,
  tuning: Tuning,
  car: Car,
  impulse: Vec2,
  strict = true,
): RaceState {
  const aimed = setImpulse(state, impulse);
  const surf = surfaceAt(track, aimed.car.pos.x, aimed.car.pos.y);
  const move = resolveMove(
    aimed,
    surf,
    tuning,
    car,
    (x, y) => isSolid(track, x, y),
    (x, y) => contactAt(track, x, y),
    strict,
  );
  return applyMove(aimed, move, tuning);
}

export interface TurnResult {
  readonly events: LapEvent[];
  readonly contact: ContactKind | null; // conséquence appliquée ce tour (cosmétique)
}

export class Simulation {
  private _state: RaceState;
  private _anim: Anim | null = null;
  private _strict: boolean;
  private _car: Car;
  private readonly laps: LapTracker;

  constructor(
    private readonly track: Track,
    private readonly tuning: Tuning,
    car: Car,
    private seed: number,
    strict = true,
  ) {
    this._state = createRaceState(createRng(seed), track.start);
    this._strict = strict;
    this._car = car;
    this.laps = new LapTracker(track);
  }

  // Mode strict : crash = fin systématique (préserve la version d'origine).
  setStrict(strict: boolean): void {
    this._strict = strict;
  }

  // Voiture sélectionnée (caractéristiques lues par la physique).
  setCar(car: Car): void {
    this._car = car;
  }

  get state(): RaceState {
    return this._state;
  }

  get anim(): AnimView | null {
    return this._anim;
  }

  reset(seed: number = this.seed): void {
    this.seed = seed;
    this._state = createRaceState(createRng(seed), this.track.start);
    this._anim = null;
    this.laps.reset();
  }

  // Met à jour la visée courante (seulement à l'arrêt).
  aim(impulse: Vec2): void {
    if (this._state.phase !== 'idle') return;
    this._state = setImpulse(this._state, impulse);
  }

  // Valide le déplacement : résout le tour et lance l'animation.
  commit(now: number): boolean {
    if (this._state.phase !== 'idle') return false;
    const surf = surfaceAt(this.track, this._state.car.pos.x, this._state.car.pos.y);
    const move = resolveMove(
      this._state,
      surf,
      this.tuning,
      this._car,
      (x, y) => isSolid(this.track, x, y),
      (x, y) => contactAt(this.track, x, y),
      this._strict,
    );
    const dist = length(sub(move.to, move.from));
    const { min, max, pxPerMs } = this.tuning.anim;
    const dur = Math.min(max, Math.max(min, dist / pxPerMs));
    this._state = beginMove(this._state);
    this._anim = { from: move.from, to: move.to, heading: move.heading, t0: now, dur, move };
    return true;
  }

  // Avance le temps : finalise le tour quand l'animation est terminée.
  // Renvoie les événements de boucle (pour le chrono côté root).
  update(now: number): TurnResult {
    if (this._state.phase !== 'animating' || !this._anim) return { events: [], contact: null };
    if (now - this._anim.t0 < this._anim.dur) return { events: [], contact: null };

    const move = this._anim.move;
    this._anim = null;
    const contact = move.contact ? move.contact.kind : null;
    const applied = applyMove(this._state, move, this.tuning);
    if (applied.phase === 'crashed') {
      this._state = applied;
      return { events: [], contact };
    }

    const events = this.laps.update(move.from, move.to);
    let next = applied;
    for (const ev of events) {
      if (ev.type === 'lapComplete') next = completeLap(next);
    }
    this._state = next;
    return { events, contact };
  }
}
