// Persistance des records (localStorage) : un meilleur fantôme par (circuit, voiture).
// On ne stocke que des impulsions + métadonnées (taille négligeable). I/O = systems.

import { SIM_VERSION } from '../data/version';
import { Recording } from './recorder';

const key = (trackId: string, carId: string): string => `rv:ghost:${trackId}:${carId}`;

// Charge le record d'un couple (circuit, voiture). Rejette silencieusement un
// enregistrement d'une version de simulation obsolète ou illisible.
export function loadRecording(trackId: string, carId: string): Recording | null {
  try {
    const raw = localStorage.getItem(key(trackId, carId));
    if (!raw) return null;
    const rec = JSON.parse(raw) as Recording;
    if (rec.simVersion !== SIM_VERSION) return null;
    return rec;
  } catch {
    return null;
  }
}

export function saveRecording(rec: Recording): void {
  try {
    localStorage.setItem(key(rec.trackId, rec.carId), JSON.stringify(rec));
  } catch {
    /* quota dépassé ou mode privé : on ignore, le record reste en mémoire */
  }
}
