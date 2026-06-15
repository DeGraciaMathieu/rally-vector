// Composition root : câble systems + render, gère le HUD, les boutons, la boucle
// rAF et les chronos wall-clock (hors domain/, donc hors déterminisme). Aucune
// règle de jeu ici : tout vient de la simulation et du LapTracker.

import { Track, surfaceAt, trackHeightPx, trackWidthPx } from './domain/track';
import { generateTrack } from './domain/trackgen';
import { Vec2, ZERO, length } from './domain/vec2';
import { cars } from './data/cars';
import { GEN } from './data/genParams';
import { tracks } from './data/tracks';
import { TUNING } from './data/tuning';
import { SIM_VERSION } from './data/version';
import { CanvasRenderer } from './render/canvasRenderer';
import {
  Bounds,
  Camera,
  clampCamera,
  fitCamera,
  follow,
  followTarget,
  screenToWorld,
} from './systems/camera';
import { GhostFrame, buildGhost } from './systems/ghost';
import { bindInput, targetToImpulse } from './systems/input';
import { Recorder } from './systems/recorder';
import { Simulation, animPos } from './systems/simulation';
import { loadRecording, saveRecording } from './systems/storage';

// Seed de gameplay : injecté dans l'état (préparation P5), pas encore consommé.
const SEED = 1;

const el = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Élément #${id} introuvable`);
  return node;
};

const canvas = el('game') as HTMLCanvasElement;

const VIEWPORT = TUNING.camera.viewport;

let trackIndex = 0;
let track = tracks[trackIndex];
let carIndex = 0;
let car = cars[carIndex];
let sim = new Simulation(track, TUNING, car, SEED);
let renderer = new CanvasRenderer(canvas, track, TUNING);

let showAid = true;
let strictCrash = true; // mode crash = fin systématique (préserve la version d'origine)
let dispersionOn = true; // cône d'incertitude seedé sur l'impulsion (PRD 12)

// Contre-la-montre : enregistreur de la course en cours + fantôme du meilleur record.
const recorder = new Recorder();
let ghostFrames: GhostFrame[] | null = null;

// Étape (stage) : l'arrivée franchie une fois termine la spéciale.
let stageFinished = false;
let finishMs = 0;

// Caméra cosmétique (jamais dans l'état). Bornes dérivées de la taille du circuit.
let bounds: Bounds = makeBounds();
let camera: Camera = centeredCamera();
let circuitView = false;

function makeBounds(): Bounds {
  return { width: trackWidthPx(track), height: trackHeightPx(track) };
}

function centeredCamera(): Camera {
  const { pos } = track.start;
  return clampCamera({ x: pos.x, y: pos.y, zoom: TUNING.camera.followZoom }, VIEWPORT, bounds);
}

// Point suivi : la voiture (interpolée pendant l'animation, statique sinon).
function focusPoint(now: number): { x: number; y: number } {
  if (sim.state.phase === 'animating' && sim.anim) return animPos(sim.anim, now);
  return sim.state.car.pos;
}

// Chronos wall-clock — orchestration temporelle (systems), jamais dans l'état.
let raceStartMs: number | null = null;
let lapStartMs = 0;
let bestMs: number | undefined; // meilleur tour persistant pour (circuit, voiture)

// (Re)charge le meilleur record du couple (circuit, voiture) et reconstruit son
// fantôme. Un record obsolète (simVersion) est ignoré -> pas de fantôme, pas de best.
function refreshGhost(): void {
  const rec = loadRecording(track.id, car.id);
  ghostFrames = buildGhost(rec, TUNING, SIM_VERSION);
  bestMs = ghostFrames ? rec!.timeMs : undefined;
}

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
const toast = el('toast');
const aidBtn = el('btn-aid');
const strictBtn = el('btn-strict');
const dispersionBtn = el('btn-dispersion');
const carBtn = el('btn-car');
const carStats = el('car-stats');
const trackBtn = el('btn-track');
const stageBtn = el('btn-stage');

let toastTimer: number | undefined;
function showToast(msg: string): void {
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1100);
}

function updateHud(): void {
  const st = sim.state;
  hud.turn.textContent = String(st.turns);
  hud.lap.textContent = String(st.laps);
  hud.best.textContent = bestMs !== undefined ? (bestMs / 1000).toFixed(1) + 's' : '—';
  hud.speed.textContent = String(Math.round(length(st.car.vel)));
  const s = surfaceAt(track, st.car.pos.x, st.car.pos.y);
  hud.surf.textContent = s.label;
  hud.surfDot.style.background = s.dot;
}

function reset(): void {
  sim.reset(SEED);
  recorder.reset();
  raceStartMs = null;
  lapStartMs = 0;
  stageFinished = false;
  refreshGhost();
  renderer.clearEffects();
  camera = centeredCamera();
  banner.classList.remove('show');
  updateHud();
}

// Charge un circuit (boucle faite main ou étape générée) et relance la spéciale.
function setTrack(next: Track): void {
  track = next;
  sim = new Simulation(track, TUNING, car, SEED, strictCrash, dispersionOn);
  renderer = new CanvasRenderer(canvas, track, TUNING);
  bounds = makeBounds();
  trackBtn.firstChild!.textContent = `Circuit : ${track.name} `;
  reset();
}

function loadTrack(index: number): void {
  trackIndex = index;
  setTrack(tracks[trackIndex]);
}

// Génère une nouvelle étape depuis un seed aléatoire (affiché, donc partageable).
function newStage(): void {
  const seed = Math.floor(Math.random() * 1e9);
  setTrack(generateTrack(seed, GEN));
}

// Sélection de voiture (avant la course) : injecte la voiture dans la simulation,
// rafraîchit l'UI et relance la spéciale.
function loadCar(index: number): void {
  carIndex = index;
  car = cars[carIndex];
  sim.setCar(car);
  carBtn.firstChild!.textContent = `Voiture : ${car.label} `;
  updateCarStats();
  reset();
}

function updateCarStats(): void {
  carStats.innerHTML =
    `<span><span class="k">pointe</span> <b>${car.maxSpeed}</b></span>` +
    `<span><span class="k">poussée</span> <b>${car.maxImpulse}</b></span>` +
    `<span><span class="k">grip</span> <b>×${car.gripFactor.toFixed(2)}</b></span>` +
    `<span><span class="k">glisse</span> <b>${car.angleGripLoss.toFixed(2)}</b></span>`;
}

// Prévisualisation : convertit la cible monde sous le pointeur en visée. La règle
// (zone morte + clamp dans le disque) vit dans systems/input + domain/physics.
function aimAt(target: Vec2): void {
  const { pos, vel } = sim.state.car;
  const surf = surfaceAt(track, pos.x, pos.y);
  sim.aim(targetToImpulse(pos, vel, target, surf, car, TUNING.aim.cancelRadius));
}

function commit(): void {
  if (sim.state.phase !== 'idle' || stageFinished) return;
  const now = performance.now();
  if (raceStartMs === null) {
    raceStartMs = now;
    lapStartMs = now;
  }
  recorder.record(sim.state.impulse); // l'impulsion validée = celle que résout le tour
  sim.commit(now);
}

function toggleAid(): void {
  showAid = !showAid;
  aidBtn.setAttribute('aria-pressed', String(showAid));
  if (aidBtn.firstChild) aidBtn.firstChild.textContent = `Aide à la visée : ${showAid ? 'ON' : 'OFF'} `;
}

function toggleView(): void {
  circuitView = !circuitView;
}

function toggleStrict(): void {
  strictCrash = !strictCrash;
  sim.setStrict(strictCrash);
  strictBtn.setAttribute('aria-pressed', String(strictCrash));
  if (strictBtn.firstChild) strictBtn.firstChild.textContent = `Crash = fin : ${strictCrash ? 'ON' : 'OFF'} `;
}

function toggleDispersion(): void {
  dispersionOn = !dispersionOn;
  sim.setDispersion(dispersionOn);
  dispersionBtn.setAttribute('aria-pressed', String(dispersionOn));
  if (dispersionBtn.firstChild) dispersionBtn.firstChild.textContent = `Dispersion : ${dispersionOn ? 'ON' : 'OFF'} `;
}

const bannerTitle = el('banner-title');
const bannerText = el('banner-text');
function showBanner(title: string, text: string): void {
  bannerTitle.textContent = title;
  bannerText.textContent = text;
  updateHud();
  banner.classList.add('show');
}

el('btn-go').addEventListener('click', commit);
el('btn-restart').addEventListener('click', reset);
el('banner-restart').addEventListener('click', reset);
aidBtn.addEventListener('click', toggleAid);
strictBtn.addEventListener('click', toggleStrict);
dispersionBtn.addEventListener('click', toggleDispersion);
carBtn.addEventListener('click', () => loadCar((carIndex + 1) % cars.length));
trackBtn.addEventListener('click', () => loadTrack((trackIndex + 1) % tracks.length));
stageBtn.addEventListener('click', newStage);

bindInput(canvas, VIEWPORT, {
  canAim: () => sim.state.phase === 'idle',
  screenToWorld: (screen) => screenToWorld(camera, VIEWPORT, screen),
  commitMinDrag: TUNING.aim.commitMinDrag,
  onAim: aimAt,
  onCommit: commit,
  onCancel: () => sim.aim(ZERO),
  onReset: reset,
  onToggleAid: toggleAid,
  onToggleView: toggleView,
  onToggleDispersion: toggleDispersion,
});

function frame(now: number): void {
  const before = sim.state.phase;
  const { events, contact } = sim.update(now);

  // Temps de référence : meilleur TOUR en boucle, temps d'ÉTAPE total en spéciale A→B.
  const saveRecord = (timeMs: number): void => {
    if (bestMs === undefined || timeMs < bestMs) {
      bestMs = timeMs;
      saveRecording(
        recorder.toRecording({
          simVersion: SIM_VERSION,
          seed: SEED,
          carId: car.id,
          trackId: track.id,
          strict: strictCrash,
          dispersion: dispersionOn,
          timeMs,
        }),
      );
    }
  };

  for (const ev of events) {
    if (ev.type !== 'lapComplete') continue;
    if (track.kind === 'stage') {
      // Arrivée franchie : l'étape est terminée (une seule fois).
      if (!stageFinished) {
        stageFinished = true;
        finishMs = now - (raceStartMs ?? now);
        saveRecord(finishMs);
      }
    } else {
      const lapMs = now - lapStartMs;
      lapStartMs = now;
      saveRecord(lapMs);
    }
  }

  // Le tour vient de se terminer : rafraîchir le HUD (et le bandeau si crash/arrivée).
  if (before === 'animating' && sim.state.phase !== 'animating') {
    if (sim.state.phase === 'crashed') {
      showBanner('Sortie de route', 'La voiture a tapé. En rallye, on ne pardonne pas — la course est terminée.');
    } else if (stageFinished) {
      showBanner('Spéciale terminée', `Temps : ${(finishMs / 1000).toFixed(1)}s`);
    } else if (contact === 'spin') {
      showToast('Tête-à-queue !');
    } else if (contact === 'graze') {
      showToast('Frôlement');
    }
    updateHud();
  }

  if (circuitView) {
    camera = fitCamera(VIEWPORT, bounds);
  } else {
    const { lookAhead, deadZone, smoothing } = TUNING.camera;
    // Anticipation seulement pendant le déplacement (impulsion figée au commit) : en
    // visée, l'impulsion change à chaque drag et ferait trembler la caméra.
    const lead = sim.state.phase === 'animating' ? sim.state.impulse : ZERO;
    const target = followTarget(focusPoint(now), lead, lookAhead, deadZone);
    camera = follow({ ...camera, zoom: TUNING.camera.followZoom }, target, VIEWPORT, bounds, smoothing);
  }

  renderer.draw(now, sim.state, sim.anim, showAid, camera, car, ghostFrames, dispersionOn);

  if (raceStartMs !== null && sim.state.phase !== 'crashed' && !stageFinished) {
    hud.time.textContent = ((now - raceStartMs) / 1000).toFixed(1) + 's';
  }

  requestAnimationFrame(frame);
}

trackBtn.firstChild!.textContent = `Circuit : ${track.name} `;
carBtn.firstChild!.textContent = `Voiture : ${car.label} `;
updateCarStats();
reset();
requestAnimationFrame(frame);
