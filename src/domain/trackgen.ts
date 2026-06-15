// Génération procédurale d'une SPÉCIALE (étape A→B) déterministe par seed (P5).
// Le tracé est un couloir roulable qui progresse de gauche à droite par tronçons
// (horizontal puis vertical) : il relie toujours le départ à l'arrivée -> terminable
// par construction. Un BFS de connexité le prouve.
//
// La spine (centres exacts du tracé, largeur minimale `half`) est TOUJOURS dégagée :
// elle garantit la ligne de course. Autour d'elle, le rendu se veut naturel (PRD 14) :
// - bords de couloir irréguliers (largeur qui varie via un champ de bruit seedé) ;
// - sols répartis en taches lissées (champ de bruit) plutôt qu'en blocs par tronçon ;
// - flaques d'eau ponctuelles posées comme hazard ;
// - obstacles regroupés en grappes (hors-spine).
//
// Pur et SANS import de data/ : la palette, la table d'obstacles et les paramètres
// arrivent dans `cfg` (data les fournit). Déterministe : même (seed, cfg) -> même Track.
// Tout le hasard passe par le RNG seedé local, dans un ORDRE de tirage stable.

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
  readonly laneWidth: number; // largeur MINIMALE garantie du couloir (spine, impair)
  readonly laneWidthMax: number; // largeur MAXIMALE atteinte par dilatation des bords
  readonly surfaceNoiseScale: number; // échelle (tuiles) du champ de sol -> taille des taches
  readonly edgeThreshold: number; // seuil [0,1] de dilatation des bords (haut = couloir étroit)
  readonly roughChance: number; // part de sol non-route (terre/gravier) dans le champ
  readonly waterPatches: number; // nombre de flaques d'eau posées
  readonly waterPatchRadius: number; // rayon (tuiles) d'une flaque
  readonly obstacleClusters: number; // nombre de foyers d'obstacles
  readonly obstacleClusterRadius: number; // rayon (tuiles) d'un foyer
  readonly obstacleDensity: number; // proba de poser un obstacle sur une tuile DANS un foyer
  readonly roadId: SurfaceId;
  readonly roughIds: readonly SurfaceId[];
  readonly waterId: SurfaceId;
  readonly obstacleIds: readonly ObstacleId[];
  readonly outOfBounds: SurfaceId;
  readonly palette: Readonly<Record<SurfaceId, Surface>>;
  readonly obstacles: Readonly<Record<ObstacleId, Obstacle>>;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export function generateTrack(seed: number, cfg: GenConfig): Track {
  const { width: W, height: H, tileSize, columns } = cfg;
  let rng = createRng(seed);
  const next = (): number => {
    const r = nextRandom(rng);
    rng = r.rng;
    return r.value;
  };
  const randInt = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];

  const half = Math.floor(cfg.laneWidth / 2); // demi-largeur garantie (spine)
  const maxHalf = Math.floor(cfg.laneWidthMax / 2); // demi-largeur max après dilatation
  const margin = maxHalf + 1; // marge au bord pour que la dilatation reste dans la grille
  const runway = 4; // dégagement roulable après l'arrivée (on ne tape pas le mur en finissant)
  const idx = (c: number, r: number): number => r * W + c;
  const inBounds = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < W && r < H;

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

  // Champs de bruit seedés (valeur bilinéaire lissée). Tirés AVANT le carve, dans un
  // ordre fixe : un treillis grossier de valeurs, interpolé par tuile -> taches douces.
  const scale = cfg.surfaceNoiseScale;
  const latW = Math.floor(W / scale) + 2;
  const latH = Math.floor(H / scale) + 2;
  const buildField = (): number[] => {
    const lat = new Array<number>(latW * latH);
    for (let i = 0; i < lat.length; i++) lat[i] = next();
    return lat;
  };
  const surfLat = buildField(); // -> nature du sol (route/terre/gravier)
  const edgeLat = buildField(); // -> dilatation des bords
  const sample = (lat: number[], c: number, r: number): number => {
    const gx = c / scale;
    const gy = r / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smoothstep(gx - x0);
    const fy = smoothstep(gy - y0);
    const v00 = lat[y0 * latW + x0];
    const v10 = lat[y0 * latW + x0 + 1];
    const v01 = lat[(y0 + 1) * latW + x0];
    const v11 = lat[(y0 + 1) * latW + x0 + 1];
    const a = v00 + (v10 - v00) * fx;
    const b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
  };

  // Carve : autour de chaque tuile de tracé, un cœur garanti (rayon = half) toujours
  // dégagé + un anneau de dilatation (jusqu'à maxHalf) ouvert là où le bruit dépasse le
  // seuil -> bords irréguliers. Les centres forment la « spine » = ligne de course.
  const spine = new Set<number>();
  const open = (c: number, r: number): void => {
    if (inBounds(c, r) && tiles[idx(c, r)].surface === cfg.outOfBounds)
      tiles[idx(c, r)] = { surface: cfg.roadId };
  };
  const carve = (c: number, r: number): void => {
    for (let dr = -maxHalf; dr <= maxHalf; dr++)
      for (let dc = -maxHalf; dc <= maxHalf; dc++) {
        const cheb = Math.max(Math.abs(dr), Math.abs(dc));
        if (cheb <= half) open(c + dc, r + dr); // cœur garanti
        else if (cheb <= maxHalf && sample(edgeLat, c + dc, r + dr) > cfg.edgeThreshold)
          open(c + dc, r + dr); // dilatation organique
      }
    spine.add(idx(c, r));
  };

  for (let i = 0; i < columns; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = ys[i];
    const y1 = ys[i + 1];
    for (let c = Math.min(x0, x1); c <= Math.max(x0, x1); c++) carve(c, y0);
    for (let r = Math.min(y0, y1); r <= Math.max(y0, y1); r++) carve(x1, r);
  }

  // Dégagement après l'arrivée : runway roulable pour absorber la vitesse.
  for (let c = xs[columns]; c <= xs[columns] + runway; c++) carve(c, ys[columns]);

  const drivable = (c: number, r: number): boolean =>
    inBounds(c, r) && tiles[idx(c, r)].surface !== cfg.outOfBounds;

  // Sols en taches : chaque tuile roulable prend sa nature du champ de bruit. Bande
  // route [0, roadShare), puis le reste réparti entre les sols rugueux -> transitions
  // douces, plus de blocs rectangulaires par tronçon.
  const roadShare = 1 - cfg.roughChance;
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      if (!drivable(c, r)) continue;
      const f = sample(surfLat, c, r);
      let surface = cfg.roadId;
      if (f >= roadShare && cfg.roughIds.length > 0) {
        const t = (f - roadShare) / (1 - roadShare);
        const k = Math.min(cfg.roughIds.length - 1, Math.floor(t * cfg.roughIds.length));
        surface = cfg.roughIds[k];
      }
      tiles[idx(c, r)] = { surface };
    }

  // Tirage d'une tuile roulable au hasard (rejet borné) sous une contrainte.
  const pickTile = (ok: (c: number, r: number) => boolean): { c: number; r: number } | null => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const c = randInt(0, W - 1);
      const r = randInt(0, H - 1);
      if (drivable(c, r) && ok(c, r)) return { c, r };
    }
    return null;
  };

  // Flaques d'eau : hazard localisé posé sur des disques roulables. L'eau est
  // roulable (non solide) -> la terminabilité reste prouvée par la spine.
  const wr = cfg.waterPatchRadius;
  for (let i = 0; i < cfg.waterPatches; i++) {
    const center = pickTile(() => true);
    if (!center) continue;
    for (let dr = -wr; dr <= wr; dr++)
      for (let dc = -wr; dc <= wr; dc++)
        if (dc * dc + dr * dr <= wr * wr && drivable(center.c + dc, center.r + dr))
          tiles[idx(center.c + dc, center.r + dr)] = { surface: cfg.waterId };
  }

  // Obstacles en grappes : des foyers hors-spine, remplis aléatoirement dans leur rayon.
  // Jamais sur la spine (ligne de course), ni dans l'eau.
  const cr = cfg.obstacleClusterRadius;
  for (let i = 0; i < cfg.obstacleClusters; i++) {
    const focus = pickTile((c, r) => !spine.has(idx(c, r)));
    if (!focus) continue;
    for (let dr = -cr; dr <= cr; dr++)
      for (let dc = -cr; dc <= cr; dc++) {
        const place = next() < cfg.obstacleDensity;
        const c = focus.c + dc;
        const r = focus.r + dr;
        if (!place || !drivable(c, r) || spine.has(idx(c, r))) continue;
        const tile = tiles[idx(c, r)];
        if (tile.surface === cfg.waterId || tile.obstacle) continue;
        tiles[idx(c, r)] = { ...tile, obstacle: pick(cfg.obstacleIds) };
      }
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
