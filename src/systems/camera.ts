// Caméra — état { x, y, zoom } et transformées écran<->monde, PURES. La caméra est
// purement cosmétique : elle ne lit ni n'écrit jamais le RaceState (argument de
// sûreté du déterminisme P5). Le suivi lissé (lerp wall-clock) est de l'orchestration
// temporelle : il vit ici, dans systems/, pas dans domain/.

import { Vec2 } from '../domain/vec2';

// (x, y) = point monde affiché au CENTRE du viewport ; zoom = px écran / px monde.
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

// Taille de la fenêtre de jeu, en px écran (logiques, hors DPR).
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

// Taille du monde (circuit), en px.
export interface Bounds {
  readonly width: number;
  readonly height: number;
}

export const worldToScreen = (cam: Camera, vp: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - cam.x) * cam.zoom + vp.width / 2,
  y: (p.y - cam.y) * cam.zoom + vp.height / 2,
});

export const screenToWorld = (cam: Camera, vp: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - vp.width / 2) / cam.zoom + cam.x,
  y: (p.y - vp.height / 2) / cam.zoom + cam.y,
});

// Borne un axe : centre le monde s'il est plus petit que le viewport, sinon empêche
// de montrer le vide au-delà des bords.
const clampAxis = (center: number, half: number, worldSize: number): number => {
  if (worldSize <= half * 2) return worldSize / 2;
  return Math.min(Math.max(center, half), worldSize - half);
};

// Clampe le centre caméra pour ne jamais afficher hors des bornes du circuit.
export const clampCamera = (cam: Camera, vp: Viewport, bounds: Bounds): Camera => ({
  zoom: cam.zoom,
  x: clampAxis(cam.x, vp.width / (2 * cam.zoom), bounds.width),
  y: clampAxis(cam.y, vp.height / (2 * cam.zoom), bounds.height),
});

// Cible de suivi : la voiture, décalée dans la direction de l'impulsion (look-ahead)
// au-delà d'une dead-zone. Pure.
export const followTarget = (
  focus: Vec2,
  impulse: Vec2,
  lookAhead: number,
  deadZone: number,
): Vec2 => {
  const m = Math.hypot(impulse.x, impulse.y);
  if (m < deadZone) return focus;
  return { x: focus.x + impulse.x * lookAhead, y: focus.y + impulse.y * lookAhead };
};

// Suivi lissé : lerp du centre courant vers la cible (clampée), puis re-clamp.
export const follow = (
  cam: Camera,
  target: Vec2,
  vp: Viewport,
  bounds: Bounds,
  smoothing: number,
): Camera => {
  const goal = clampCamera({ ...cam, x: target.x, y: target.y }, vp, bounds);
  return clampCamera(
    {
      zoom: cam.zoom,
      x: cam.x + (goal.x - cam.x) * smoothing,
      y: cam.y + (goal.y - cam.y) * smoothing,
    },
    vp,
    bounds,
  );
};

// Vue circuit : dézoom complet pour cadrer tout le tracé, centré.
export const fitCamera = (vp: Viewport, bounds: Bounds): Camera => ({
  x: bounds.width / 2,
  y: bounds.height / 2,
  zoom: Math.min(vp.width / bounds.width, vp.height / bounds.height),
});
