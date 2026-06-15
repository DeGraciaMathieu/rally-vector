# PRD 15 — Tracé serpentin de spéciale : remplir la carte, supprimer le vide

**Priorité : 2 — Impact ★★★ — Effort élevé**

> Dépendances : **refond la topologie du tracé du PRD 07** et **resserre les bords du PRD 14**. **Recoupe le PRD 01** (orientation des portes / sens de franchissement) et le PRD 02 (la carte rendue doit paraître pleine). Préserve l'invariant d'accessibilité du PRD 07.

## Objectif

Une étape générée ressemble aujourd'hui à un **couloir étroit perdu dans un grand
rectangle** : une diagonale en escalier qui progresse bêtement de gauche à droite,
de larges marges de mur jamais visitées, et — depuis le PRD 14 — des élargissements
aux jonctions où la ligne de course se dilue en zone ouverte. Ça ne *ressemble pas*
à une spéciale de rallye. On veut un **trajet A→B sinueux qui occupe la carte** :
une route qui serpente, monte, redescend, fait des épingles, sans surface morte
autour ni plaza au milieu. Le joueur lit **une route**, pas une grille à moitié
vide. Sert **P3** (lisibilité de la trajectoire : un couloir clair) et **P4** (les
surfaces dessinent la ligne de course, pas un terrain vague), sans toucher **P5**.

## Existant technique

- `domain/trackgen.ts` : waypoints à **x croissant régulier** (`xs[i]` monotone), `ys[i]` aléatoire par colonne ; tronçons **horizontal puis vertical** reliant `waypoint i → i+1`. La progression est strictement gauche→droite (monotone en x).
- `carve` ouvre un cœur garanti (`half`) + un anneau de dilatation jusqu'à `maxHalf` selon le bruit de bord (PRD 14) → **élargissements aux jonctions** quand un tronçon vertical longe une porte.
- Portes : `gate(wp)` fabrique un segment **vertical** (a haut, b bas) en supposant un franchissement **vers +x** (« tous les tronçons horizontaux vont vers la droite »). Checkpoints placés au **milieu des sous-tronçons horizontaux**.
- Grille fixe `28×24` ; tout ce qui n'est pas creusé est `outOfBounds` (`WALL`) → de **larges marges mortes** autour d'un tracé qui n'utilise qu'une bande.
- `isTerminable` : BFS 4-connexe, prouve A→B sur la spine.
- `systems/lap.ts` : franchissement par **intersection de segments orientés** (sens pris en compte).

## Comportement

1. **Tracé serpentin remplissant.** Les waypoints décrivent un parcours qui **occupe la carte** (va-et-vient vertical *et* horizontal), au lieu d'une simple diagonale. Nombre de waypoints/segments et amplitude **(tunables)**, dimensionnés pour viser une couverture roulable minimale de la grille.
2. **Épingles autorisées.** `x` peut **décroître** d'un waypoint au suivant (switchbacks) ; les tronçons restent axis-aligned (H puis V) reliant les waypoints successifs. Départ = premier waypoint, arrivée = dernier.
3. **Espacement minimal anti-fusion.** Deux passes **non consécutives** du tracé ne s'approchent jamais à moins de `minLaneGap` tuiles **(tunable, ≥ `laneWidthMax` + marge)** : deux couloirs parallèles ne fusionnent pas en plaza → la ligne de course reste **un couloir lisible** (P3/P4).
4. **Couloir resserré.** Réduire l'effet de dilatation/jonction du PRD 14 (largeur cible plus contenue, `laneWidthMax` abaissé, seuil de bord relevé — **tunables**) pour supprimer les zones roulables trop ouvertes, sans perdre l'irrégularité naturelle des bords.
5. **Réduction des marges mortes.** Le tracé doit couvrir au moins `minCoverage` **(tunable)** des tuiles de la grille ; sinon le générateur ajuste/re-tire (repli borné, déterministe par seed).
6. **Portes orientées selon le sens local.** Avec les épingles, le franchissement n'est plus toujours `+x` : chaque porte (checkpoints + arrivée) est **perpendiculaire au sens local du tracé** et orientée dans le sens de la course. Les checkpoints restent **ordonnés le long du tracé**.
7. **Anti-croisement.** Un tronçon ultérieur ne recoupe pas un tronçon antérieur d'une façon qui créerait un **raccourci sautant des checkpoints** ; l'espacement minimal (3.) en est le garde-fou principal.
8. **Déterminisme.** Tout le hasard (waypoints, repli, bruit) passe par le **RNG seedé** local, dans un **ordre de tirage stable** : même `(seed, cfg)` → `Track` identique.

## Hors-scope

- **Recadrage dynamique de la carte/caméra** au plus près du tracé (l'autre option envisagée) : on remplit le rectangle existant, on ne le rogne pas → éventuel PRD caméra (PRD 02).
- **Embranchements / multi-chemins / raccourcis volontaires** : un seul tracé → PRD dédié.
- **Réglage « difficulté »** ciblé (longueur/technicité par niveau) : reste hors-scope (PRD 07).
- **Nouvelles surfaces / obstacles / eau** : régis par les PRD 14 / 03, inchangés ici.
- **Décor / biomes visuels** : cosmétique futur.

## Impacts par couche

- `domain/` : `trackgen.ts` — génération de waypoints serpentins (épingles), contrainte d'espacement minimal anti-fusion, couverture cible + repli déterministe, orientation des portes selon le sens local, resserrement du couloir. `isTerminable` **réutilisé** (garde-fou). Éventuels helpers `geometry.ts`.
- `data/` : `genParams.ts` — nouveaux/ajustés : nombre de waypoints, amplitude, `minLaneGap`, `minCoverage`, `laneWidthMax` resserré, seuil de bord.
- `systems/` : `lap.ts` — **à vérifier** qu'il gère un sens de franchissement **quelconque** (pas seulement +x) ; étendre seulement si nécessaire.
- `render/` : **aucun changement** (rend n'importe quel `Track` — argument de sûreté).
- Tests : `trackgen.test.ts` (+ `lap.test.ts` si l'orientation des portes évolue).

## Critères d'acceptation

- Même `(seed, cfg)` → `Track` **identique** (déterminisme P5).
- Sur un large échantillon de seeds : **100 % terminables** ; couverture roulable **≥ `minCoverage`** (le vide a reculé) ; **aucune fusion** de passes non consécutives (espacement `minLaneGap` respecté) → la ligne de course reste un couloir, jamais une plaza.
- Trajet **A→B** : départ = premier waypoint, arrivée = dernier ; checkpoints **ordonnés** le long du tracé et **franchissables dans le bon sens local**.
- **Aucun raccourci** sautant des checkpoints (anti-croisement vérifié).
- Largeur du couloir **contenue** (≤ `laneWidthMax` resserré hors jonctions) ; bords toujours irréguliers (non-régression visuelle PRD 14 préservée dans l'esprit).
- `generateTrack` reste **pure** de `(seed, cfg)` ; aucun `Math.random`.

## Tests

- `trackgen.test.ts` :
  - **reproductibilité** : `generateTrack(seed, cfg)` deux fois → `Track` égal.
  - **terminabilité** : 1000 seeds → 100 % terminables.
  - **couverture** : part de tuiles roulables ≥ `minCoverage` (réduction des marges mortes).
  - **anti-fusion** : deux tuiles de spine non consécutives ne sont jamais à moins de `minLaneGap` (pas de couloirs parallèles collés).
  - **A→B & checkpoints** : départ/arrivée aux extrémités du tracé, checkpoints ordonnés le long du parcours et franchissables dans le sens local.
  - **largeur contenue** : sur une ligne droite, largeur ≤ `laneWidthMax`.
- `lap.test.ts` : si l'orientation des portes évolue, franchissement compté pour un sens **non +x** (épingle), et **non compté** à contresens.

## Risques / questions ouvertes

- **Remplir vs lisibilité** : plus on remplit avec des épingles, plus les passes se rapprochent ; l'espacement `minLaneGap` peut **empêcher** d'atteindre `minCoverage`. Arbitrer couverture cible vs couloir lisible **au plan**, ne pas figer seul — éprouver en jeu.
- **Orientation des portes (recoupe PRD 01)** : le sens de franchissement n'est plus `+x`. Calculer le sens local et **vérifier que `lap.ts` gère un sens quelconque** ; sinon l'étendre. Risque de **casser silencieusement** le comptage de checkpoints — à tester explicitement.
- **Terminabilité + anti-croisement** : un anti-croisement trop strict peut rendre certains seeds non générables. Prévoir un **repli borné déterministe** (re-tirage) qui ne casse pas « même seed → même course ».
- **Coût de génération** : contraintes d'espacement + repli peuvent multiplier les essais par seed ; surveiller le temps sur 1000 seeds (tests).
- **Interaction PRD 14** : resserrer la largeur atténue l'effet « bords irréguliers / sols en taches ». Trouver l'équilibre naturel ↔ couloir lisible — à éprouver.
- **Métrique de « zone inutile »** : faut-il une couverture chiffrée stricte (risque de sur-contraindre) ou une heuristique douce ? À trancher au plan.

---
