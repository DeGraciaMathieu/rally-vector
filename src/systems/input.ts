// Entrées : pointeur (geste de visée) et clavier. PRD 11 — on ne « pousse » plus une
// force : on attrape la poignée (bout du vecteur vitesse) et on tire la cible où l'on
// veut finir. Saisir -> tirer -> lâcher : release = valide. Ne décide d'aucune règle
// de jeu (le mapping cible -> impulsion vit dans domain/) : il convertit les
// événements DOM en cible monde et appelle des callbacks fournis par le root. Sous
// caméra mobile, le point écran passe par `screenToWorld` (fourni par le root).

import { Car } from '../domain/car';
import { solveImpulse } from '../domain/physics';
import { Surface } from '../domain/surfaces';
import { Vec2, clampLength, length, sub } from '../domain/vec2';
import { Viewport } from './camera';

// Impulsion = (point visé − position voiture), bornée à maxImpulse. Pure.
// Modèle A historique (PRD < 11), conservé pour la régression et les tests.
export const aimToImpulse = (carPos: Vec2, point: Vec2, maxImpulse: number): Vec2 =>
  clampLength(sub(point, carPos), maxImpulse);

// Mapping pur geste -> impulsion (PRD 11). Zone morte : une cible trop proche de la
// voiture = roue libre (impulsion nulle). Sinon, solveImpulse clampe la cible dans le
// disque atteignable et renvoie l'impulsion qui l'atteint (passée telle quelle à step).
export function targetToImpulse(
  pos: Vec2,
  vel: Vec2,
  target: Vec2,
  surf: Surface,
  car: Car,
  cancelRadius: number,
): Vec2 {
  if (length(sub(target, pos)) < cancelRadius) return { x: 0, y: 0 };
  return solveImpulse(pos, vel, target, surf, car);
}

// Un geste quasi immobile (déplacement < seuil) est un tap accidentel à annuler.
export const isCancelGesture = (down: Vec2, up: Vec2, minDrag: number): boolean =>
  length(sub(up, down)) < minDrag;

export interface InputCallbacks {
  canAim: () => boolean; // vrai seulement à l'arrêt (phase idle)
  screenToWorld: (screen: Vec2) => Vec2; // mappe le point écran (viewport) en monde
  commitMinDrag: number; // déplacement pointeur min (px monde) pour qu'un geste compte
  onAim: (target: Vec2) => void; // prévisualisation : cible monde sous le pointeur
  onCommit: () => void; // release valide : anime le tour
  onCancel: () => void; // geste annulé : ne consomme pas le tour, remet la visée à zéro
  onReset: () => void;
  onToggleAid: () => void;
  onToggleView: () => void;
}

export function bindInput(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  cb: InputCallbacks,
): void {
  // Point client -> coordonnées viewport (px logiques) -> monde (via caméra).
  const toWorld = (ev: PointerEvent): Vec2 => {
    const r = canvas.getBoundingClientRect();
    const screen = {
      x: ((ev.clientX - r.left) / r.width) * viewport.width,
      y: ((ev.clientY - r.top) / r.height) * viewport.height,
    };
    return cb.screenToWorld(screen);
  };

  let grabbing = false;
  let downAt: Vec2 | null = null; // point de saisie (pour le seuil anti-tap)

  canvas.addEventListener('pointerdown', (e) => {
    if (!cb.canAim()) return;
    grabbing = true;
    canvas.setPointerCapture(e.pointerId);
    downAt = toWorld(e);
    cb.onAim(downAt);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (grabbing) cb.onAim(toWorld(e));
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!grabbing) return;
    grabbing = false;
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
    }
  });
}
