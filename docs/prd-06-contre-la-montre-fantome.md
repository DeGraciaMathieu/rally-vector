# PRD 06 — Contre-la-montre, fantôme déterministe et records

**Priorité : 1 — Impact ★★★ — Effort moyen**

> Dépendances : dépend des PRD 00 (déterminisme), 01 (tracks/laps).

## Objectif

C'est la feature qui *rentabilise* **P5**. Comme la simulation est déterministe et
tour-à-tour, un fantôme n'a pas besoin d'enregistrer des positions : il suffit de
**rejouer la séquence d'impulsions**. On obtient le contre-la-montre, le fantôme du
meilleur tour, et la persistance des records — le cœur de rejouabilité d'un jeu de
rallye. Le joueur se mesure à sa propre ligne idéale, tour après tour.

## Existant technique

- `bestLap` calculé en mémoire dans `Game`, perdu au rechargement.
- `commit()` produit déjà la séquence d'impulsions, mais rien ne l'enregistre.
- Simulation déterministe (post PRD 00) : rejouer les impulsions reproduit la course.

## Comportement

1. `systems/recorder.ts` : enregistre `{ seed, carId, trackId, impulses: Vec2[] }` pendant la course.
2. Rejeu : `systems/ghost.ts` réinjecte la séquence dans `step` pour produire, tour par tour, la position fantôme — **aucune position stockée**, juste les inputs (preuve de **P5**).
3. Fantôme affiché comme voiture translucide, synchronisé au même index de tour (et interpolé visuellement entre tours par `render/`).
4. Persistance `localStorage` : meilleur temps + sa séquence par (circuit, voiture).
5. Au démarrage d'une spéciale, le meilleur fantôme connu se charge automatiquement.
6. Garde-fou de version : un enregistrement devient invalide si la physique/le circuit changent (champ `simVersion`) — il est ignoré, jamais rejoué faux.

## Hors-scope

- Classements en ligne / partage (nécessiterait déterminisme cross-plateforme, cf. PRD 00 Risques).
- Fantômes multiples simultanés — un seul pour commencer.

## Impacts par couche

- `domain/` : aucun changement de logique (le rejeu réutilise `step` tel quel — argument de sûreté du déterminisme).
- `data/` : `simVersion` constante.
- `systems/` : `recorder.ts`, `ghost.ts`, `storage.ts` (localStorage).
- `render/` : voiture fantôme translucide (cosmétique).
- Tests : `recorder.test.ts`, `ghost.test.ts`.

## Critères d'acceptation

- Rejouer une séquence enregistrée reproduit **exactement** la trajectoire et le temps d'origine.
- Le meilleur temps survit à un rechargement de page.
- Un enregistrement d'une `simVersion` obsolète est ignoré proprement.
- Déterminisme : fantôme = fonction pure de (seed, carId, trackId, impulses).

## Tests

- `recorder.test.ts` : la séquence capturée rejouée donne la même suite de `RaceState`.
- `ghost.test.ts` : position fantôme au tour N = position réelle au tour N de la course source ; rejet d'une `simVersion` divergente.

## Risques / questions ouvertes

- Taille du stockage si beaucoup de circuits/voitures — négligeable (impulsions seulement), mais prévoir purge.
- Le fantôme rejoue les impulsions ; si une future feature ajoute du RNG de gameplay non re-seedé à l'identique (PRD 04 `spin`), le rejeu doit re-seed depuis le même seed — **dépendance fine à surveiller** avec le PRD 04.

---
