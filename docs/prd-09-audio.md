# PRD 09 — Audio procédural : moteur, dérapage, impact

**Priorité : 3 — Impact ★ — Effort faible/moyen**

> Dépendances : dépend du PRD 00 | lié au PRD 08.

## Objectif

Le son ferme la boucle de game feel : hauteur moteur selon la vitesse, crissement
en dérapage, impact au crash. Léger et réactif, jamais décisionnel. Renforce **P1**
(on entend l'inertie monter) et **P2** (le crash claque). Optionnel et coupable à
tout moment.

## Existant technique

- Aucun audio. Le proto expose déjà `vitesse` et l'état `crashed` — suffisant pour piloter du son sans nouvelle logique.

## Comportement

1. `render/audio.ts` (ou `systems/audio.ts` côté I/O) lit l'état : vitesse → hauteur d'un moteur de synthèse (WebAudio, oscillateur + filtre), pas d'asset lourd.
2. Crissement déclenché par le **même flag de dérapage** que les traces (PRD 08) — source unique de vérité dans le domaine.
3. Impact : bruit court au passage en `crashed`.
4. Mute global + respect d'une éventuelle préférence de réduction sonore.
5. Démarrage du contexte audio sur première interaction (contrainte navigateur).

## Hors-scope

- Musique, mixage avancé, assets audio externes — futur.
- Sons par surface fins — un crissement générique suffit d'abord.

## Impacts par couche

- `domain/` : aucun changement.
- `data/` : paramètres audio (plage de hauteur moteur).
- `systems/` : `audio.ts` (lecture d'état, WebAudio).
- `render/` : aucun changement de dessin.
- Tests : mapping vitesse→hauteur testable en isolation (fonction pure), pas le WebAudio.

## Critères d'acceptation

- La hauteur moteur suit la vitesse de façon lisible.
- Le crissement coïncide exactement avec le dérapage visuel (même source).
- Mute coupe tout ; le contexte démarre après interaction utilisateur.

## Tests

- `audioMapping.test.ts` : fonction vitesse→hauteur monotone et bornée.

## Risques / questions ouvertes

- Fatigue auditive d'un moteur de synthèse — soigner la courbe, prévoir un volume bas par défaut.

---
