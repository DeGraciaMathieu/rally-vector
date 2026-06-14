// Suivi des tours : LapTracker ordonné. Un tour ne compte que si TOUS les
// checkpoints ont été franchis DANS L'ORDRE depuis le dernier passage de ligne,
// puis la ligne d'arrivée dans le bon sens. Franchissement = intersection de
// segments (déplacement = segment droit du tour), donc robuste aux grandes
// vitesses qui « sautent » par-dessus une ligne fine.
//
// Déterministe : un tracker neuf alimenté par la même suite de positions produit
// les mêmes LapEvent. La progression (prochain checkpoint) est interne au tracker ;
// le COMPTEUR de tours du RaceState est mis à jour via domain/ (completeLap).

import { crossesForward } from '../domain/geometry';
import { Track } from '../domain/track';
import { Vec2 } from '../domain/vec2';

export type LapEvent =
  | { readonly type: 'checkpoint'; readonly index: number }
  | { readonly type: 'lapComplete'; readonly lap: number };

export class LapTracker {
  private nextCp = 0; // index du prochain checkpoint attendu (dans l'ordre)
  private laps = 0;

  constructor(private readonly track: Track) {}

  reset(): void {
    this.nextCp = 0;
    this.laps = 0;
  }

  // Avance d'un déplacement prev->next et renvoie les événements déclenchés.
  update(prev: Vec2, next: Vec2): LapEvent[] {
    const events: LapEvent[] = [];
    const cps = this.track.checkpoints;

    // Franchir les checkpoints attendus, dans l'ordre (plusieurs possibles si un
    // long segment traverse deux portes consécutives dans le même tour).
    while (this.nextCp < cps.length && crossesForward(cps[this.nextCp], prev, next)) {
      events.push({ type: 'checkpoint', index: this.nextCp });
      this.nextCp++;
    }

    // Ligne d'arrivée : seulement une fois tous les checkpoints validés.
    if (this.nextCp >= cps.length && crossesForward(this.track.finishLine, prev, next)) {
      this.laps++;
      this.nextCp = 0;
      events.push({ type: 'lapComplete', lap: this.laps });
    }

    return events;
  }
}
