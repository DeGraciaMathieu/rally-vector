---
name: bots
description: Use when modifying bot AI, opponent drivers, the peloton/race orchestration, or bot tuning in the rally-vector project
auto_invoke: true
---

# Bots & course contre IA — Rallye Vecteur

Peloton d'adversaires **pilotés par IA**, course **simultanée** (premier à
l'arrivée), **sans collision voiture-voiture** (les voitures se traversent), crash =
élimination (PRD 16). Chaque bot est une voiture à part entière qui réutilise la même
physique que le joueur. **Déterminisme (P5) non négociable** : tout est seedé.

## Couches

- `domain/ai.ts` — `decideImpulse(body, target, surf, car, profile, speedLimit, isSolid, rng)` : **PUR**. L'IA vise une cible en pliant l'inertie (`solveImpulse`), module la poussée par le profil, ajoute un **bruit de visée seedé** (un tirage RNG), puis un **gouverneur anti-mur** (lookahead d'un tour) réduit la poussée tant que le déplacement taperait un mur / dépasserait `speedLimit` ; acculé → freine à contresens. Type `BotProfile`.
- `data/bots.ts` — table `BOT_PROFILES` (agressivité, marge de freinage, bruit), `PELOTON_SIZE`, `START_GRID`, et `AI_NAV` (réglages pure-pursuit + freinage anticipé). **Inerte**.
- `systems/race.ts` — `Peloton` : N bots, **un flux RNG seedé par voiture** (`deriveSeed(raceSeed, i+1)`), un `LapTracker` chacun. `advance()` = un tour pour tous (au commit du joueur). Navigation **pure-pursuit** le long de `track.path` (ligne de course) → le bot reste sur la spine (hors obstacles). `runToEnd()` fige le classement. `views(progress)` pour le rendu, `standings(player)` pour le classement.

## Lois à respecter

1. **Pas de collision voiture-voiture** : un bot ne lit jamais l'état d'un autre. L'ordre d'avancement n'a aucune incidence → repro garantie.
2. **RNG par voiture** : jamais `Math.random`. Le bruit de visée IA tire **avant** la dispersion du tour (ordre stable). Le joueur garde `raceSeed` ; les bots `deriveSeed(raceSeed, i+1)`.
3. **Dispersion OFF pour les bots** par défaut : le cône d'incertitude (PRD 12) ajoute un bruit non anticipable par le gouverneur → crashs ; l'imperfection des bots vient du `aimJitter` du profil (lui dans le lookahead).
4. **`track.path`** (centres des coins du serpentin, exposé par `trackgen`) sert la navigation des bots ; absent des circuits faits main (fallback : viser le prochain checkpoint). Indicatif : ne touche ni collision ni laps.
5. **Réutiliser `advanceTurn`** (systems/simulation) : même physique que le joueur et le fantôme. Ne pas dupliquer la résolution de tour.
6. Pas de nombre magique dans la navigation : tout réglage dans `data/bots.ts` (`AI_NAV`, profils).

## Tests

- `test/ai.test.ts` : `decideImpulse` déterministe, bornée, agressif > prudent, vise la trajectoire (rapproche plus que l'inertie seule).
- `test/race.test.ts` : peloton déterministe ; indépendance (un bot avance pareil seul ou en peloton = pas de collision) ; bot fini/crashé figé ; quelqu'un franchit l'arrivée ; classement (arrivés avant en-course).

## Pièges connus

- **IA qui crashe en boucle** : viser le centre du prochain checkpoint fait couper les murs du serpentin → toujours suivre `track.path` en pure-pursuit, pas le checkpoint brut.
- **Strict + dispersion** : en mode crash=fin, le moindre frôlement de mur est fatal ; garder la dispersion off pour les bots et le gouverneur anti-mur actif.
