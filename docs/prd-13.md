# PRD 13 — Modificateurs de tour : boost à risque & frein à main

**Priorité : 2 — Impact ★★★ — Effort moyen**

> Dépendances : dépend du PRD 00 (couches/déterminisme). **Étend le recorder du PRD 06** (l'input du tour gagne un champ). Interagit avec le PRD 11 (le frein à main recoupe la zone atteignable). Lié au PRD 04 (ordre de tirage RNG si dispersion/spin présents).

## Objectif

Aujourd'hui chaque tour a un **coup optimal unique** : on cherche le meilleur vecteur,
on le joue, il n'y a pas d'arbitrage. On donne au joueur un **second verbe** — des
modificateurs qui changent la *nature* du coup contre un coût — pour qu'à chaque virage
il y ait un dilemme plutôt qu'une solution. Sert **P2** (risk/reward) en transformant le
mono-choix en compromis. Le joueur ressent : « je pousse fort et je risque la sortie, ou
je tire le frein à main et je sécurise une ligne plus lente mais propre ? »

Ce PRD établit le **système de modificateurs de tour** (la décision d'architecture) et le
valide avec **deux instances** : un boost à risque et un frein à main.

## Existant technique

- `commit()` → `Physics.step(vel, impulse, surf)`. Un seul type de coup ; aucun second verbe.
- `TUNING.maxImpulse`, `surf.grip`, `surf.drag` sont les seuls leviers du tour, globaux.
- Post PRD 06 : le recorder enregistre **l'impulsion seule** par tour — à étendre ici.
- Aucune notion de ressource/charge consommable côté course.

## Comportement

1. Notion de `TurnMods` (modificateur du tour), **data-driven** ; défaut = aucun (coup normal, comportement actuel strictement inchangé).
2. `step(state, impulse, car, mods)` applique `mods` aux **paramètres effectifs du tour** (impulsion max, grip, drag, autorité de rotation). `mods` neutre = identité → rétrocompatible.
3. **Boost à risque** : +X % d'impulsion max ce tour, grip ×k (k < 1) ce tour ; **ressource limitée** (N charges par run). Arbitrage vitesse maintenant vs contrôle maintenant.
4. **Frein à main** : scrub fort de la vitesse + autorisation de **plier la trajectoire au-delà du grip normal** (pivot serré) ce tour, au prix de la progression avant du tour. Arbitrage ligne serrée/lente vs large/rapide.
5. Sélection du modificateur **avant validation** (toggle bouton/touche) ; le geste de visée reste identique.
6. Valeurs de départ : boost +40 % d'impulsion, grip ×0.7, 3 charges/run ; frein à main vitesse ×0.5, autorité de rotation +50 %, coûte la poussée avant du tour. (tunables)
7. **Cohérence rejeu** : le modificateur choisi fait partie de l'input du tour. Le recorder (PRD 06) enregistre `{ impulse, mods }` ; le fantôme rejoue les mêmes modificateurs → trajectoire identique.

## Hors-scope

- **Usure des pneus / carburant** (économie de ressource sur toute la run, grip qui décroît) : décision distincte → PRD dédié.
- **Raccourcis piégés** (level design / génération) → PRD 01 / 07.
- **Modificateurs supplémentaires** au-delà des deux instances : le système est extensible par données, mais on n'en livre que deux pour le valider.

## Impacts par couche

- `domain/` : `step` prend `TurnMods` ; `turnmods.ts` (application pure des mods aux paramètres effectifs). Types `TurnMods`, `ModId`.
- `data/` : `modifiers.ts` (table boost / frein à main, coûts, charges) ; `tuning.ts` (valeurs).
- `systems/` : `input.ts` — sélection du mod ; `simulation.ts` — gestion des charges (dans `RaceState`), passage de `mods` à `step`. **`recorder.ts` / `ghost.ts` (PRD 06) étendus** pour capturer et rejouer `mods`.
- `render/` : indicateur du mod actif, charges restantes, trajectoire prévue reflétant le mod ; feedback distinct (halo/couleur) — cosmétique.
- Tests : `turnmods.test.ts`, `step.test.ts` (mods neutres = comportement actuel), `ghost.test.ts` (capture des mods).

## Critères d'acceptation

- `mods` neutre → `RaceState` strictement identique au comportement actuel (régression interdite).
- Boost : portée du tour mesurablement accrue et contrôle dégradé ; charges décrémentées, **bornées à ≥ 0** (jamais de charge négative ni d'usage sans charge).
- Frein à main : vitesse réduite et pli plus serré qu'un tour normal ; la progression avant est bien consommée.
- Déterminisme : (seed, impulsions, mods) fixés → course identique ; un run enregistré **avec** modificateurs se rejoue à l'identique.

## Tests

- `turnmods.test.ts` : application des mods aux paramètres ; neutre = identité ; bornes des charges (pas d'usage sans charge).
- `step.test.ts` : mods neutres reproduisent exactement le `step` actuel (non-régression).
- `ghost.test.ts` : capture et rejeu des `mods` (un run avec boosts + freins à main rejoué à l'identique).

## Risques / questions ouvertes

- **Équilibrage** : un modificateur dominant (toujours booster) supprime l'arbitrage. Régler coûts/charges en jeu ; il doit exister des contextes où chaque mod — y compris « aucun » — est le meilleur choix. À éprouver, ne pas figer seul.
- **Interface du second verbe** : toggle bouton/touche vs second geste (lié au PRD 11). Sur mobile, ne pas surcharger le doigt. À trancher au plan.
- **Dépendance PRD 06** : si les mods ne sont pas enregistrés, les fantômes divergent **silencieusement**. Séquencer après/avec le PRD 06, ou prévoir le champ `mods` dès la conception de l'enregistrement.
- **Frein à main vs pliage (PRD 11)** : « plier au-delà du grip » recoupe la zone atteignable du PRD 11 (il l'élargit ponctuellement). Définir l'interaction — le frein à main = disque atteignable agrandi ce tour ? — pour éviter deux mécaniques redondantes.
- **Boost & crash = fin** : le boost augmente le risque de finir dans le mur ; cohérent avec **P2**, mais l'aide (et le cône du PRD 12 si présent) doit **montrer** le risque accru, sinon c'est une mort gratuite.
- **Ordre de tirage RNG** : si le boost a une composante aléatoire ou cohabite avec la dispersion (PRD 12) / le spin (PRD 04), respecter la convention d'ordre de tirage par tour.