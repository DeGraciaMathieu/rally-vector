// Index des circuits disponibles. Données pures : aucune logique de jeu.

import type { Track } from '../../domain/track';
import { track01 } from './track-01';
import { track02 } from './track-02';

export const tracks: readonly Track[] = [track01, track02];

export const trackById = (id: string): Track =>
  tracks.find((t) => t.id === id) ?? track01;
