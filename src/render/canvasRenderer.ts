// Rendu canvas 2D. Lit l'état et l'anim, dessine. NE DÉCIDE RIEN et NE MUTE RIEN :
// le fantôme « prévu » est recalculé en LECTURE via domain/ (step/firstHit), jamais
// écrit dans l'état. L'interpolation entre deux tours est purement cosmétique. La
// tilemap du Track est lue telle quelle (aucune logique de jeu ici).

import { Car } from '../domain/car';
import { RaceState, Tuning } from '../domain/gameState';
import { firstHit } from '../domain/collision';
import { DispersionTuning, coneHalfAngle } from '../domain/dispersion';
import { reachableRadius, step } from '../domain/physics';
import { ModId, TurnMods } from '../domain/turnmods';
import { Surface } from '../domain/surfaces';
import { Track, isSolid, surfaceAt, trackHeightPx, trackWidthPx } from '../domain/track';
import { Vec2 } from '../domain/vec2';
import { AnimView, animEase, animPos } from '../systems/simulation';
import { Camera } from '../systems/camera';
import { GhostFrame } from '../systems/ghost';
import { Effects } from './effects';

const TAU = Math.PI * 2;

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private readonly vw: number; // viewport (px logiques)
  private readonly vh: number;
  private readonly worldW: number; // monde (px)
  private readonly worldH: number;
  private cache!: HTMLCanvasElement;
  private readonly css: Record<string, string> = {};
  // Game feel (cosmétique) : effets + suivi inter-frame pour traces et secousse.
  private readonly fx = new Effects();
  private prevCar: Vec2 | null = null;
  private lastSpeed = 0;
  private prevPhase: RaceState['phase'] = 'idle';
  private readonly dispersion: DispersionTuning; // tuning du cône (lecture seule, PRD 12)

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    tuning: Tuning,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.dispersion = tuning.dispersion;
    const { width, height } = tuning.camera.viewport;
    this.vw = width;
    this.vh = height;
    this.worldW = trackWidthPx(track);
    this.worldH = trackHeightPx(track);
    canvas.width = this.vw * dpr;
    canvas.height = this.vh * dpr;
    canvas.style.aspectRatio = `${this.vw} / ${this.vh}`;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.ctx.scale(dpr, dpr);
    this.buildCache(dpr);
  }

  private getCss(v: string): string {
    return (
      this.css[v] ||
      (this.css[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim())
    );
  }

  // --- tracé statique mis en cache offscreen, re-blitté chaque frame ---
  private buildCache(dpr: number): void {
    const { tileSize, width, height, tiles, palette } = this.track;
    const cache = document.createElement('canvas');
    cache.width = this.worldW * dpr;
    cache.height = this.worldH * dpr;
    const g = cache.getContext('2d');
    if (!g) throw new Error('Canvas 2D indisponible');
    g.scale(dpr, dpr);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const s = palette[tiles[r * width + c].surface];
        const x = c * tileSize;
        const y = r * tileSize;
        g.fillStyle = s.color;
        g.fillRect(x, y, tileSize, tileSize);
        this.addTexture(g, s, x, y, c, r);
      }
    }
    this.drawFinish(g);
    // contour des tuiles roulables (lisibilité du tracé)
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++)
        if (!palette[tiles[r * width + c].surface].solid)
          g.strokeRect(c * tileSize + 0.5, r * tileSize + 0.5, tileSize - 1, tileSize - 1);

    // obstacles posés par-dessus le sol (dessinés en dernier).
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) {
        const obstacle = tiles[r * width + c].obstacle;
        if (obstacle) this.drawObstacle(g, obstacle, c * tileSize, r * tileSize);
      }

    this.cache = cache;
  }

  // Rendu d'un obstacle posé sur une tuile. Ajouter un type = une branche ici.
  private drawObstacle(g: CanvasRenderingContext2D, id: string, x: number, y: number): void {
    const TILE = this.track.tileSize;
    if (id === 'TREE') {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(x + TILE / 2, y + TILE * 0.62, TILE * 0.4, TILE * 0.18, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#2c5a30';
      g.beginPath();
      g.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42, 0, TAU);
      g.fill();
      g.fillStyle = '#173318';
      g.beginPath();
      g.arc(x + TILE / 2, y + TILE / 2, TILE * 0.22, 0, TAU);
      g.fill();
    } else if (id === 'BALES') {
      const s = TILE * 0.66;
      const o = (TILE - s) / 2;
      g.fillStyle = '#c9a23a';
      g.fillRect(x + o, y + o, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 1;
      g.strokeRect(x + o + 0.5, y + o + 0.5, s - 1, s - 1);
      g.beginPath();
      g.moveTo(x + o, y + TILE / 2);
      g.lineTo(x + o + s, y + TILE / 2);
      g.stroke();
    }
  }

  private addTexture(
    g: CanvasRenderingContext2D,
    s: Surface,
    x: number,
    y: number,
    c: number,
    r: number,
  ): void {
    const TILE = this.track.tileSize;
    // bruit déterministe léger -> texture, sans coût par frame
    const seed = (c * 73856093) ^ (r * 19349663);
    const rnd = (n: number): number => {
      const v = Math.sin(seed * 0.001 + n * 12.9898) * 43758.5453;
      return v - Math.floor(v);
    };
    g.save();
    if (s.id === 'ROAD') {
      g.fillStyle = 'rgba(255,255,255,0.025)';
      for (let i = 0; i < 6; i++) g.fillRect(x + rnd(i) * TILE, y + rnd(i + 9) * TILE, 2, 2);
    } else if (s.id === 'DIRT') {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < 10; i++) g.fillRect(x + rnd(i) * TILE, y + rnd(i + 3) * TILE, 3, 2);
    } else if (s.id === 'GRAVEL') {
      for (let i = 0; i < 14; i++) {
        g.fillStyle = rnd(i) > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
        g.fillRect(x + rnd(i + 1) * TILE, y + rnd(i + 5) * TILE, 2, 2);
      }
    } else if (s.id === 'WATER') {
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x + 3, y + TILE * 0.35, TILE - 6, 2);
      g.fillRect(x + 6, y + TILE * 0.6, TILE - 14, 2);
    } else if (s.id === 'WALL') {
      g.fillStyle = 'rgba(255,255,255,0.02)';
      g.fillRect(x, y, TILE, 1);
    }
    g.restore();
  }

  // Ligne d'arrivée façon damier le long du segment vertical finishLine.
  private drawFinish(g: CanvasRenderingContext2D): void {
    const { tileSize, finishLine } = this.track;
    const sq = tileSize / 4;
    const x = finishLine.a.x;
    const startRow = Math.round(Math.min(finishLine.a.y, finishLine.b.y) / tileSize);
    const endRow = Math.round(Math.max(finishLine.a.y, finishLine.b.y) / tileSize);
    for (let rr = startRow; rr < endRow; rr++) {
      for (let k = 0; k < 4; k++) {
        g.fillStyle = (k + rr) % 2 ? '#e7ecf3' : '#0b0e14';
        g.fillRect(x - 6, rr * tileSize + k * sq, 12, sq);
      }
    }
  }

  // ------------------------------- frame -------------------------------
  draw(
    now: number,
    state: RaceState,
    anim: AnimView | null,
    showAid: boolean,
    camera: Camera,
    car: Car,
    ghost: GhostFrame[] | null,
    dispersionOn: boolean,
    mods: TurnMods,
    modId: ModId,
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.vw, this.vh);

    // Secousse d'impact : déclenchée à la transition vers 'crashed' (cosmétique).
    if (this.prevPhase === 'animating' && state.phase === 'crashed') {
      this.fx.crashShake(now, this.lastSpeed, car.maxSpeed);
    }
    this.prevPhase = state.phase;
    this.fx.update(now);
    const shake = this.fx.shakeOffset(now);

    // Transformée caméra (+ secousse) : tout est ensuite dessiné en coordonnées MONDE.
    ctx.save();
    ctx.translate(this.vw / 2 + shake.x, this.vh / 2 + shake.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.blitVisible(camera);
    this.fx.drawTraces(ctx, now); // traces de pneus sur le sol

    // Fantôme sous la voiture : synchronisé au même index de tour, interpolé par la
    // même progression d'animation que le joueur.
    if (ghost) {
      const progress = state.phase === 'animating' && anim ? animEase(anim, now) : 0;
      this.drawGhost(ghost, state.turns, progress, car.livery);
    }

    if (state.phase === 'animating' && anim) {
      const p = animPos(anim, now);
      // Dépose traces + particules le long du déplacement réel (depuis flags AnimView).
      const from = this.prevCar ?? p;
      this.fx.trail(now, from.x, from.y, p.x, p.y, anim.skid, surfaceAt(this.track, p.x, p.y), anim.speed);
      this.prevCar = p;
      this.lastSpeed = anim.speed;
      this.drawSpeedTrail(p.x, p.y, anim.heading, anim.speed, car);
      this.drawCar(p.x, p.y, anim.heading, car.livery);
    } else {
      this.prevCar = null;
      if (state.phase === 'idle') this.drawAimAndGhost(state, showAid, car, dispersionOn, mods, modId);
      this.drawCar(state.car.pos.x, state.car.pos.y, state.car.heading, car.livery);
    }

    this.fx.drawParticles(ctx, now); // poussière/gravier/gerbe au-dessus

    ctx.restore();
  }

  // Efface les effets persistants (traces, particules) — appelé au restart.
  clearEffects(): void {
    this.fx.clear();
    this.prevCar = null;
    this.lastSpeed = 0;
  }

  // Traînée de vitesse : copies fantômes derrière la voiture, d'autant plus longues
  // que la vitesse est haute (game feel, cosmétique).
  private drawSpeedTrail(x: number, y: number, ang: number, speed: number, car: Car): void {
    const t = Math.min(1, speed / car.maxSpeed);
    if (t < 0.3) return;
    const ctx = this.ctx;
    const back = Math.cos(ang);
    const backY = Math.sin(ang);
    for (let i = 1; i <= 2; i++) {
      const d = i * 6 * t;
      ctx.save();
      ctx.globalAlpha = 0.18 * t * (1 - (i - 1) * 0.4);
      this.drawCar(x - back * d, y - backY * d, ang, car.livery);
      ctx.restore();
    }
  }

  // Voiture fantôme translucide à l'index de tour courant, interpolée vers le tour
  // suivant selon `progress`. Au-delà de la course enregistrée, le fantôme disparaît.
  private drawGhost(frames: GhostFrame[], turn: number, progress: number, livery: string): void {
    if (turn >= frames.length) return;
    const a = frames[turn];
    const b = frames[turn + 1] ?? a;
    const x = a.pos.x + (b.pos.x - a.pos.x) * progress;
    const y = a.pos.y + (b.pos.y - a.pos.y) * progress;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    this.drawCar(x, y, b.heading, livery);
    ctx.restore();
  }

  // Culling : ne blitte que la portion visible du cache monde (clampée aux bornes).
  private blitVisible(camera: Camera): void {
    const halfW = this.vw / (2 * camera.zoom);
    const halfH = this.vh / (2 * camera.zoom);
    const x0 = Math.max(0, camera.x - halfW);
    const y0 = Math.max(0, camera.y - halfH);
    const x1 = Math.min(this.worldW, camera.x + halfW);
    const y1 = Math.min(this.worldH, camera.y + halfH);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const d = this.dpr;
    this.ctx.drawImage(this.cache, x0 * d, y0 * d, w * d, h * d, x0, y0, w, h);
  }

  private drawCar(x: number, y: number, ang: number, livery: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 11, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = livery;
    this.roundRect(-10, -6, 20, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#1b1f27';
    this.roundRect(-3, -4, 7, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd1d1';
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(14, 0);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // PRD 11 + 12 — geste de visée : vecteur vitesse, disque atteignable, poignée, et le
  // SECTEUR d'incertitude (cône PRD 12, échantillonné via step) qui remplace la ligne
  // nette. Rien n'est décidé ni écrit ici : le bruit est tiré dans domain/systems ;
  // render n'affiche que l'enveloppe (aucune consommation du RNG).
  private drawAimAndGhost(
    state: RaceState,
    showAid: boolean,
    car: Car,
    dispersionOn: boolean,
    mods: TurnMods,
    modId: ModId,
  ): void {
    const ctx = this.ctx;
    const pos = state.car.pos;
    const vel = state.car.vel;
    const impulse = state.impulse;
    const surf = surfaceAt(this.track, pos.x, pos.y);
    const solid = (x: number, y: number): boolean => isSolid(this.track, x, y);

    // Halo du modificateur actif (PRD 13, cosmétique) : montre que le tour est modifié.
    if (modId !== 'none') {
      ctx.strokeStyle = modId === 'boost' ? this.getCss('--danger') : this.getCss('--brake');
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Endpoint de roue libre (centre du disque atteignable) = là où l'inertie emmène
    // ce tour (vitesse scrubée par le frein à main via `mods`).
    const coastV = step(vel, { x: 0, y: 0 }, surf, car, mods);
    const coast: Vec2 = { x: pos.x + coastV.x, y: pos.y + coastV.y };

    // Disque atteignable : aide forte (palier PRD 10), masquée en mode Pro. Même
    // masqué, le clamp s'applique côté domain ("l'aide montre, ne pilote pas").
    if (showAid) {
      ctx.strokeStyle = 'rgba(255,179,0,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(coast.x, coast.y, reachableRadius(surf, car, mods), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vecteur vitesse (l'inertie) : voiture -> endpoint de roue libre. Discret.
    if (vel.x || vel.y) {
      ctx.strokeStyle = 'rgba(74,222,128,0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(coast.x, coast.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Endpoint pour une impulsion voulue tournée de `theta` et mise à l'échelle `mag`.
    const endpointAt = (theta: number, mag: number): Vec2 => {
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const ix = (impulse.x * c - impulse.y * s) * mag;
      const iy = (impulse.x * s + impulse.y * c) * mag;
      const v = step(vel, { x: ix, y: iy }, surf, car, mods);
      return { x: pos.x + v.x, y: pos.y + v.y };
    };

    // Arrivée médiane (bruit nul) = la pointe « voulue ».
    const median = endpointAt(0, 1);
    const medHit = firstHit(pos.x, pos.y, median.x, median.y, solid);
    const braking = impulse.x * vel.x + impulse.y * vel.y < 0;
    const aiming = !!(impulse.x || impulse.y);

    // Demi-angle du cône (0 si dispersion off ou roue libre) : l'aide se resserre à
    // basse vitesse, s'ouvre quand on fonce / sur faible grip.
    const half = dispersionOn && aiming
      ? coneHalfAngle(Math.hypot(vel.x, vel.y) * mods.vel, surf, car, this.dispersion)
      : 0;
    const jit = half > 0 ? this.dispersion.magJitter : 0;
    const showSector = showAid && half > 0;

    // Enveloppe des arrivées possibles : arcs externe (mag 1+jit) et interne (1-jit) sur
    // [-half, +half]. Rouge dès qu'une partie touche un solide (condition de fairness).
    const N = 9;
    let anyHit = !!medHit;
    const outer: Vec2[] = [];
    const inner: Vec2[] = [];
    if (showSector) {
      for (let i = 0; i < N; i++) {
        const theta = -half + (2 * half * i) / (N - 1);
        const eo = endpointAt(theta, 1 + jit);
        if (firstHit(pos.x, pos.y, eo.x, eo.y, solid)) anyHit = true;
        outer.push(eo);
        inner.push(endpointAt(theta, 1 - jit));
      }
    }

    const danger = showSector ? anyHit : !!medHit;
    const col = danger ? this.getCss('--danger') : braking ? this.getCss('--brake') : this.getCss('--ghost');

    if (showSector) {
      // Secteur rempli (éventail des arrivées) + rayons bornant le cône.
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(outer[0].x, outer[0].y);
      for (let i = 1; i < N; i++) ctx.lineTo(outer[i].x, outer[i].y);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(outer[0].x, outer[0].y);
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(outer[N - 1].x, outer[N - 1].y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Palier réduit / dispersion off : seule la trajectoire médiane (ligne nette).
      const end = medHit ?? median;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Poignée saisissable à l'arrivée médiane.
    const hand = medHit ?? median;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, medHit ? 5 : 6, 0, TAU);
    ctx.fill();
    if (!medHit) {
      ctx.fillStyle = this.getCss('--bg');
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, 2.5, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x - 6, hand.y - 6);
      ctx.lineTo(hand.x + 6, hand.y + 6);
      ctx.moveTo(hand.x + 6, hand.y - 6);
      ctx.lineTo(hand.x - 6, hand.y + 6);
      ctx.stroke();
    }

    // continuation en roue libre (inertie sur 2 tours) — aide seulement, si pas de crash.
    // Le tour courant subit le mod ; les tours suivants sont des coups normaux (NEUTRAL).
    if (showAid && !medHit) {
      const nv = step(vel, impulse, surf, car, mods);
      let p: Vec2 = median;
      let v: Vec2 = nv;
      let faded = false;
      ctx.setLineDash([2, 5]);
      for (let i = 0; i < 2 && !faded; i++) {
        const v2 = step(v, { x: 0, y: 0 }, surfaceAt(this.track, p.x, p.y), car);
        const p2: Vec2 = { x: p.x + v2.x, y: p.y + v2.y };
        const h2 = firstHit(p.x, p.y, p2.x, p2.y, solid);
        const e2 = h2 ?? p2;
        ctx.strokeStyle = 'rgba(74,222,128,' + (0.3 - i * 0.1) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(e2.x, e2.y);
        ctx.stroke();
        if (h2) faded = true;
        p = p2;
        v = v2;
      }
      ctx.setLineDash([]);
    }
  }

  // ----- helpers de dessin -----
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
