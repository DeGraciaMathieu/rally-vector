// Composition root : câble systems + render, gère le HUD, les boutons, la boucle
// rAF et les chronos wall-clock (hors domain/, donc hors déterminisme). Aucune
// règle de jeu ici : tout vient de la simulation et du LapTracker.

import { surfaceAt } from './domain/track';
import { length } from './domain/vec2';
import { tracks } from './data/tracks';
import { TUNING } from './data/tuning';
import { CanvasRenderer } from './render/canvasRenderer';
import { bindInput } from './systems/input';
import { Simulation } from './systems/simulation';

// Seed de gameplay : injecté dans l'état (préparation P5), pas encore consommé.
const SEED = 1;

const el = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Élément #${id} introuvable`);
  return node;
};

const canvas = el('game') as HTMLCanvasElement;

let trackIndex = 0;
let track = tracks[trackIndex];
let sim = new Simulation(track, TUNING, SEED);
let renderer = new CanvasRenderer(canvas, track, TUNING);

let showAid = true;

// Chronos wall-clock — orchestration temporelle (systems), jamais dans l'état.
let raceStartMs: number | null = null;
let lapStartMs = 0;
let bestLap: number | undefined;

const hud = {
  turn: el('hud-turn'),
  lap: el('hud-lap'),
  time: el('hud-time'),
  best: el('hud-best'),
  speed: el('hud-speed'),
  surf: el('hud-surf'),
  surfDot: el('hud-surf-dot'),
};
const banner = el('banner');
const aidBtn = el('btn-aid');
const trackBtn = el('btn-track');

function updateHud(): void {
  const st = sim.state;
  hud.turn.textContent = String(st.turns);
  hud.lap.textContent = String(st.laps);
  hud.best.textContent = bestLap !== undefined ? bestLap.toFixed(1) + 's' : '—';
  hud.speed.textContent = String(Math.round(length(st.car.vel)));
  const s = surfaceAt(track, st.car.pos.x, st.car.pos.y);
  hud.surf.textContent = s.label;
  hud.surfDot.style.background = s.dot;
}

function reset(): void {
  sim.reset(SEED);
  raceStartMs = null;
  lapStartMs = 0;
  bestLap = undefined;
  banner.classList.remove('show');
  updateHud();
}

function loadTrack(index: number): void {
  trackIndex = index;
  track = tracks[trackIndex];
  sim = new Simulation(track, TUNING, SEED);
  renderer = new CanvasRenderer(canvas, track, TUNING);
  trackBtn.firstChild!.textContent = `Circuit : ${track.name} `;
  reset();
}

function commit(): void {
  if (sim.state.phase !== 'idle') return;
  const now = performance.now();
  if (raceStartMs === null) {
    raceStartMs = now;
    lapStartMs = now;
  }
  sim.commit(now);
}

function toggleAid(): void {
  showAid = !showAid;
  aidBtn.setAttribute('aria-pressed', String(showAid));
  if (aidBtn.firstChild) aidBtn.firstChild.textContent = `Aide à la visée : ${showAid ? 'ON' : 'OFF'} `;
}

function showBanner(): void {
  updateHud();
  banner.classList.add('show');
}

el('btn-go').addEventListener('click', commit);
el('btn-restart').addEventListener('click', reset);
el('banner-restart').addEventListener('click', reset);
aidBtn.addEventListener('click', toggleAid);
trackBtn.addEventListener('click', () => loadTrack((trackIndex + 1) % tracks.length));

// Les deux circuits partagent les dimensions de grille : un seul binding suffit.
bindInput(canvas, track, TUNING.maxImpulse, {
  getCarPos: () => sim.state.car.pos,
  canAim: () => sim.state.phase === 'idle',
  onAim: (impulse) => sim.aim(impulse),
  onCommit: commit,
  onReset: reset,
  onToggleAid: toggleAid,
});

function frame(now: number): void {
  const before = sim.state.phase;
  const { events } = sim.update(now);

  for (const ev of events) {
    if (ev.type === 'lapComplete') {
      const lap = (now - lapStartMs) / 1000;
      if (bestLap === undefined || lap < bestLap) bestLap = lap;
      lapStartMs = now;
    }
  }

  // Le tour vient de se terminer : rafraîchir le HUD (et le bandeau si crash).
  if (before === 'animating' && sim.state.phase !== 'animating') {
    if (sim.state.phase === 'crashed') showBanner();
    updateHud();
  }

  renderer.draw(now, sim.state, sim.anim, showAid);

  if (raceStartMs !== null && sim.state.phase !== 'crashed') {
    hud.time.textContent = ((now - raceStartMs) / 1000).toFixed(1) + 's';
  }

  requestAnimationFrame(frame);
}

trackBtn.firstChild!.textContent = `Circuit : ${track.name} `;
reset();
requestAnimationFrame(frame);
