// Génération procédurale d'une SPÉCIALE (étape A→B) déterministe par seed (P5).
// Le tracé est un couloir roulable de largeur garantie qui progresse de gauche à
// droite par tronçons (horizontal puis vertical) : il relie toujours le départ à
// l'arrivée -> terminable par construction. Un BFS de connexité le prouve.
//
// Pur et SANS import de data/ : la palette, la table d'obstacles et les paramètres
// arrivent dans `cfg` (data les fournit). Déterministe : même (seed, cfg) -> même Track.

import { Segment } from './geometry';
import { Obstacle, ObstacleId } from './obstacles';
import { createRng, nextRandom } from './rng';
import { Surface, SurfaceId } from './surfaces';
import { Tile, Track } from './track';
import { Vec2 } from './vec2';

export interface GenConfig {
  readonly width: number; // en tuiles
  readonly height: number;
  readonly tileSize: number;
  readonly columns: number; // nombre de tronçons gauche->droite
  readonly laneWidth: number; // largeur du couloir (tuiles, impair de préférence)
  readonly roughChance: number; // proba qu'un tronçon soit en terre/gravier
  readonly obstacleDensity: number; // proba d'obstacle sur une tuile de bord
  readonly roadId: SurfaceId;
  readonly roughIds: readonly SurfaceId[];
  readonly obstacleIds: readonly ObstacleId[];
  readonly outOfBounds: SurfaceId;
  readonly palette: Readonly<Record<SurfaceId, Surface>>;
  readonly obstacles: Readonly<Record<ObstacleId, Obstacle>>;
}

export function generateTrack(seed: number, cfg: GenConfig): Track {
  const { width: W, height: H, tileSize, columns, laneWidth } = cfg;
  let rng = createRng(seed);
  const next = (): number => {
    const r = nextRandom(rng);
    rng = r.rng;
    return r.value;
  };
  const randInt = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];

  const half = Math.floor(laneWidth / 2);
  const margin = half + 1;
  const runway = 4; // dégagement roulable après l'arrivée (on ne tape pas le mur en finissant)
  const idx = (c: number, r: number): number => r * W + c;

  const tiles: Tile[] = new Array(W * H);
  for (let i = 0; i < W * H; i++) tiles[i] = { surface: cfg.outOfBounds };

  // Waypoints : x réparti régulièrement gauche->droite, y aléatoire par colonne.
  // Le dernier tronçon est horizontal (y identique) pour une arrivée propre.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= columns; i++) {
    xs.push(Math.round(margin + ((W - 1 - 2 * margin - runway) * i) / columns));
    ys.push(randInt(margin, H - 1 - margin));
  }
  ys[columns] = ys[columns - 1];

  // Carve : un disque carré (rayon = half) autour de chaque tuile de tracé. Les
  // centres exacts forment la « spine » = ligne de course minimale (toujours dégagée).
  const spine = new Set<number>();
  const carve = (c: number, r: number, surf: SurfaceId): void => {
    for (let dr = -half; dr <= half; dr++)
      for (let dc = -half; dc <= half; dc++) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc >= 0 && rr >= 0 && cc < W && rr < H) tiles[idx(cc, rr)] = { surface: surf };
      }
    spine.add(idx(c, r));
  };

  for (let i = 0; i < columns; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = ys[i];
    const y1 = ys[i + 1];
    const surfH = next() < cfg.roughChance ? pick(cfg.roughIds) : cfg.roadId;
    for (let c = Math.min(x0, x1); c <= Math.max(x0, x1); c++) carve(c, y0, surfH);
    const surfV = next() < cfg.roughChance ? pick(cfg.roughIds) : cfg.roadId;
    for (let r = Math.min(y0, y1); r <= Math.max(y0, y1); r++) carve(x1, r, surfV);
  }

  // Dégagement après l'arrivée : runway roulable pour absorber la vitesse.
  for (let c = xs[columns]; c <= xs[columns] + runway; c++) carve(c, ys[columns], cfg.roadId);

  // Obstacles hors-spine uniquement : jamais sur l'unique ligne de course.
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const i = idx(c, r);
      if (spine.has(i) || tiles[i].surface === cfg.outOfBounds) continue;
      if (next() < cfg.obstacleDensity) tiles[i] = { ...tiles[i], obstacle: pick(cfg.obstacleIds) };
    }

  // Portes : tous les tronçons horizontaux vont vers la droite (sens +x), donc une
  // porte verticale orientée a(haut)->b(bas) a son sens AVANT vers la droite.
  const center = (c: number, r: number): Vec2 => ({ x: (c + 0.5) * tileSize, y: (r + 0.5) * tileSize });
  const L = (half + 0.5) * tileSize;
  const gate = (wp: Vec2): Segment => ({ a: { x: wp.x, y: wp.y - L }, b: { x: wp.x, y: wp.y + L } });

  const checkpoints: Segment[] = [];
  for (let i = 1; i < columns; i++) {
    const mx = Math.round((xs[i] + xs[i + 1]) / 2);
    checkpoints.push(gate(center(mx, ys[i])));
  }
  const finishLine = gate(center(xs[columns], ys[columns]));
  const start = { pos: center(xs[0], ys[0]), heading: 0 };

  const track: Track = {
    id: `stage-${seed}`,
    name: `Spéciale #${seed}`,
    kind: 'stage',
    width: W,
    height: H,
    tileSize,
    tiles,
    palette: cfg.palette,
    obstacles: cfg.obstacles,
    outOfBounds: cfg.outOfBounds,
    start,
    finishLine,
    checkpoints,
  };

  if (isTerminable(track)) return track;
  // Garde-fou (théoriquement inatteignable, la spine relie toujours A à B) :
  // on retire les obstacles pour garantir une ligne, sans changer le seed/id.
  return { ...track, tiles: tiles.map((t) => ({ surface: t.surface })) };
}

// Invariant d'accessibilité : existe-t-il un chemin de tuiles roulables du départ à
// l'arrivée ? (preuve de terminabilité, BFS 4-connexe sur les surfaces non solides.)
export function isTerminable(track: Track): boolean {
  const { width: W, height: H, tileSize, tiles, palette } = track;
  const passable = (c: number, r: number): boolean =>
    c >= 0 && r >= 0 && c < W && r < H && !palette[tiles[r * W + c].surface].solid;

  const sc = Math.floor(track.start.pos.x / tileSize);
  const sr = Math.floor(track.start.pos.y / tileSize);
  const fc = Math.floor((track.finishLine.a.x + track.finishLine.b.x) / 2 / tileSize);
  const fr = Math.floor((track.finishLine.a.y + track.finishLine.b.y) / 2 / tileSize);
  if (!passable(sc, sr) || !passable(fc, fr)) return false;

  const seen = new Uint8Array(W * H);
  const stack: number[] = [sr * W + sc];
  seen[sr * W + sc] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    const c = cur % W;
    const r = (cur - c) / W;
    if (c === fc && r === fr) return true;
    const nbs: [number, number][] = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ];
    for (const [nc, nr] of nbs) {
      if (passable(nc, nr) && !seen[nr * W + nc]) {
        seen[nr * W + nc] = 1;
        stack.push(nr * W + nc);
      }
    }
  }
  return false;
}
