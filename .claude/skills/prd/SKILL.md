---
name: prd
description: Implement a PRD or feature following the rally-vector layered + deterministic workflow. $ARGUMENTS = numéro de PRD (ex. 14) ou description de feature.
user_invocable: true
---

# PRD / Feature — Rallye Vecteur

Tu reçois en argument un **numéro de PRD** (`docs/prd-NN-*.md`) ou une description
de feature. Les PRD disent **quoi** construire ; `CLAUDE.md` dit **comment**. En cas
de conflit sur une règle d'architecture ou de déterminisme, **`CLAUDE.md` gagne** —
signale le conflit, ne le tranche pas en silence.

## 1. Comprendre

- Lis `docs/prd-00-fondation-ts-vite.md` (conventions) puis le PRD ciblé.
- Respecte sa section **Impacts par couche** : si elle dit « `domain/` : aucun
  changement », ne touche pas au domaine — c'est un argument de sûreté du déterminisme.
- Reste dans le **Hors-scope** : les généralisations tentantes ont déjà leur PRD.
- Invoque le skill `architecture` pour situer les fichiers.
- Les **questions ouvertes** du PRD ne se tranchent pas seul : expose et propose.
- Reformule la feature en une phrase avant de coder.

## 2. Implémenter de bas en haut

Ordre imposé : `domain/` (+ tests) → `data/` → `systems/` (+ tests) → `render/`.

- Invoque les skills pertinents : `surfaces`, `cars`, `simulation`.
- Respecte la règle d'import (une seule direction). `domain/` reste **pur** (pas de
  DOM, horloge, `Math.random`). `data/` reste **inerte**. `render/` **ne décide rien**
  et **ne mute jamais** l'état.
- Immutabilité dans `domain/` : retourne de nouveaux objets. `Vec2` est immuable.
- Pas de nombre magique : constantes d'équilibrage dans `data/tuning.ts` (ou
  `cars.ts`/`surfaces.ts`/`modifiers.ts`).
- Tout hasard de gameplay → RNG seedé de `RaceState`.
- Types/identifiants en anglais, commentaires/messages en français.

## 3. Tester

- Invoque le skill `testing` pour le placement.
- Tests de **comportement** (fonctions exportées), pas de détails d'implémentation.
- **Obligatoire si la simulation est touchée** : assertion de déterminisme
  (`run(seed, inputs)` deux fois → `toEqual`).
- Cas limites collision/géométrie si concernés (premier contact, ligne fine, sens).
- `npm run test:run` jusqu'au vert.

## 4. Vérifier « terminé »

- Tous les **critères d'acceptation** du PRD vérifiés.
- `npm run lint` + `npm run typecheck` + `npm run test:run` verts.
- Règles de couches respectées (aucun import interdit).
- Aucun changement de `domain/` non prévu par le PRD.
- Invariant de déterminisme préservé (test présent et vert).

## 5. Documentation

- Mets à jour `CLAUDE.md` si une convention change.
- Mets à jour les skills (`architecture`, `surfaces`, `cars`, `simulation`, `testing`)
  si la feature impacte leur périmètre ; crée un skill si un domaine entièrement
  nouveau apparaît.

## 6. Résumé

Fichiers modifiés (par couche), tests ajoutés, résultat lint/typecheck/test.
