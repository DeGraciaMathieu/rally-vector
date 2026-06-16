---
name: architecture
description: Use when needing to understand the layered structure, import rules, or where to place new code in the rally-vector project
auto_invoke: true
---

# Architecture — Rallye Vecteur

Architecture en **couches strictes**, une seule direction de dépendance. Une
couche ne connaît que les couches à sa gauche.

```
data → domain        (data ne dépend que des TYPES de domain)
domain               (ne dépend de RIEN d'autre)
systems → domain, data
render  → domain, data, systems   (en LECTURE SEULE)
```

| Couche      | Rôle                                              | Peut importer                | Interdits absolus |
|-------------|---------------------------------------------------|------------------------------|-------------------|
| `domain/`   | Logique pure, déterministe                         | rien                         | `window`, `document`, canvas, `Date`, `Math.random` |
| `data/`     | Tables pures, zéro logique                         | types de `domain/`           | toute fonction à effet, toute branche conditionnelle de gameplay |
| `systems/`  | Orchestration temporelle, I/O, persistance, caméra | `domain/`, `data/`           | dessiner ; muter l'état autrement que via `domain/` |
| `render/`   | Canvas : lit l'état, dessine                       | `domain/`, `data/`, `systems/` | **décider quoi que ce soit** ; écrire dans l'état |

**`render/` ne décide rien.** Toute condition de jeu (dérapage ? contact fatal ?)
est calculée dans `domain/` et exposée dans `RaceState` ; `render/` ne fait que la
visualiser. Une règle de jeu écrite dans `render/` est mal placée → elle va dans `domain/`.

La règle de direction d'import est vérifiée par `npm run lint`.

## Fichiers par couche

```
src/
  domain/   vec2, surfaces (types), car, track, physics, collision, geometry,
            dispersion, obstacles, rng, gameState, turnmods, trackgen, ai
  data/     tuning, surfaces (table), cars, modifiers, obstacles, effects,
            genParams, version, tracks/, bots
  systems/  simulation, input, lap, camera, recorder, ghost, storage, race
  render/   canvasRenderer, effects
  main.ts   composition root (câble systems + render)
```

## Cœur de la simulation

Fonction pure, pas de mutation en place :
```ts
step(state: RaceState, impulse: Vec2, car: Car): RaceState
```
Voir `domain/gameState.ts` (`resolveMove`, `applyMove`) et `domain/physics.ts`.
La simulation avance par **tours discrets** : un tour = une impulsion validée.
L'animation entre deux tours appartient à `render/` et **n'influence jamais l'état**.

## Où placer du nouveau code

- **Nouvelle règle physique / résolution de tour** → `domain/physics.ts`, `domain/gameState.ts`
- **Nouvelle surface de sol** → entrée dans `data/surfaces.ts` (type dans `domain/surfaces.ts`)
- **Nouvelle voiture** → entrée dans `data/cars.ts` (type dans `domain/car.ts`)
- **Nouveau modificateur de tour** → entrée dans `data/modifiers.ts` (type `TurnMods` dans `domain/turnmods.ts`)
- **Constante d'équilibrage globale** → `data/tuning.ts`
- **Détection de contact / géométrie** → `domain/collision.ts`, `domain/geometry.ts`
- **Hasard de gameplay** → toujours via le RNG seedé de `domain/rng.ts` porté dans `RaceState`
- **Orchestration d'un tour, tours/laps** → `systems/simulation.ts`, `systems/lap.ts`
- **Pilote/IA d'un bot** → `domain/ai.ts` (décision pure) ; profils + réglages dans `data/bots.ts` ; peloton (course simultanée) dans `systems/race.ts` (voir skill `bots`)
- **Caméra, fantôme, persistance, input** → `systems/`
- **Dessin, effets visuels, easing** → `render/`

## Conventions de code (transverses)

- TypeScript `strict`, pas de `any` ; préférer des types `domain/` explicites (`Vec2`, `Surface`, `CarState`, `RaceState`, `Track`).
- **Immutabilité dans `domain/`** : les fonctions retournent de nouveaux objets, ne mutent jamais leurs arguments. `Vec2` est immuable (`add`, `scale`… renvoient un nouveau vecteur).
- **Pas de nombre magique** dans la logique : toute constante d'équilibrage vit dans `data/tuning.ts`, `cars.ts`, `surfaces.ts` ou `modifiers.ts`.
- **Franchissement / contact = intersection de segments**, jamais test de zone (le déplacement d'un tour est un segment droit potentiellement long).
- Nommage : types et identifiants en **anglais**, commentaires et messages en **français**.
- Un système = un fichier à responsabilité unique (`lap.ts`, `camera.ts`, `ghost.ts`…). Le `domain/` reste sans dépendance externe.

## Invariant central

**Déterminisme (P5)** : `(seed, carId, trackId, séquence d'impulsions)` → course
identique, bit pour bit au niveau `RaceState`. Non négociable. C'est ce qui fait
marcher les fantômes et les tests. Voir le skill `simulation` et `testing`.
