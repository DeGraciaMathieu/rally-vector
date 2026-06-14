# PRD 08 — Game feel : traces, particules, interpolation, secousses

**Priorité : 2 — Impact ★★ — Effort moyen**

> Dépendances : dépend du PRD 00 | render uniquement.

## Objectif

« Le plaisir de jouer » passe par le retour visuel. On enrichit `render/` —
traces de pneus en dérapage, gerbes de poussière par surface, secousse à l'impact,
animation de déplacement plus expressive — **sans toucher à la simulation** (le
rendu ne décide rien). Le joueur *sent* l'adhérence et la vitesse, ce qui renforce
la lisibilité de **P4** et **P1** sans changer une seule règle.

## Existant technique

- `render()` interpole linéairement avec un easing `1-(1-t)²` ; `drawCar`, `drawAimAndGhost` ; `addTexture` pour le sol.
- Aucune particule, aucune trace, aucun effet d'impact.
- Le cache de tracé est statique (bon point d'ancrage pour des traces persistantes sur une couche séparée).

## Comportement

1. Traces de pneus : déposées quand l'écart angle/vitesse dépasse un seuil **lu dans l'état** (la condition de dérapage existe déjà dans `step` via la perte de grip) — `render/` ne fait que la visualiser.
2. Particules par surface : poussière (terre), graviers projetés (gravier), gerbe (flaque).
3. Secousse de caméra à l'impact fatal (intensité ∝ vitesse), respectant `prefers-reduced-motion`.
4. Animation de déplacement : léger overshoot/anticipation sur le nez de la voiture, traînée de vitesse.
5. Couche de traces persistante (offscreen séparé du cache de tracé) effacée au restart.

## Hors-scope

- Migration Pixi.js (décision PRD 00) — si elle a lieu, ce PRD s'y adapte.
- Audio (→ PRD 09).

## Impacts par couche

- `domain/` : **aucun changement** (argument de sûreté : aucune règle ni déterminisme touché).
- `data/` : seuils visuels (seuil de dérapage d'affichage, durée des traces).
- `systems/` : aucun changement (ou exposition en lecture seule d'un flag « dérape » déjà calculé).
- `render/` : `effects.ts` (particules, traces), secousse caméra, animation enrichie.
- Tests : non requis sur le rendu ; vérifier qu'aucune sortie de `domain/` n'a bougé (tests existants verts).

## Critères d'acceptation

- Les traces n'apparaissent que quand la voiture dérape réellement (cohérence avec `step`).
- `prefers-reduced-motion` désactive secousses et excès de particules.
- Déterminisme : tests `domain/`/`systems/` **inchangés et verts** (le rendu n'a rien altéré).

## Tests

- Aucun nouveau test de domaine ; **critère de non-régression** : suite existante verte, `RaceState` identique effets activés/désactivés.

## Risques / questions ouvertes

- Performance des particules sur mobile (Mathieu joue sur mobile) — budgétiser le nombre de particules, dégradation gracieuse.
- Tentation de mettre de la logique dans `render/` (ex. décider du dérapage) — interdit : la condition vient du domaine.

---
