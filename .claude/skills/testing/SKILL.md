---
name: testing
description: Use when writing, modifying, or debugging tests in the rally-vector project
auto_invoke: true
---

# Tests — Rallye Vecteur

## Commandes

```bash
npm run test       # vitest (watch)
npm run test:run   # vitest une passe (CI)
```

## Philosophie

- On teste `domain/`, `data/` et `systems/` **sans rendu**.
- `render/` n'est **pas** testé unitairement : il est couvert par le critère de
  non-régression (état inchangé, effets on/off — voir `test/regression.test.ts`).
- Tests de comportement : utiliser les fonctions exportées comme un consommateur du
  module, pas les détails internes.

## Test de déterminisme — SYSTÉMATIQUE

Pour **toute** feature touchant la simulation :
```ts
// même seed + mêmes inputs → même suite d'états
expect(run(seed, inputs)).toEqual(run(seed, inputs));
```
Voir `test/determinism.test.ts`. C'est l'invariant P5, non négociable.

## Cas limites obligatoires (collision / géométrie)

- premier contact
- hors-grille = solide
- segment qui « saute » par-dessus une ligne fine (intersection de segments)
- franchissement dans le **bon sens** uniquement

## Carte des fichiers de test (miroir de `src/`)

| Fichier                     | Périmètre |
|-----------------------------|-----------|
| `test/physics.test.ts`      | résolution d'un tour (impulsion × inertie, grip, drag, plafonds) |
| `test/collision.test.ts`    | contact, politique fatal/spin/graze, intersection de segments |
| `test/geometry.test.ts`     | primitives géométriques |
| `test/dispersion.test.ts`   | cône d'incertitude seedé |
| `test/obstacle.test.ts`     | contact sur obstacles (disque) |
| `test/rng.test.ts`          | RNG seedé (reproductibilité, séquences) |
| `test/determinism.test.ts`  | invariant P5 global |
| `test/simulation.test.ts`   | orchestration de tour, `resolveTurnMods`, charges de boost |
| `test/turnmods.test.ts`     | modificateurs de tour (boost, frein à main) |
| `test/lap.test.ts`          | franchissement de checkpoints/ligne, comptage de tours |
| `test/recorder.test.ts`     | enregistrement de course |
| `test/ghost.test.ts`        | rejeu fantôme (re-seed à l'identique) |
| `test/camera.test.ts`       | caméra (cosmétique, hors déterminisme) |
| `test/input.test.ts`        | visée / validation du geste |
| `test/trackgen.test.ts`     | génération procédurale de circuit |
| `test/regression.test.ts`   | non-régression (état inchangé effets on/off) |

## Où placer un nouveau test

- Physique d'un tour → `physics.test.ts`
- Effet/contact d'une surface ou obstacle → `collision.test.ts` / `obstacle.test.ts`
- Nouveau modificateur → `turnmods.test.ts`
- Hasard seedé → `rng.test.ts` ou `dispersion.test.ts`
- Orchestration / tours → `simulation.test.ts` / `lap.test.ts`
- Toute feature de simulation → **+ une assertion dans `determinism.test.ts`**

Avant de considérer une tâche terminée : `npm run lint`, `npm run typecheck` et
`npm run test:run` doivent passer.
