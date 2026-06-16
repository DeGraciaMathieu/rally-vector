// Peloton de bots : N adversaires IA courent la spéciale EN MÊME TEMPS que le joueur.
// Chaque bot est une voiture à part entière (RaceState) avec SON propre flux RNG seedé
// (dérivé du seed de course) et son LapTracker. Les voitures se TRAVERSENT : aucun bot
// ne lit l'état d'un autre -> pas de collision voiture-voiture, et l'ordre d'avancement
// n'a aucune incidence (déterminisme P5 préservé).
//
// Un bot avance d'un tour à chaque round (au commit du joueur) via `advanceTurn` — la
// même fonction que le joueur et le fantôme (PRD 06), donc même physique exactement.
// Crash = élimination (P2) : un bot crashé n'avance plus.

import { BotProfile, decideImpulse } from '../domain/ai';
import { Car } from '../domain/car';
import { RaceState, Tuning, createRaceState } from '../domain/gameState';
import { createRng, deriveSeed } from '../domain/rng';
import { Segment } from '../domain/geometry';
import { Track, isSolid, surfaceAt } from '../domain/track';
import { Vec2, add } from '../domain/vec2';
import { AI_NAV } from '../data/bots';
import { LapTracker } from './lap';
import { advanceTurn } from './simulation';

const gateCenter = (g: Segment): Vec2 => ({ x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 });

// Vue d'un bot lue par render/ : position interpolée + cap + couleur + état terminé.
// render/ ne fait que la dessiner (ne décide rien).
export interface BotView {
  readonly pos: Vec2;
  readonly heading: number;
  readonly livery: string;
  readonly done: boolean; // crashé ou arrivé -> rendu atténué
}

// Ligne de classement (joueur compris) : rang + libellé + arrivé/non.
export interface Standing {
  readonly label: string;
  readonly finished: boolean;
  readonly isPlayer: boolean;
}

// Progression du joueur, fournie par la composition root pour le classement.
export interface PlayerProgress {
  readonly pos: Vec2;
  readonly nextCp: number;
  readonly finished: boolean;
  readonly finishTurn: number | null;
  readonly crashed: boolean;
}

interface Bot {
  state: RaceState;
  readonly profile: BotProfile;
  readonly laps: LapTracker;
  nextCp: number;
  pathIdx: number; // prochain point de la ligne de course visé (navigation)
  finished: boolean;
  finishTurn: number | null;
  crashed: boolean;
  from: Vec2; // dernier déplacement (pour l'interpolation cosmétique)
  to: Vec2;
  heading: number;
}

export class Peloton {
  private readonly bots: Bot[];

  constructor(
    private readonly track: Track,
    private readonly tuning: Tuning,
    private readonly car: Car,
    raceSeed: number,
    profiles: readonly BotProfile[],
    grid: readonly Vec2[],
    private readonly strict = true,
    // Dispersion OFF par défaut : les bots pilotent « propre » (leur imperfection vient
    // du aimJitter du profil, lui pris en compte par le gouverneur anti-mur). Le cône
    // d'incertitude du joueur (PRD 12) ajouterait un bruit non anticipable -> crashs.
    private readonly dispersion = false,
  ) {
    this.bots = profiles.map((profile, i) => {
      const off = grid[i] ?? { x: 0, y: 0 };
      let pos = add(track.start.pos, off);
      // Garde-fou : si l'offset tombe hors piste, on repart du départ exact (les
      // voitures peuvent se superposer, aucune collision).
      if (surfaceAt(track, pos.x, pos.y).solid) pos = track.start.pos;
      const state = createRaceState(createRng(deriveSeed(raceSeed, i + 1)), {
        pos,
        heading: track.start.heading,
      });
      return {
        state,
        profile,
        laps: new LapTracker(track),
        nextCp: 0,
        pathIdx: 1,
        finished: false,
        finishTurn: null,
        crashed: false,
        from: pos,
        to: pos,
        heading: track.start.heading,
      };
    });
  }

  // Cible de navigation du tour : on suit la LIGNE DE COURSE (fil d'Ariane) si le
  // circuit l'expose — viser le centre du prochain checkpoint ferait couper les murs
  // du serpentin. La carotte avance quand le bot s'en approche. À défaut de `path`
  // (circuits faits main), on retombe sur le prochain checkpoint. Renvoie aussi la
  // limite de vitesse du tour : on freine d'autant plus tôt que le coin visé est serré.
  private aimFor(bot: Bot): { target: Vec2; speedLimit: number } {
    const path = this.track.path;
    if (!path || path.length === 0) {
      const cps = this.track.checkpoints;
      const target = gateCenter(bot.nextCp < cps.length ? cps[bot.nextCp] : this.track.finishLine);
      return { target, speedLimit: this.car.maxSpeed };
    }
    const pos = bot.state.car.pos;
    const nav = AI_NAV;
    // Pure-pursuit : on suit le SEGMENT courant [coin précédent -> coin visé] en visant
    // un point projeté un peu en avant -> le bot reste collé à la ligne de course
    // (donc sur la spine, hors obstacles), au lieu de dériver vers le coin lointain.
    let i = Math.min(bot.pathIdx, path.length - 1);
    const proj = (a: Vec2, b: Vec2): number => {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby || 1;
      return Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / len2));
    };
    // Avance de segment quand on a quasiment atteint le coin courant.
    while (i < path.length - 1 && proj(path[i - 1], path[i]) > nav.advanceAt) i++;
    bot.pathIdx = i;
    const a = path[i - 1];
    const b = path[i];
    const t = proj(a, b);
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const lookT = Math.min(1, t + (this.track.tileSize * nav.lookaheadTiles) / segLen);
    const target = { x: a.x + (b.x - a.x) * lookT, y: a.y + (b.y - a.y) * lookT };

    // Sévérité du virage AU coin visé (angle entrée -> sortie) : 0 (droit) .. 1 (épingle).
    const nextPt = path[i + 1] ?? b;
    const onx = nextPt.x - b.x;
    const ony = nextPt.y - b.y;
    const lo = Math.hypot(onx, ony) || 1;
    const cos = ((b.x - a.x) * onx + (b.y - a.y) * ony) / (segLen * lo);
    const sharp = (1 - cos) / 2;
    // Vitesse tolérée : lente à l'approche d'un coin serré (freinage anticipé sur la
    // distance restante au coin), libre en ligne droite.
    const cornerSpeed = this.car.maxSpeed * Math.max(nav.cornerMin, nav.cornerBase - nav.cornerSharp * sharp);
    const dCorner = segLen * (1 - t);
    const speedLimit = Math.min(this.car.maxSpeed, cornerSpeed + dCorner * nav.brakePerPx);
    return { target, speedLimit };
  }

  private stepBot(bot: Bot): void {
    if (bot.crashed || bot.finished) {
      bot.from = bot.to = bot.state.car.pos; // figé : plus d'interpolation
      return;
    }
    const prev = bot.state.car.pos;
    const surf = surfaceAt(this.track, prev.x, prev.y);
    const { target, speedLimit } = this.aimFor(bot);
    // Le bruit de visée de l'IA tire dans le RNG du bot, AVANT la dispersion du tour.
    const dec = decideImpulse(
      bot.state.car,
      target,
      surf,
      this.car,
      bot.profile,
      speedLimit,
      (x, y) => isSolid(this.track, x, y),
      bot.state.rng,
    );
    let s: RaceState = { ...bot.state, rng: dec.rng };
    s = advanceTurn(s, this.track, this.tuning, this.car, dec.impulse, this.strict, this.dispersion);
    const events = bot.laps.update(prev, s.car.pos);
    for (const ev of events) {
      if (ev.type === 'checkpoint') bot.nextCp++;
      else {
        bot.finished = true;
        bot.finishTurn = s.turns;
      }
    }
    if (s.phase === 'crashed') bot.crashed = true;
    bot.from = prev;
    bot.to = s.car.pos;
    bot.heading = s.car.heading;
    bot.state = s;
  }

  // Avance tout le peloton d'un tour (appelé au commit du joueur).
  advance(): void {
    for (const bot of this.bots) this.stepBot(bot);
  }

  // Fait jouer le peloton jusqu'à ce que tous les bots soient arrivés ou crashés (cap
  // de sûreté), pour figer un classement final quand la course du joueur s'arrête.
  runToEnd(maxTurns = 400): void {
    for (let i = 0; i < maxTurns; i++) {
      if (this.bots.every((b) => b.finished || b.crashed)) return;
      this.advance();
    }
  }

  // Vues interpolées pour le rendu (progress 0..1 = avancement de l'animation du tour).
  views(progress: number): BotView[] {
    return this.bots.map((b) => ({
      pos: { x: b.from.x + (b.to.x - b.from.x) * progress, y: b.from.y + (b.to.y - b.from.y) * progress },
      heading: b.heading,
      livery: b.profile.livery,
      done: b.crashed || b.finished,
    }));
  }

  // La première voiture à franchir l'arrivée a-t-elle déjà fini, et est-ce un bot ?
  get anyFinished(): boolean {
    return this.bots.some((b) => b.finished);
  }

  // Classement : arrivés d'abord (par tour d'arrivée croissant), puis en course par
  // progression (checkpoints validés, puis proximité de la cible), crashés en dernier.
  standings(player: PlayerProgress): Standing[] {
    const rank = (
      label: string,
      isPlayer: boolean,
      finished: boolean,
      finishTurn: number | null,
      crashed: boolean,
      nextCp: number,
      pos: Vec2,
    ): { label: string; isPlayer: boolean; finished: boolean; key: number } => {
      // Clé décroissante = meilleur. Arrivé : très haut, plus tôt = mieux.
      // En course : checkpoints*grand - distance à la cible. Crashé : tout en bas.
      let key: number;
      if (finished) key = 1e9 - (finishTurn ?? 0);
      else if (crashed) key = -1e9 + nextCp;
      else {
        const cps = this.track.checkpoints;
        const t = gateCenter(nextCp < cps.length ? cps[nextCp] : this.track.finishLine);
        const d = Math.hypot(t.x - pos.x, t.y - pos.y);
        key = nextCp * 1e5 - d;
      }
      return { label, isPlayer, finished, key };
    };

    const rows = [
      rank('Vous', true, player.finished, player.finishTurn, player.crashed, player.nextCp, player.pos),
      ...this.bots.map((b) =>
        rank(b.profile.label, false, b.finished, b.finishTurn, b.crashed, b.nextCp, b.state.car.pos),
      ),
    ];
    rows.sort((a, b) => b.key - a.key);
    return rows.map((r) => ({ label: r.label, finished: r.finished, isPlayer: r.isPlayer }));
  }
}
