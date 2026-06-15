---
name: simulation
description: Use when modifying the turn loop, phases, dispersion, contact consequences, RNG, ghosts, lap tracking, or anything touching determinism in the rally-vector project
auto_invoke: true
---

# Simulation & déterminisme — Rallye Vecteur

**P5 — Déterminisme.** `(seed, carId, trackId, séquence d'impulsions)` → course
identique, **bit pour bit** au niveau `RaceState`. Invariant central, non négociable.

## Boucle de tour

La simulation avance par **tours discrets** : un tour = une impulsion validée.

```
idle → (visée validée) → animating → idle | crashed
```

Phases dans `RaceState.phase` : `'idle' | 'animating' | 'crashed'`.

- `domain/gameState.ts` : `setImpulse`, `setMod`, `resolveMove` (calcul pur du tour →
  `ResolvedMove`), `beginMove`, `applyMove`, `completeLap`.
- `systems/simulation.ts` : orchestration temporelle. `advanceTurn`, `resolveTurnMods`
  (consomme une charge de boost), `Simulation` (classe), `animEase`/`animPos`
  (interpolation **cosmétique**, ne touche jamais l'état).

L'**animation** entre deux tours appartient à `systems/`+`render/` et **n'influence
jamais `RaceState`** (piège connu : interpolation qui fuit dans l'état).

## Hasard seedé (`domain/rng.ts`)

Tout hasard de gameplay passe par le **RNG seedé** porté dans `RaceState.rng`.
Jamais `Math.random()` (casse P5 et les fantômes). Le RNG retourne `(valeur, nouvel
état)` — on file le nouvel état dans le `RaceState` retourné, pas de mutation.

Usages actuels : **dispersion** (`domain/dispersion.ts`, cône d'incertitude de
l'impulsion, demi-angles dans `tuning.dispersion`), et conséquences de contact
(tête-à-queue seedé).

## Conséquences de contact (`domain/collision.ts`)

Seuils en fraction de `maxSpeed` (`tuning.contact`) :
- `≥ fatalSpeedFrac` → fatal (crash, fin de course par défaut, P2)
- `[spinSpeedFrac, fatalSpeedFrac[` → tête-à-queue (seedé)
- `< spin` → frôlement (`grazeSpeedKeep` de vitesse conservée)

**Crash = fin** reste le comportement par défaut ; toute nuance est opt-in derrière
un réglage.

## Tours & fantôme

- `systems/lap.ts` : `LapTracker`, franchissement de checkpoints/ligne (intersection
  de segments, jamais test de zone).
- `systems/recorder.ts` + `systems/ghost.ts` : enregistrement/rejeu. Le rejeu
  re-seede à l'identique — un tête-à-queue seedé doit redonner le même résultat,
  sinon le fantôme diverge silencieusement (piège connu RNG ↔ rejeu).

## Règles d'or quand on touche la simulation

1. Garder `domain/` **pur** : pas de DOM, d'horloge, d'aléatoire global.
2. Fonctions **immuables** : retourner de nouveaux objets, ne pas muter les arguments.
3. Tout hasard → RNG seedé de `RaceState`.
4. Ajouter/maintenir un **test de déterminisme** : `run(seed, inputs)` deux fois →
   `toEqual` (voir skill `testing`).
5. Ne pas modifier `domain/` au-delà de ce que le PRD prévoit.
