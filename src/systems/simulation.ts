// Driver de simulation : gère idle | animating | crashed et le timing (wall-clock)
// de l'animation entre deux tours. L'animation est COSMÉTIQUE : elle n'influence
// jamais l'état déterministe, qui ne change qu'au franchissement du tour via domain/.

import {
  RaceState,
  ResolvedMove,
  Tuning,
  applyMove,
  beginMove,
  createRaceState,
  resolveMove,
  setImpulse,
} from '../domain/gameState';
import { createRng } from '../domain/rng';
import { Track, isSolid, surfaceAt } from '../domain/track';
import { Vec2, length, sub } from '../domain/vec2';
import { LapResult, detectLap } from './lap';

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

export interface TurnOutcome {
  readonly state: RaceState;
  readonly lapCompleted: boolean;
}

// Cœur déterministe d'un tour, sans animation : setImpulse → résoudre → appliquer
// → détecter la boucle. Utilisé par les tests de déterminisme et réutilisable.
export function advanceTurn(
  state: RaceState,
  track: Track,
  tuning: Tuning,
  impulse: Vec2,
): TurnOutcome {
  const aimed = setImpulse(state, impulse);
  const surf = surfaceAt(track, aimed.car.pos.x, aimed.car.pos.y);
  const move = resolveMove(aimed, surf, tuning, (x, y) => isSolid(track, x, y));
  const applied = applyMove(aimed, move);
  if (applied.phase === 'crashed') return { state: applied, lapCompleted: false };
  const lap: LapResult = detectLap(applied, track, move.from, move.to);
  return { state: lap.state, lapCompleted: lap.lapCompleted };
}

export class Simulation {
  private _state: RaceState;
  private _anim: Anim | null = null;

  constructor(
    private readonly track: Track,
    private readonly tuning: Tuning,
    private seed: number,
  ) {
    this._state = createRaceState(createRng(seed), track.startPos);
  }

  get state(): RaceState {
    return this._state;
  }

  get anim(): AnimView | null {
    return this._anim;
  }

  reset(seed: number = this.seed): void {
    this.seed = seed;
    this._state = createRaceState(createRng(seed), this.track.startPos);
    this._anim = null;
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
    const move = resolveMove(this._state, surf, this.tuning, (x, y) => isSolid(this.track, x, y));
    const dist = length(sub(move.to, move.from));
    const { min, max, pxPerMs } = this.tuning.anim;
    const dur = Math.min(max, Math.max(min, dist / pxPerMs));
    this._state = beginMove(this._state);
    this._anim = { from: move.from, to: move.to, heading: move.heading, t0: now, dur, move };
    return true;
  }

  // Avance le temps : finalise le tour quand l'animation est terminée.
  // Renvoie l'éventuelle complétion de boucle (pour le chrono côté root).
  update(now: number): { lapCompleted: boolean } {
    if (this._state.phase !== 'animating' || !this._anim) return { lapCompleted: false };
    if (now - this._anim.t0 < this._anim.dur) return { lapCompleted: false };

    const move = this._anim.move;
    this._anim = null;
    const applied = applyMove(this._state, move);
    if (applied.phase === 'crashed') {
      this._state = applied;
      return { lapCompleted: false };
    }
    const lap = detectLap(applied, this.track, move.from, move.to);
    this._state = lap.state;
    return { lapCompleted: lap.lapCompleted };
  }
}
