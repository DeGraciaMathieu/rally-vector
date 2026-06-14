// Rendu canvas 2D. Lit l'état et l'anim, dessine. NE DÉCIDE RIEN et NE MUTE RIEN :
// le fantôme « prévu » est recalculé en LECTURE via domain/ (step/firstHit), jamais
// écrit dans l'état. L'interpolation entre deux tours est purement cosmétique. La
// tilemap du Track est lue telle quelle (aucune logique de jeu ici).

import { RaceState, Tuning } from '../domain/gameState';
import { firstHit } from '../domain/collision';
import { step } from '../domain/physics';
import { Surface } from '../domain/surfaces';
import { Track, isSolid, surfaceAt, trackHeightPx, trackWidthPx } from '../domain/track';
import { Vec2 } from '../domain/vec2';
import { AnimView, animPos } from '../systems/simulation';
import { Camera } from '../systems/camera';

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

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    private readonly tuning: Tuning,
  ) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
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
  draw(now: number, state: RaceState, anim: AnimView | null, showAid: boolean, camera: Camera): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.vw, this.vh);

    // Transformée caméra : tout est ensuite dessiné en coordonnées MONDE.
    ctx.save();
    ctx.translate(this.vw / 2, this.vh / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.blitVisible(camera);

    if (state.phase === 'animating' && anim) {
      const p = animPos(anim, now);
      this.drawCar(p.x, p.y, anim.heading);
    } else {
      if (state.phase === 'idle') this.drawAimAndGhost(state, showAid);
      this.drawCar(state.car.pos.x, state.car.pos.y, state.car.heading);
    }

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

  private drawCar(x: number, y: number, ang: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 11, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff5252';
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

  private drawAimAndGhost(state: RaceState, showAid: boolean): void {
    const ctx = this.ctx;
    const car = state.car.pos;
    const impulse = state.impulse;

    // anneau de poussée max
    ctx.strokeStyle = 'rgba(255,179,0,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(car.x, car.y, this.tuning.maxImpulse, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // flèche d'impulsion (l'ordre du pilote)
    if (impulse.x || impulse.y) {
      this.arrow(car.x, car.y, car.x + impulse.x, car.y + impulse.y, this.getCss('--amber'));
    }

    if (!showAid) return;

    const solid = (x: number, y: number): boolean => isSolid(this.track, x, y);

    // trajectoire RÉELLE prévue (poussée + inertie) sur ce tour
    const nv = step(state.car.vel, impulse, surfaceAt(this.track, car.x, car.y), this.tuning);
    const np: Vec2 = { x: car.x + nv.x, y: car.y + nv.y };
    const hit = firstHit(car.x, car.y, np.x, np.y, solid);
    const end = hit ?? np;
    const col = hit ? this.getCss('--danger') : this.getCss('--ghost');

    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(car.x, car.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(end.x, end.y, hit ? 5 : 4, 0, TAU);
    ctx.fill();
    if (hit) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(end.x - 6, end.y - 6);
      ctx.lineTo(end.x + 6, end.y + 6);
      ctx.moveTo(end.x + 6, end.y - 6);
      ctx.lineTo(end.x - 6, end.y + 6);
      ctx.stroke();
    }

    // continuation en roue libre (inertie sur 2 tours) — seulement si pas de crash
    if (!hit) {
      let p: Vec2 = np;
      let v: Vec2 = nv;
      let faded = false;
      ctx.setLineDash([2, 5]);
      for (let i = 0; i < 2 && !faded; i++) {
        const v2 = step(v, { x: 0, y: 0 }, surfaceAt(this.track, p.x, p.y), this.tuning);
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

  private arrow(x0: number, y0: number, x1: number, y1: number, solid: string): void {
    const ctx = this.ctx;
    ctx.strokeStyle = solid;
    ctx.fillStyle = solid;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const h = 7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  }
}
