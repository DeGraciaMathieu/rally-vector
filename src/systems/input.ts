// Entrées : pointeur (viser) et clavier. Convertit un point monde en impulsion
// bornée et câble les événements DOM. Ne décide d'aucune règle de jeu : il appelle
// des callbacks fournis par le root. Sous caméra mobile, le point écran passe par
// `screenToWorld` (fourni par le root) pour rester précis quelle que soit la vue.

import { Vec2, clampLength, sub } from '../domain/vec2';
import { Viewport } from './camera';

// Impulsion = (point visé − position voiture), bornée à maxImpulse. Pure.
export const aimToImpulse = (carPos: Vec2, point: Vec2, maxImpulse: number): Vec2 =>
  clampLength(sub(point, carPos), maxImpulse);

export interface InputCallbacks {
  getCarPos: () => Vec2;
  getMaxImpulse: () => number; // borne d'impulsion de la voiture courante
  canAim: () => boolean; // vrai seulement à l'arrêt
  screenToWorld: (screen: Vec2) => Vec2; // mappe le point écran (viewport) en monde
  onAim: (impulse: Vec2) => void;
  onCommit: () => void;
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
  const aim = (ev: PointerEvent): void =>
    cb.onAim(aimToImpulse(cb.getCarPos(), toWorld(ev), cb.getMaxImpulse()));

  let pointing = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (!cb.canAim()) return;
    pointing = true;
    canvas.setPointerCapture(e.pointerId);
    aim(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointing) aim(e);
  });
  canvas.addEventListener('pointerup', () => {
    pointing = false;
  });
  canvas.addEventListener('pointercancel', () => {
    pointing = false;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      cb.onCommit();
    } else if (e.key === 'r' || e.key === 'R') {
      cb.onReset();
    } else if (e.key === 'a' || e.key === 'A') {
      cb.onToggleAid();
    } else if (e.key === 'c' || e.key === 'C') {
      cb.onToggleView();
    }
  });
}
