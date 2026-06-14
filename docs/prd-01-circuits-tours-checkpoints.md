# PRD 01 — Circuits data-driven, tours et checkpoints

**Priorité : 1 — Impact ★★★ — Effort moyen**

> Dépendances : dépend du PRD 00 | bloque les PRD 02, 03, 06, 07.

## Objectif

Aujourd'hui le circuit est codé en dur dans `Track`, et le comptage de tours
repose sur une heuristique `finishX` + un seul checkpoint. Pour avoir plusieurs
spéciales, des tracés intéressants et des chronos fiables (**P2**, **P4**), il
faut un **modèle de circuit en données** : tilemap, surfaces, départ, ligne
d'arrivée, checkpoints ordonnés. Le joueur y gagne des tracés variés et un
comptage de tour qui ne triche jamais.

## Existant technique

- `Track.grid` construit par `inRing`/`paint` ; `surfaceAt`/`isSolid` ; `startPos`, `finishX`, `checkpoint` (un seul rectangle), `armed` géré dans `Game.detectLap`.
- `buildCache` rend le tracé hors-écran à partir de la grille.
- `detectLap` : franchit `finishX` vers la droite si `armed`, met à jour `bestLap`.

## Comportement

1. Type `Track` en données : `width/height` en tuiles, `tiles: SurfaceId[]`, `start {pos, heading}`, `finishLine {a, b}` (segment), `checkpoints: Segment[]` **ordonnés**.
2. Un tour compte si tous les checkpoints ont été franchis **dans l'ordre** depuis le dernier passage de ligne, puis la `finishLine` est franchie dans le bon sens. Remplace l'heuristique `finishX`.
3. `system/lap.ts` expose un `LapTracker` pur : `update(prevPos, nextPos) → LapEvent[]` (`checkpoint`, `lapComplete`).
4. Le circuit du proto devient `tracks/track-01.ts` au nouveau format (iso-rendu).
5. Détection de franchissement par **intersection de segments** (déplacement = segment droit par tour), pas par zone — robuste aux grandes vitesses qui « sautent » par-dessus une zone fine.
6. Au moins 2 circuits livrés (le tracé porté + un second tracé manuel plus technique) pour valider le data-driven.

## Hors-scope

- Génération procédurale (→ PRD 07).
- Circuits plus grands que l'écran et scrolling (→ PRD 02).
- Éditeur de circuit (potentiel futur, non prévu).

## Impacts par couche

- `domain/` : `geometry.ts` (intersection de segments), types `Track`, `Checkpoint`.
- `data/` : `tracks/track-01.ts`, `tracks/track-02.ts`, index des circuits.
- `systems/` : `lap.ts` réécrit en `LapTracker` ordonné.
- `render/` : `buildCache` lit la tilemap du `Track` (aucune logique de jeu).
- Tests : `geometry.test.ts`, `lap.test.ts`.

## Critères d'acceptation

- Deux circuits chargeables, l'un strictement iso-visuel avec le proto.
- Un tour ne compte jamais sans tous les checkpoints dans l'ordre (test du raccourci qui saute la ligne).
- Une impulsion qui « saute » par-dessus une ligne fine la compte quand même (intersection, pas zone).
- Déterminisme : même seed + mêmes inputs sur un circuit donné → mêmes `LapEvent`.

## Tests

- `geometry.test.ts` : intersection segment/segment, cas colinéaires et tangents.
- `lap.test.ts` : ordre des checkpoints, sens de franchissement, anti double-comptage, saut de ligne fine.

## Risques / questions ouvertes

- Format auteur des tilemaps (chaînes ASCII comme le proto vs tableaux d'IDs) — ergonomie d'édition à trancher.
- Sens de franchissement : produit vectoriel signé sur la normale du segment — valider sur un circuit en huit (double franchissement).

---
