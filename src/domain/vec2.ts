// Maths vecteurs 2D — pures et immuables. Chaque opération renvoie un nouveau Vec2.

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export const ZERO: Vec2 = { x: 0, y: 0 };

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const length = (a: Vec2): number => Math.hypot(a.x, a.y);

export const angle = (a: Vec2): number => Math.atan2(a.y, a.x);

// Borne la norme du vecteur à `max` (sans l'allonger s'il est plus court).
export const clampLength = (a: Vec2, max: number): Vec2 => {
  const m = length(a);
  if (m <= max || m === 0) return a;
  const k = max / m;
  return { x: a.x * k, y: a.y * k };
};

export const isZero = (a: Vec2): boolean => a.x === 0 && a.y === 0;
