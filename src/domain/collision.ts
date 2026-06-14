// Détection de collision — pure. Le déplacement d'un tour est un segment droit ;
// on échantillonne tous les 4 px et on renvoie le premier point solide rencontré.
// La connaissance « ce point est-il solide ? » est injectée (isSolid), domain/ ne
// connaît pas le circuit.

export interface Hit {
  readonly x: number;
  readonly y: number;
  readonly t: number; // position le long du segment, dans ]0, 1]
}

// Politique de contact d'une cible solide (donnée portée par surface/obstacle) :
// 'fatal' = toujours fin de course (mur, arbre) ; 'soft' = conséquence graduée
// selon la vitesse à l'impact.
export type ContactPolicy = 'fatal' | 'soft';

// Conséquence d'un contact, dérivée de la cible + de la vitesse à l'impact.
export type ContactKind = 'fatal' | 'spin' | 'graze';
export interface Contact {
  readonly kind: ContactKind;
}

export interface ContactThresholds {
  readonly fatalSpeed: number; // au-dessus -> fatal même sur cible souple
  readonly spinSpeed: number; // [spinSpeed, fatalSpeed[ -> spin ; en deçà -> graze
}

// Classe un contact. En mode strict, ou contre une cible 'fatal', toujours fatal
// (préserve P2). Sinon graduation par vitesse. Pure et déterministe.
export function classifyContact(
  policy: ContactPolicy,
  impactSpeed: number,
  thresholds: ContactThresholds,
  strict: boolean,
): ContactKind {
  if (strict || policy === 'fatal') return 'fatal';
  if (impactSpeed >= thresholds.fatalSpeed) return 'fatal';
  if (impactSpeed >= thresholds.spinSpeed) return 'spin';
  return 'graze';
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
