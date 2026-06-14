// Suivi des tours/checkpoints. La géométrie de franchissement vit ici (systems),
// mais la mutation de l'état passe par domain/ (arm / completeLap). Pure et
// déterministe : pas d'horloge. Le chrono (wall-clock) est géré par le root.

import { RaceState, arm, completeLap } from '../domain/gameState';
import { Track } from '../domain/track';
import { Vec2 } from '../domain/vec2';

export interface LapResult {
  readonly state: RaceState;
  readonly lapCompleted: boolean;
}

// Arme le checkpoint si on le traverse, puis compte une boucle au franchissement
// de la ligne d'arrivée vers la droite (sens correct uniquement) checkpoint armé.
export function detectLap(state: RaceState, track: Track, from: Vec2, to: Vec2): LapResult {
  let next = state;

  const cp = track.checkpoint;
  if (to.x >= cp.x0 && to.x <= cp.x1 && to.y >= cp.y0 && to.y <= cp.y1) {
    next = arm(next);
  }

  const fx = track.finishX;
  if (next.armed && from.x < fx && to.x >= fx && to.y < 4 * track.TILE) {
    return { state: completeLap(next), lapCompleted: true };
  }

  return { state: next, lapCompleted: false };
}
