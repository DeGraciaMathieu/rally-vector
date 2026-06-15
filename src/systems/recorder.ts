// Enregistreur de course : accumule la SÉQUENCE D'IMPULSIONS validées. Comme la
// simulation est déterministe (P5), c'est tout ce qu'il faut pour rejouer une course
// — aucune position n'est stockée. Une Recording = la séquence + le contexte qui la
// rend rejouable (seed, voiture, circuit, mode strict, version de simulation).

import { ModId } from '../domain/turnmods';
import { Vec2 } from '../domain/vec2';

// Input d'un tour (PRD 13) : l'impulsion voulue ET le modificateur choisi. Le mod fait
// partie de l'input -> le fantôme rejoue les mêmes mods (sinon il diverge en silence).
export interface TurnInput {
  readonly impulse: Vec2;
  readonly mod: ModId;
}

export interface Recording {
  readonly simVersion: number; // garde-fou : rejet si la simulation a changé
  readonly seed: number;
  readonly carId: string;
  readonly trackId: string;
  readonly strict: boolean; // mode crash = fin au moment de l'enregistrement
  readonly dispersion: boolean; // cône d'incertitude actif à l'enregistrement (PRD 12)
  readonly timeMs: number; // temps de référence (meilleur tour en boucle, ou temps d'étape)
  readonly turns: readonly TurnInput[]; // séquence d'inputs depuis le départ
}

export interface RecordingMeta {
  readonly simVersion: number;
  readonly seed: number;
  readonly carId: string;
  readonly trackId: string;
  readonly strict: boolean;
  readonly dispersion: boolean;
  readonly timeMs: number;
}

export class Recorder {
  private turns: TurnInput[] = [];

  record(impulse: Vec2, mod: ModId): void {
    this.turns.push({ impulse, mod });
  }

  reset(): void {
    this.turns = [];
  }

  get length(): number {
    return this.turns.length;
  }

  // Fige la séquence courante dans une Recording (copie défensive).
  toRecording(meta: RecordingMeta): Recording {
    return { ...meta, turns: [...this.turns] };
  }
}
