# PRD 05 — Caractéristiques de voiture data-driven

**Priorité : 2 — Impact ★★ — Effort faible**

> Dépendances : dépend du PRD 00.

## Objectif

La physique du proto a des constantes véhicule implicites (`maxImpulse`,
`maxSpeed`, sensibilité au grip). En faisant des **voitures des données**, on crée
un espace de risk/reward (**P2**) : arbitrer vitesse de pointe contre maniabilité,
adhérence contre inertie. Le joueur choisit un caractère de pilotage qui change sa
manière d'aborder chaque spéciale.

## Existant technique

- `Physics.step` lit `TUNING.maxImpulse`, `TUNING.maxSpeed`, `TUNING.angleGripLoss` (globaux, pas par voiture).
- Une seule voiture implicite, dessinée en dur dans `drawCar` (rouge).

## Comportement

1. Type `Car { id, label, maxImpulse, maxSpeed, gripFactor, dragFactor, angleGripLoss, livery }`.
2. `step(state, impulse, car)` lit les caractéristiques **de la voiture passée en paramètre**, plus des `TUNING` globaux.
3. `gripFactor`/`dragFactor` = multiplicateurs appliqués par-dessus la surface (une voiture « terre » souffre moins du gravier).
4. 3 voitures de départ : équilibrée, vive (handling haut, pointe basse), fusée (pointe haute, handling bas).
5. Sélection de voiture avant la course ; `livery` = simple couleur pour le rendu (pas d'asset).

## Hors-scope

- Déblocage/progression, upgrades — futur.
- Modèles 3D / sprites détaillés — `livery` = couleur pour l'instant.

## Impacts par couche

- `domain/` : `physics.step` prend `Car` ; types véhicule.
- `data/` : `cars.ts` (table des 3 voitures).
- `systems/` : sélection de voiture injectée dans l'état de course.
- `render/` : `drawCar` lit `livery` (cosmétique).
- Tests : `physics.test.ts` (étendu).

## Critères d'acceptation

- Trois voitures aux comportements nettement différents sur le même circuit.
- Retirer une voiture du data = elle disparaît du sélecteur sans toucher au domaine.
- Déterminisme : course identique pour (voiture, seed, inputs) fixés.

## Tests

- `physics.test.ts` : `step` varie correctement selon la voiture ; bornes `maxSpeed`/`maxImpulse` respectées par voiture.

## Risques / questions ouvertes

- Risque d'équilibrage : une voiture dominante sur tous les circuits casse le choix. Prévoir des circuits qui favorisent des profils différents (lien PRD 01/07).
- Faut-il exposer les stats au joueur (chiffres) ou les laisser ressentir ? — à trancher.

---
