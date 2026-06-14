import { describe, it, expect } from 'vitest';
import {
  Bounds,
  Camera,
  Viewport,
  clampCamera,
  fitCamera,
  follow,
  followTarget,
  screenToWorld,
  worldToScreen,
} from '../src/systems/camera';

const VP: Viewport = { width: 720, height: 480 };
const BOUNDS: Bounds = { width: 864, height: 576 };

describe('worldToScreen / screenToWorld', () => {
  it('sont réciproques', () => {
    const cam: Camera = { x: 400, y: 300, zoom: 1.35 };
    for (const p of [
      { x: 0, y: 0 },
      { x: 432, y: 288 },
      { x: 851, y: 99 },
    ]) {
      const back = screenToWorld(cam, VP, worldToScreen(cam, VP, p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it('mappe le centre monde au centre écran', () => {
    const cam: Camera = { x: 400, y: 300, zoom: 2 };
    const s = worldToScreen(cam, VP, { x: 400, y: 300 });
    expect(s).toEqual({ x: VP.width / 2, y: VP.height / 2 });
  });
});

describe('clampCamera', () => {
  it('ne montre jamais le vide au-delà des bornes', () => {
    const cam: Camera = { x: -1000, y: 5000, zoom: 1.35 };
    const c = clampCamera(cam, VP, BOUNDS);
    const halfW = VP.width / (2 * c.zoom);
    const halfH = VP.height / (2 * c.zoom);
    expect(c.x - halfW).toBeGreaterThanOrEqual(0);
    expect(c.x + halfW).toBeLessThanOrEqual(BOUNDS.width + 1e-9);
    expect(c.y - halfH).toBeGreaterThanOrEqual(0);
    expect(c.y + halfH).toBeLessThanOrEqual(BOUNDS.height + 1e-9);
  });

  it('centre l’axe quand le monde est plus petit que le viewport', () => {
    const cam: Camera = { x: 9999, y: 9999, zoom: 0.5 }; // viewport 1440x960 > monde
    const c = clampCamera(cam, VP, BOUNDS);
    expect(c.x).toBe(BOUNDS.width / 2);
    expect(c.y).toBe(BOUNDS.height / 2);
  });
});

describe('followTarget', () => {
  it('anticipe la direction de l’impulsion au-delà de la dead-zone', () => {
    const t = followTarget({ x: 100, y: 100 }, { x: 20, y: 0 }, 1.2, 3);
    expect(t).toEqual({ x: 100 + 20 * 1.2, y: 100 });
  });

  it('ignore une micro-impulsion (dead-zone)', () => {
    const focus = { x: 100, y: 100 };
    expect(followTarget(focus, { x: 1, y: 0 }, 1.2, 3)).toEqual(focus);
  });
});

describe('follow', () => {
  it('converge vers la cible (clampée) par lissage', () => {
    let cam: Camera = { x: 100, y: 100, zoom: 1.35 };
    const target = { x: 500, y: 350 };
    for (let i = 0; i < 200; i++) cam = follow(cam, target, VP, BOUNDS, 0.12);
    expect(cam.x).toBeCloseTo(target.x, 3);
    expect(cam.y).toBeCloseTo(target.y, 3);
  });

  it('reste dans les bornes même si la cible est hors monde', () => {
    let cam: Camera = { x: 432, y: 288, zoom: 1.35 };
    const target = { x: 99999, y: 99999 };
    for (let i = 0; i < 200; i++) cam = follow(cam, target, VP, BOUNDS, 0.12);
    const halfW = VP.width / (2 * cam.zoom);
    expect(cam.x + halfW).toBeLessThanOrEqual(BOUNDS.width + 1e-9);
  });
});

describe('fitCamera', () => {
  it('cadre tout le tracé et le centre', () => {
    const c = fitCamera(VP, BOUNDS);
    expect(c.zoom * BOUNDS.width).toBeLessThanOrEqual(VP.width + 1e-9);
    expect(c.zoom * BOUNDS.height).toBeLessThanOrEqual(VP.height + 1e-9);
    expect(c.x).toBe(BOUNDS.width / 2);
    expect(c.y).toBe(BOUNDS.height / 2);
  });
});
