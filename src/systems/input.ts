// Entrées : pointeur (viser) et clavier. Convertit un point monde en impulsion
// bornée et câble les événements DOM. Ne décide d'aucune règle de jeu : il appelle
// des callbacks fournis par le root.

import { Track, trackHeight, trackWidth } from '../domain/track';
import { Vec2, clampLength, sub } from '../domain/vec2';

// Impulsion = (point visé − position voiture), bornée à maxImpulse. Pure.
export const aimToImpulse = (carPos: Vec2, point: Vec2, maxImpulse: number): Vec2 =>
  clampLength(sub(point, carPos), maxImpulse);

export interface InputCallbacks {
  getCarPos: () => Vec2;
  canAim: () => boolean; // vrai seulement à l'arrêt
  onAim: (impulse: Vec2) => void;
  onCommit: () => void;
  onReset: () => void;
  onToggleAid: () => void;
}

export function bindInput(
  canvas: HTMLCanvasElement,
  track: Track,
  maxImpulse: number,
  cb: InputCallbacks,
): void {
  const W = trackWidth(track);
  const H = trackHeight(track);

  const toWorld = (ev: PointerEvent): Vec2 => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * W,
      y: ((ev.clientY - r.top) / r.height) * H,
    };
  };
  const aim = (ev: PointerEvent): void =>
    cb.onAim(aimToImpulse(cb.getCarPos(), toWorld(ev), maxImpulse));

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
    }
  });
}
