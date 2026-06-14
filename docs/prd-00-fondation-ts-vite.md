# PRD 00 — Fondation : portage TS/Vite et architecture en couches

**Priorité : 0 — Impact ★★★ — Effort élevé**

> Dépendances : aucune | bloque tous les autres PRD.

## Objectif

Le proto vit dans un seul fichier HTML : logique, rendu et données sont
entremêlés, rien n'est testable, rien n'est typé. On porte le tout vers un projet
TS/Vite structuré en couches (`domain`/`data`/`systems`/`render`) avec un RNG
seedé et vitest. C'est le socle du pilier **P5** : sans séparation nette
domaine/rendu et sans déterminisme explicite, ni les fantômes, ni les chronos, ni
les tests ne tiennent. Une fois en place, on ne *ressent* rien de neuf en jeu — et
c'est le critère : le comportement reste identique, mais le code devient
extensible et vérifiable.

## Existant technique

Tout est dans `rallye-vecteur.html` :
- `TUNING` (TILE, COLS, ROWS, maxImpulse, maxSpeed, angleGripLoss, anim) — futur `data/tuning.ts`.
- `S` (table des surfaces : WALL, ROAD, DIRT, GRAVEL, WATER, TREE) — futur `data/surfaces.ts`. `TREE` est **scaffoldé mais jamais posé** sur la grille.
- `Track` (IIFE) : grille procédurale via `inRing`+`paint`, `surfaceAt`, `isSolid`, `buildCache` (offscreen), `startPos`, `finishX`, `checkpoint`. Un seul circuit en dur.
- `Physics.step(vel, impulse, surf)` et `Physics.firstHit(x0,y0,x1,y1)` (échantillonnage tous les 4 px) — pures, futur `domain/physics.ts` + `domain/collision.ts`.
- `Game` (IIFE) : machine à états `idle|animating|crashed`, `car/vel/heading/impulse`, `commit()`, `finishMove()`, `detectLap()`, `render()` (interpolation rAF), entrées pointeur/clavier, HUD.
- Aucun RNG de gameplay aujourd'hui ; seul le bruit de texture est seedé par coordonnées de tuile.

Invariant à préserver : la simulation (impulsion → `newVel` → position) est déjà déterministe ; l'animation est cosmétique. Le portage doit rendre cette frontière **structurelle**, pas juste implicite.

## Comportement

1. Projet Vite + TypeScript `strict`, vitest, ESLint. Arborescence `domain/ data/ systems/ render/`. Un `CLAUDE.md` encode les règles de couches ci-dessus.
2. `domain/` : `vec2.ts` (maths pures), `surfaces.ts` types, `physics.ts` (`step`), `collision.ts` (`firstHit`), `rng.ts` (mulberry32/xorshift seedé), `gameState.ts` (types `CarState`, `RaceState`, transitions pures).
3. `data/` : `tuning.ts`, `surfaces.ts` (la table `S`), `tracks/track-01.ts` (le circuit actuel, extrait en données).
4. `systems/` : `simulation.ts` (applique `step`, gère `idle|animating|crashed`), `input.ts` (pointeur/clavier → impulsion bornée), `lap.ts` (extrait de `detectLap`).
5. `render/` : `canvasRenderer.ts` (blit du cache + voiture + fantôme + HUD), strictement lecteur de l'état.
6. Le RNG seedé existe et est injecté dans l'état de course même s'il n'est pas encore consommé par le gameplay (préparation P5).

## Hors-scope

- Aucune nouvelle mécanique de jeu : portage iso-fonctionnel uniquement.
- Pas de Pixi.js à ce stade : on garde le canvas 2D du proto (migration moteur = décision séparée, cf. Risques).
- Pas de procgen, pas de multi-circuits réels (un seul circuit porté). → PRD 01, 07.

## Impacts par couche

- `domain/` : création de `vec2`, `physics`, `collision`, `rng`, `gameState`, `surfaces` (types).
- `data/` : `tuning.ts`, `surfaces.ts`, `tracks/track-01.ts`.
- `systems/` : `simulation.ts`, `input.ts`, `lap.ts`.
- `render/` : `canvasRenderer.ts` (port direct de `render`/`drawCar`/`drawAimAndGhost`/`buildCache`).
- Tests : `physics.test.ts`, `collision.test.ts`, `rng.test.ts`, `lap.test.ts`.

## Critères d'acceptation

- Le jeu porté est **jouable et visuellement identique** au proto (mêmes surfaces, même circuit, même feeling).
- `domain/` ne référence ni `window`, ni `document`, ni canvas (vérifiable par lint/règle d'import).
- `render/` n'écrit jamais dans l'état (revue : aucune mutation hors lecture).
- Déterminisme : même seed + même séquence d'impulsions → même suite de `RaceState` (sérialisée et comparée).

## Tests

- `physics.test.ts` : `step` reproduit les valeurs du proto sur cas connus (impulsion nulle = roue libre décroissante ; perte de grip en braquage à vitesse max).
- `collision.test.ts` : `firstHit` détecte le premier solide, renvoie `null` sur segment libre, gère l'hors-grille comme solide.
- `rng.test.ts` : même seed → même flux ; deux seeds → flux différents.
- `lap.test.ts` : franchissement compté seulement checkpoint armé + sens correct.

## Risques / questions ouvertes

- **Canvas 2D vs Pixi.js** : rester en canvas simplifie le portage mais plafonne le game feel (PRD 08). Trancher au plan : porter en canvas puis migrer, ou viser Pixi dès maintenant ?
- **Déterminisme cross-plateforme** : les floats JS sont déterministes sur un même moteur, suffisant pour les fantômes locaux. Un classement partagé exigerait du point-fixe — à laisser ouvert tant qu'il n'y a pas de leaderboard.
- Granularité du `RaceState` sérialisé pour les tests de déterminisme (tout l'état vs hash) — à trancher au plan.

---
