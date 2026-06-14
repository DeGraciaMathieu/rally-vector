// Index des circuits disponibles. Données pures : aucune logique de jeu.

import type { Track } from '../../domain/track';
import { generateTrack } from '../../domain/trackgen';
import { GEN } from '../genParams';
import { track01 } from './track-01';
import { track02 } from './track-02';

export const tracks: readonly Track[] = [track01, track02];

export const trackById = (id: string): Track =>
  tracks.find((t) => t.id === id) ?? track01;

const STAGE_PREFIX = 'stage-';

// Résout un id en Track : circuit fait main, ou spéciale régénérée depuis son seed
// (`stage-<seed>`). Permet au fantôme (PRD 06) de rejouer une étape générée.
export const resolveTrack = (id: string): Track =>
  id.startsWith(STAGE_PREFIX) ? generateTrack(Number(id.slice(STAGE_PREFIX.length)), GEN) : trackById(id);
