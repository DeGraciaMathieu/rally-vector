// Game feel (PRD 08) : traces de pneus, particules par surface, secousse d'impact.
// 100 % cosmétique : ne lit que des FLAGS déjà exposés (skid/speed via AnimView) et
// l'état, ne décide RIEN du gameplay. Budgets bornés + respect de prefers-reduced-motion
// pour la perf mobile. Les jitters de secousse utilisent Math.random : aucun lien avec
// le RNG de gameplay (P5), c'est purement visuel.

import { Surface } from '../domain/surfaces';
import { FX } from '../data/effects';

interface TraceMark {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly born: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  size: number;
  color: string;
}

const TAU = Math.PI * 2;

// Particules par surface : couleur + dispersion. ROAD = quasi rien (lisibilité).
function particleStyle(s: Surface): { color: string; spread: number; count: number } | null {
  switch (s.id) {
    case 'DIRT':
      return { color: 'rgba(138,90,51,0.7)', spread: 26, count: FX.particlesPerFrame };
    case 'GRAVEL':
      return { color: 'rgba(154,160,168,0.8)', spread: 40, count: FX.particlesPerFrame };
    case 'WATER':
      return { color: 'rgba(180,220,235,0.8)', spread: 30, count: FX.particlesPerFrame + 1 };
    default:
      return null; // route : pas de gerbe
  }
}

export class Effects {
  private traces: TraceMark[] = [];
  private particles: Particle[] = [];
  private shakeMag = 0;
  private shakeBorn = 0;
  private readonly reduced: boolean;

  constructor() {
    this.reduced =
      typeof window !== 'undefined' && !!window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
  }

  clear(): void {
    this.traces = [];
    this.particles = [];
    this.shakeMag = 0;
  }

  // Pendant l'animation d'un tour : dépose une trace si dérapage réel, émet des
  // particules selon la surface et la vitesse.
  trail(now: number, px: number, py: number, x: number, y: number, skid: number, surf: Surface, speed: number): void {
    if (!this.reduced && skid >= FX.skidThreshold) {
      // deux lignes parallèles (les pneus), perpendiculaires au déplacement
      const dx = x - px;
      const dy = y - py;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 3;
      const ny = (dx / len) * 3;
      this.push({ x1: px + nx, y1: py + ny, x2: x + nx, y2: y + ny, born: now });
      this.push({ x1: px - nx, y1: py - ny, x2: x - nx, y2: y - ny, born: now });
    }
    const style = particleStyle(surf);
    if (style && speed > 8) this.emit(now, x, y, style, speed);
  }

  // Secousse à l'impact fatal, intensité ∝ vitesse. Désactivée en reduced-motion.
  crashShake(now: number, speed: number, maxSpeed: number): void {
    if (this.reduced) return;
    this.shakeMag = FX.shakeMaxPx * Math.min(1, speed / maxSpeed);
    this.shakeBorn = now;
  }

  // Décalage de secousse (px écran) à appliquer avant la transformée caméra.
  shakeOffset(now: number): { x: number; y: number } {
    const t = (now - this.shakeBorn) / FX.shakeMs;
    if (this.shakeMag <= 0 || t >= 1) return { x: 0, y: 0 };
    const m = this.shakeMag * (1 - t);
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }

  // Intègre particules et purge ce qui a expiré (par budget et par durée).
  update(now: number): void {
    this.traces = this.traces.filter((t) => now - t.born < FX.traceFadeMs);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      if (now - p.born >= FX.particleLifeMs) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      alive.push(p);
    }
    this.particles = alive;
  }

  // Traces sur le sol (sous la voiture).
  drawTraces(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const t of this.traces) {
      const a = 0.4 * (1 - (now - t.born) / FX.traceFadeMs);
      if (a <= 0) continue;
      ctx.strokeStyle = `rgba(20,20,24,${a})`;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Particules (au-dessus du sol et de la voiture : poussière qui vole).
  drawParticles(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.particles) {
      const a = 1 - (now - p.born) / FX.particleLifeMs;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private push(mark: TraceMark): void {
    this.traces.push(mark);
    if (this.traces.length > FX.traceMax) this.traces.shift();
  }

  private emit(
    now: number,
    x: number,
    y: number,
    style: { color: string; spread: number; count: number },
    speed: number,
  ): void {
    const count = this.reduced ? 1 : style.count;
    for (let i = 0; i < count && this.particles.length < FX.particleMax; i++) {
      const ang = Math.random() * TAU;
      const v = (style.spread / 100) * (0.4 + Math.random()) * (0.5 + Math.min(1, speed / 120));
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        born: now,
        size: 1.5 + Math.random() * 1.5,
        color: style.color,
      });
    }
  }
}
