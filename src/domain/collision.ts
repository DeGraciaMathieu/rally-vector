// Détection de collision — pure. Le déplacement d'un tour est un segment droit ;
// on échantillonne tous les 4 px et on renvoie le premier point solide rencontré.
// La connaissance « ce point est-il solide ? » est injectée (isSolid), domain/ ne
// connaît pas le circuit.

export interface Hit {
  readonly x: number;
  readonly y: number;
  readonly t: number; // position le long du segment, dans ]0, 1]
}

export function firstHit(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  isSolid: (x: number, y: number) => boolean,
): Hit | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (isSolid(x, y)) return { x, y, t };
  }
  return null;
}
