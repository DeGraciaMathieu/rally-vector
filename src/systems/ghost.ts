// Fantôme : rejoue la séquence d'impulsions d'une Recording pour reconstruire, tour
// par tour, la position de la voiture fantôme. AUCUNE position n'est stockée — on
// repart du seed et on réinjecte les impulsions dans la simulation (preuve de P5).
// Repartir du départ re-seede le RNG à l'identique : un éventuel tête-à-queue (PRD 04)
// est rejoué exactement (dépendance fine PRD 04 ↔ 06).

import { RaceState, Tuning, createRaceState } from '../domain/gameState';
import { createRng } from '../domain/rng';
import { Vec2 } from '../domain/vec2';
import { carById } from '../data/cars';
import { resolveTrack } from '../data/tracks';
import { Recording } from './recorder';
import { advanceTurn } from './simulation';

// Position + cap du fantôme après i tours. frame[0] = départ.
export interface GhostFrame {
  readonly pos: Vec2;
  readonly heading: number;
}

// Reconstruit les positions du fantôme. Renvoie null si la Recording est absente ou
// d'une version de simulation obsolète (jamais rejouée faux — garde-fou PRD 06).
export function buildGhost(
  rec: Recording | null,
  tuning: Tuning,
  simVersion: number,
): GhostFrame[] | null {
  if (!rec || rec.simVersion !== simVersion) return null;
  const track = resolveTrack(rec.trackId);
  const car = carById(rec.carId);
  let state: RaceState = createRaceState(createRng(rec.seed), track.start);
  const frames: GhostFrame[] = [{ pos: state.car.pos, heading: state.car.heading }];
  for (const impulse of rec.impulses) {
    state = advanceTurn(state, track, tuning, car, impulse, rec.strict, rec.dispersion);
    frames.push({ pos: state.car.pos, heading: state.car.heading });
    if (state.phase === 'crashed') break;
  }
  return frames;
}
