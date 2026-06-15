// Génération procédurale d'une SPÉCIALE (étape A→B) déterministe par seed (P5).
// Le tracé est un SERPENTIN (boustrophédon) qui remplit la carte : des bandes
// horizontales alternées (gauche↔droite) reliées par des connecteurs verticaux à
// leurs extrémités — les épingles. Il relie toujours A (haut-gauche) à B (extrémité
// de la dernière bande) -> terminable par construction. Un BFS de connexité le prouve.
//
// La spine (centres exacts du tracé, largeur minimale `half`) est TOUJOURS dégagée :
// elle garantit la ligne de course. Les bandes sont espacées d'au moins `bandGap`
// tuiles : deux passes parallèles ne FUSIONNENT jamais en zone ouverte (anti-fusion
// structurelle), donc la ligne de course reste un couloir lisible (PRD 15, P3/P4).
// Autour, le rendu se veut naturel (PRD 14) : bords irréguliers, sols en taches,
// flaques d'eau, obstacles en grappes.
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
  readonly laneWidth: number; // largeur MINIMALE garantie du couloir (spine, impair)
  readonly laneWidthMax: number; // largeur MAXIMALE atteinte par dilatation des bords
  readonly bandGap: number; // espacement vertical minimal entre bandes (anti-fusion)
  readonly surfaceNoiseScale: number; // échelle (tuiles) du champ de sol -> taille des taches
  readonly edgeThreshold: number; // seuil [0,1] de dilatation des bords (haut = couloir étroit)
  readonly roughChance: number; // part de sol non-route (terre/gravier) dans le champ
  readonly waterPatches: number; // nombre de flaques d'eau posées
  readonly waterPatchRadius: number; // rayon (tuiles) d'une flaque
  readonly obstacleClusters: number; // nombre de foyers d'obstacles
  readonly obstacleClusterRadius: number; // rayon (tuiles) d'un foyer
  readonly obstacleDensity: number; // proba de poser un obstacle sur une tuile DANS un foyer
  readonly finishClearRadius: number; // rayon (tuiles) sans obstacle autour de l'arrivée
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
  const { width: W, height: H, tileSize } = cfg;
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

  // Serpentin : bandes horizontales réparties régulièrement sur la hauteur utile, à au
  // moins `bandGap` les unes des autres (anti-fusion). Le nombre de bandes varie par
  // seed -> tracés de densités différentes. La 1re bande tient le départ (haut-gauche).
  const xL = margin;
  const xR = W - 1 - margin;
  const usableH = H - 1 - 2 * margin;
  const maxBands = Math.max(2, Math.floor(usableH / cfg.bandGap) + 1);
  const bands = randInt(Math.max(2, maxBands - 1), maxBands);
  const rowAt = (k: number): number => Math.round(margin + (usableH * k) / (bands - 1));

  // Coins du serpentin : entrée + sortie de chaque bande ; les segments entre deux
  // coins consécutifs incluent automatiquement les connecteurs verticaux (épingles).
  const corners: Vec2[] = [];
  for (let k = 0; k < bands; k++) {
    const leftToRight = k % 2 === 0;
    corners.push({ x: leftToRight ? xL : xR, y: rowAt(k) });
    corners.push({ x: leftToRight ? xR : xL, y: rowAt(k) });
  }
  const lastLeftToRight = (bands - 1) % 2 === 0;
  const finishDir: Vec2 = { x: lastLeftToRight ? 1 : -1, y: 0 };

  // Champs de bruit seedés (valeur bilinéaire lissée), tirés dans un ordre fixe.
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
  // Carve d'un segment axis-aligned (horizontal OU vertical) reliant deux coins.
  const carveSegment = (p: Vec2, q: Vec2): void => {
    if (p.y === q.y) for (let c = Math.min(p.x, q.x); c <= Math.max(p.x, q.x); c++) carve(c, p.y);
    else for (let r = Math.min(p.y, q.y); r <= Math.max(p.y, q.y); r++) carve(p.x, r);
  };
  for (let i = 0; i + 1 < corners.length; i++) carveSegment(corners[i], corners[i + 1]);

  // Dégagement après l'arrivée : runway roulable dans le sens de la course.
  const finish = corners[corners.length - 1];
  for (let i = 1; i <= runway; i++) carve(finish.x + finishDir.x * i, finish.y);

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

  // Zone dégagée autour de l'arrivée : aucun obstacle à proximité de la ligne, pour
  // ne pas piéger le franchissement final (boîte de Chebyshev autour de l'arrivée).
  const nearFinish = (c: number, r: number): boolean =>
    Math.abs(c - finish.x) <= cfg.finishClearRadius && Math.abs(r - finish.y) <= cfg.finishClearRadius;

  // Obstacles en grappes : des foyers hors-spine, remplis aléatoirement dans leur rayon.
  // Jamais sur la spine (ligne de course), dans l'eau, ni près de l'arrivée.
  const cr = cfg.obstacleClusterRadius;
  for (let i = 0; i < cfg.obstacleClusters; i++) {
    const focus = pickTile((c, r) => !spine.has(idx(c, r)) && !nearFinish(c, r));
    if (!focus) continue;
    for (let dr = -cr; dr <= cr; dr++)
      for (let dc = -cr; dc <= cr; dc++) {
        const place = next() < cfg.obstacleDensity;
        const c = focus.c + dc;
        const r = focus.r + dr;
        if (!place || !drivable(c, r) || spine.has(idx(c, r)) || nearFinish(c, r)) continue;
        const tile = tiles[idx(c, r)];
        if (tile.surface === cfg.waterId || tile.obstacle) continue;
        tiles[idx(c, r)] = { ...tile, obstacle: pick(cfg.obstacleIds) };
      }
  }

  // Portes orientées selon le SENS LOCAL du tracé (a->b perpendiculaire au sens, le
  // côté gauche de a->b étant l'amont). La porte couvre la pleine largeur (maxHalf)
  // pour qu'on ne la contourne pas par un bord dilaté. Avec les épingles, le sens
  // d'une bande est ±x ; lap.ts lit ce sens dans l'orientation a->b.
  const Lg = (maxHalf + 0.5) * tileSize;
  const center = (c: number, r: number): Vec2 => ({ x: (c + 0.5) * tileSize, y: (r + 0.5) * tileSize });
  const gate = (wp: Vec2, dir: Vec2): Segment => {
    const perp = { x: -dir.y, y: dir.x };
    return {
      a: { x: wp.x - Lg * perp.x, y: wp.y - Lg * perp.y },
      b: { x: wp.x + Lg * perp.x, y: wp.y + Lg * perp.y },
    };
  };

  // Un checkpoint au milieu de chaque bande, dans l'ordre du serpentin ; arrivée à
  // l'extrémité de la dernière bande, après son checkpoint.
  const checkpoints: Segment[] = [];
  for (let k = 0; k < bands; k++) {
    const leftToRight = k % 2 === 0;
    const mx = Math.round((xL + xR) / 2);
    checkpoints.push(gate(center(mx, rowAt(k)), { x: leftToRight ? 1 : -1, y: 0 }));
  }
  const finishLine = gate(center(finish.x, finish.y), finishDir);
  const start = { pos: center(corners[0].x, corners[0].y), heading: 0 };

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
