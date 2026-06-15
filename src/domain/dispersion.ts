// Cône d'incertitude (PRD 12) : l'impulsion VOULUE est perturbée par un bruit seedé
// avant d'entrer dans step — porter de la vitesse devient un pari (P2) et l'aide
// devient un cône qu'on apprend à lire (P3). Pur : consomme le RNG porté par l'état.
//
// ORDRE DE TIRAGE CANONIQUE (P5) : exactement 2 tirages par tour (angle puis
// magnitude), TOUJOURS, même impulsion nulle (roue libre) — sinon un rejeu se
// désynchronise. Ces 2 tirages viennent AVANT l'éventuel tirage de tête-à-queue
// (PRD 04, dans applyMove). Tout futur système seedé doit s'insérer après, jamais
// entre, pour préserver les fantômes (PRD 06).

import { Car } from './car';
import { RngState, nextRandom } from './rng';
import { Surface } from './surfaces';
import { Vec2 } from './vec2';

export interface DispersionTuning {
  readonly coneBase: number; // demi-angle de base (rad), quasi déterministe à l'arrêt
  readonly kV: number; // ajout à vitesse max (rad), pondéré par speed/maxSpeed
  readonly kSurf: number; // ajout sur grip nul (rad), pondéré par (1 - grip surface)
  readonly magJitter: number; // jitter de magnitude (fraction de la norme), ±
}

// Demi-angle du cône : base + vitesse + faible grip. Croît de façon MONOTONE avec la
// vitesse et avec (1 - grip). Pur, sans tirage (sert aussi à l'affichage du secteur).
export function coneHalfAngle(speed: number, surf: Surface, car: Car, t: DispersionTuning): number {
  const v = Math.min(speed / car.maxSpeed, 1);
  return t.coneBase + t.kV * v + t.kSurf * (1 - surf.grip);
}

// Perturbe l'impulsion voulue : rotation UNIFORME dans [-coneHalf, +coneHalf] + jitter
// de magnitude uniforme dans [1 - magJitter, 1 + magJitter]. Borne dure (fairness) :
// aucun tir hors de cette enveloppe. Renvoie l'impulsion appliquée ET le nouveau RNG.
export function perturb(
  impulse: Vec2,
  speed: number,
  surf: Surface,
  car: Car,
  t: DispersionTuning,
  rng: RngState,
): { impulse: Vec2; rng: RngState } {
  const a = nextRandom(rng); // tirage 1 : angle
  const m = nextRandom(a.rng); // tirage 2 : magnitude
  const half = coneHalfAngle(speed, surf, car, t);
  const ang = (a.value * 2 - 1) * half; // uniforme dans [-half, half]
  const mag = 1 + (m.value * 2 - 1) * t.magJitter; // uniforme dans [1±magJitter]
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return {
    impulse: {
      x: (impulse.x * cos - impulse.y * sin) * mag,
      y: (impulse.x * sin + impulse.y * cos) * mag,
    },
    rng: m.rng,
  };
}
