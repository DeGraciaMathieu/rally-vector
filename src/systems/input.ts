// Entrées : pointeur (geste de visée) et clavier. PRD 11 — on ne « pousse » plus une
// force : on attrape la poignée (bout du vecteur vitesse) et on tire la cible où l'on
// veut finir. Saisir -> tirer -> lâcher : release = valide. Ne décide d'aucune règle
// de jeu (le mapping cible -> impulsion vit dans domain/) : il convertit les
// événements DOM en cible monde et appelle des callbacks fournis par le root. Sous
// caméra mobile, le point écran passe par `screenToWorld` (fourni par le root).

import { Car } from '../domain/car';
import { solveImpulse } from '../domain/physics';
import { Surface } from '../domain/surfaces';
import { TurnMods, NEUTRAL } from '../domain/turnmods';
import { Vec2, clampLength, length, sub } from '../domain/vec2';
import { Viewport } from './camera';

// Impulsion = (point visé − position voiture), bornée à maxImpulse. Pure.
// Modèle A historique (PRD < 11), conservé pour la régression et les tests.
export const aimToImpulse = (carPos: Vec2, point: Vec2, maxImpulse: number): Vec2 =>
  clampLength(sub(point, carPos), maxImpulse);

// Mapping pur geste -> impulsion (PRD 11). Zone morte : une cible trop proche de la
// voiture = roue libre (impulsion nulle). Sinon, solveImpulse clampe la cible dans le
// disque atteignable et renvoie l'impulsion qui l'atteint. `mods` (PRD 13) doit être le
// MÊME que celui appliqué au commit : sinon l'impulsion vise le mauvais disque et le
// modificateur n'a pas l'effet attendu sur le déplacement.
export function targetToImpulse(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  surf: Surface,
  car: Car,
  cancelRadius: number,
  mods: TurnMods = NEUTRAL,
): Vec2 {
  if (length(sub(target, pos)) < cancelRadius) return { x: 0, y: 0 };
  return solveImpulse(pos, vel, target, surf, car, mods);
}

// Un geste quasi immobile (déplacement < seuil) est un tap accidentel à annuler.
export const isCancelGesture = (down: Vec2, up: Vec2, minDrag: number): boolean =>
  length(sub(up, down)) < minDrag;

// Zone « ✕ Annuler » affichée pendant le drag (PRD 11). Coordonnées VIEWPORT (px
// logiques, fixées à l'écran, hors caméra) : relâcher dessus = annulation. Partagée
// avec render/ pour que l'affichage et la détection coïncident.
export interface CancelZone {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function cancelZoneRect(vp: Viewport): CancelZone {
  const w = 150;
  const h = 34;
  return { x: vp.width / 2 - w / 2, y: 12, w, h };
}

export const inCancelZone = (screen: Vec2, z: CancelZone): boolean =>
  screen.x >= z.x && screen.x <= z.x + z.w && screen.y >= z.y && screen.y <= z.y + z.h;

export interface InputCallbacks {
  canAim: () => boolean; // vrai seulement à l'arrêt (phase idle)
  screenToWorld: (screen: Vec2) => Vec2; // mappe le point écran (viewport) en monde
  commitMinDrag: number; // déplacement pointeur min (px monde) pour qu'un geste compte
  onAim: (target: Vec2) => void; // prévisualisation : cible monde sous le pointeur
  onDrag: (active: boolean, overCancel: boolean) => void; // état du drag (affichage zone)
  onCommit: () => void; // release valide : anime le tour
  onCancel: () => void; // geste annulé : ne consomme pas le tour, remet la visée à zéro
  onReset: () => void;
  onToggleAid: () => void;
  onToggleView: () => void;
  onToggleDispersion: () => void;
  onCycleMod: () => void; // cycle le modificateur de tour (PRD 13)
}

export function bindInput(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  cb: InputCallbacks,
): void {
  const zone = cancelZoneRect(viewport);
  // Point client -> coordonnées VIEWPORT (px logiques).
  const toScreen = (ev: PointerEvent): Vec2 => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * viewport.width,
      y: ((ev.clientY - r.top) / r.height) * viewport.height,
    };
  };
  // ... puis -> monde (via caméra).
  const toWorld = (ev: PointerEvent): Vec2 => cb.screenToWorld(toScreen(ev));

  let grabbing = false;
  let downAt: Vec2 | null = null; // point de saisie (pour le seuil anti-tap)

  canvas.addEventListener('pointerdown', (e) => {
    if (!cb.canAim()) return;
    grabbing = true;
    canvas.setPointerCapture(e.pointerId);
    downAt = toWorld(e);
    cb.onDrag(true, false);
    cb.onAim(downAt);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!grabbing) return;
    cb.onDrag(true, inCancelZone(toScreen(e), zone));
    cb.onAim(toWorld(e));
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!grabbing) return;
    grabbing = false;
    cb.onDrag(false, false);
    // Relâcher sur la zone « ✕ Annuler » = annulation explicite (ne consomme pas le tour).
    if (inCancelZone(toScreen(e), zone)) {
      cb.onCancel();
      downAt = null;
      return;
    }
    const up = toWorld(e);
    // Tap quasi immobile = geste accidentel : on annule (anti-commit au doigt).
    if (downAt && isCancelGesture(downAt, up, cb.commitMinDrag)) cb.onCancel();
    else cb.onCommit();
    downAt = null;
  });
  // Geste interrompu (sortie de cadre, etc.) = annulation : ne consomme pas le tour.
  canvas.addEventListener('pointercancel', () => {
    if (!grabbing) return;
    grabbing = false;
    downAt = null;
    cb.onDrag(false, false);
    cb.onCancel();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      cb.onCommit(); // validation alternative (délibération / accessibilité)
    } else if (e.code === 'Escape') {
      cb.onCancel(); // annulation explicite
    } else if (e.key === 'r' || e.key === 'R') {
      cb.onReset();
    } else if (e.key === 'a' || e.key === 'A') {
      cb.onToggleAid();
    } else if (e.key === 'c' || e.key === 'C') {
      cb.onToggleView();
    } else if (e.key === 'd' || e.key === 'D') {
      cb.onToggleDispersion();
    } else if (e.key === 'm' || e.key === 'M') {
      cb.onCycleMod();
    }
  });
}
