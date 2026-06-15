---
name: cars
description: Use when modifying car characteristics, physics (impulse/inertia), turn modifiers, or adding a new car in the rally-vector project
auto_invoke: true
---

# Voitures & physique — Rallye Vecteur

**P1 — La tension naît de l'inertie.** L'impulsion n'est pas le déplacement : la
quantité de mouvement décide. Le joueur anticipe, ne réagit pas.

## Anatomie d'une voiture (`domain/car.ts` → table `data/cars.ts`)

| Champ          | Rôle |
|----------------|------|
| `id` / `label` | identité |
| `maxImpulse`   | poussée max par tour (longueur de la flèche) |
| `maxSpeed`     | vitesse de pointe (plafond) |
| `gripFactor`   | multiplie le `grip` de la surface (voiture « terre » souffre moins du gravier) |
| `dragFactor`   | multiplie le `drag` de la surface |
| `angleGripLoss`| perte d'adhérence en braquage à grande vitesse |
| `livery`       | couleur de carrosserie (rendu, pas d'asset) |

La voiture est une **donnée** : type dans `domain/car.ts`, valeurs dans
`data/cars.ts` (`cars`, `carById`). Aucune caractéristique véhicule ne vit dans
`Tuning` (réglages globaux uniquement).

## Résolution d'un tour (`domain/physics.ts`, `domain/gameState.ts`)

L'impulsion validée (visée du pilote, plafonnée à `maxImpulse`) se combine à la
**vélocité existante** (inertie), modulée par le `grip` effectif de la surface ×
`gripFactor`, plafonnée à `maxSpeed`, puis amortie par le `drag` effectif. Le
`heading` suit la vélocité. Tout passe par `resolveMove` → `applyMove`, fonctions
**pures** (pas de mutation, pas d'horloge, pas de hasard non seedé).

`CarState = { pos, vel, heading }`. Voir `RaceState` dans `domain/gameState.ts`.

## Modificateurs de tour (`domain/turnmods.ts`, `data/modifiers.ts`)

Un `Modifier` multiplie ponctuellement la résolution du prochain tour via `TurnMods`
(`{ impulse, grip, drag, vel }`). Donnée inerte : ajouter un mod = une entrée dans
`MODIFIERS`. `charges < 0` = illimité ; `charges ≥ 0` = ressource de run décrémentée
à l'usage (ex. Boost : 3 charges). Le mod sélectionné est porté dans `RaceState.mod` ;
l'orchestration (consommation de charge) est dans `systems/simulation.ts`
(`resolveTurnMods`).

## Ajouter une nouvelle voiture

1. Ajouter l'objet dans `cars` de `data/cars.ts`.
2. Aucune modification du `domain/` (les champs existent déjà dans `Car`).
3. Si une **nouvelle mécanique physique** est requise, elle va dans `domain/physics.ts`
   (jamais dans `data/`), avec sa constante d'équilibrage dans `data/tuning.ts`.
4. Ajouter un test physique + un test de déterminisme (skill `testing`).

## Garde-fous

- Pas de nombre magique dans la logique : toute constante d'équilibrage vit dans
  `data/tuning.ts`, `data/cars.ts` ou `data/surfaces.ts`.
- `Vec2` est immuable (`add`, `scale`… renvoient un nouveau vecteur).
- Ne jamais ajouter d'aide qui *pilote* à la place du joueur (P1).
