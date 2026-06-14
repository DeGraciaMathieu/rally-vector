// Enregistreur de course : accumule la SÉQUENCE D'IMPULSIONS validées. Comme la
// simulation est déterministe (P5), c'est tout ce qu'il faut pour rejouer une course
// — aucune position n'est stockée. Une Recording = la séquence + le contexte qui la
// rend rejouable (seed, voiture, circuit, mode strict, version de simulation).

import { Vec2 } from '../domain/vec2';

export interface Recording {
  readonly simVersion: number; // garde-fou : rejet si la simulation a changé
  readonly seed: number;
  readonly carId: string;
  readonly trackId: string;
  readonly strict: boolean; // mode crash = fin au moment de l'enregistrement
  readonly timeMs: number; // temps de référence (meilleur tour en boucle, ou temps d'étape)
  readonly impulses: readonly Vec2[]; // séquence depuis le départ
}

export interface RecordingMeta {
  readonly simVersion: number;
  readonly seed: number;
  readonly carId: string;
  readonly trackId: string;
  readonly strict: boolean;
  readonly timeMs: number;
}

export class Recorder {
  private impulses: Vec2[] = [];

  record(impulse: Vec2): void {
    this.impulses.push(impulse);
  }

  reset(): void {
    this.impulses = [];
  }

  get length(): number {
    return this.impulses.length;
  }

  // Fige la séquence courante dans une Recording (copie défensive).
  toRecording(meta: RecordingMeta): Recording {
    return { ...meta, impulses: [...this.impulses] };
  }
}
