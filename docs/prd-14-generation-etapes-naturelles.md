# PRD 14 — Génération d'étapes naturelles : sols en taches, bords irréguliers, eau & obstacles

**Priorité : 2 — Impact ★★ — Effort élevé**

> Dépendances : **refond la génération du PRD 07** (couloir + peinture des sols). S'appuie sur le PRD 03 (obstacles) et le modèle de surfaces (`WATER` du PRD 04/surfaces). Préserve l'invariant d'accessibilité du PRD 07.

## Objectif

Les spéciales générées ont l'air **fabriquées** : couloirs en blocs de largeur constante,
sols peints par tronçons entiers à angles droits, obstacles éparpillés uniformément. Le
joueur lit une grille, pas un terrain. On veut des étapes qui **se lisent comme un paysage**
— transitions de sol progressives, bords de piste qui respirent, flaques posées comme des
pièges, obstacles groupés en lisières — tout en gardant la garantie de terminabilité. Sert
**P4** (les lignes de course naissent des surfaces, qui doivent être lisibles et non
quadrillées) et **P3** (lisibilité de la trajectoire), sans jamais toucher **P5** : tout
reste pur et seedé. On en profite pour donner enfin un rôle à l'eau dans la génération.

## Existant technique

- `domain/trackgen.ts:generateTrack(seed, cfg)` : waypoints (`xs` régulier, `ys` aléatoire par colonne), puis `carve` d'un **disque carré de rayon `half` constant** le long de segments horizontaux puis verticaux → couloir de largeur fixe à angles droits.
- Surfaces peintes **par tronçon entier** : `surfH`/`surfV` = `roadId` ou `pick(roughIds)` pour tout le segment → blocs rectangulaires uniformes.
- Obstacles posés **tuile par tuile** hors-spine avec une proba uniforme `obstacleDensity` → éparpillement régulier.
- `data/genParams.ts:GEN` : `roughIds: ['DIRT','GRAVEL']` (pas de `WATER`), `laneWidth: 3` constant, `obstacleDensity: 0.1` uniforme.
- `WATER` existe dans `data/surfaces.ts` (hazard, `grip 0.18`, `drag 0.45`) mais **n'est jamais posé** par la génération (absent de `roughIds`).
- `isTerminable` : BFS 4-connexe sur les surfaces non solides, prouve A→B (garde-fou).
- RNG seedé (`createRng`/`nextRandom`) porté localement dans la génération ; aucun `Math.random`.

## Comportement

1. **Topologie inchangée.** On conserve le squelette (waypoints + parcours gauche→droite, segments horizontaux/verticaux) et l'invariant « spine toujours dégagée et terminable ». La refonte porte sur le **rendu** des sols, des bords et du placement — pas sur la forme du tracé.
2. **Bords de couloir irréguliers.** La largeur du `carve` varie le long du tracé via un bruit seedé borné `[laneWidthMin, laneWidthMax]` (tunables), avec un contour érodé/dilaté plutôt qu'un disque carré constant. Garde-fou strict : la **largeur minimale autour de la spine** (`half`) reste toujours dégagée et roulable — l'érosion ne l'entame jamais.
3. **Sols en taches organiques.** Remplacer la peinture par tronçon uniforme par un **champ de sol seedé** : chaque tuile roulable reçoit son sol (`roadId`/`roughIds`) d'un champ de bruit lissé spatialement, à l'échelle `surfaceNoiseScale` (tunable) → transitions progressives, fin des blocs rectangulaires.
4. **Flaques d'eau ponctuelles.** Passe dédiée posant `waterPatches` flaques (tunable) de `WATER` comme **hazard localisé**, de petite taille bornée (`waterPatchSize`, tunable), réparties par seed sur la piste. Elles ne saturent jamais la spine au point de la rendre non roulable (cap de couverture).
5. **Obstacles regroupés.** Remplacer le tirage uniforme par tuile par un placement en **grappes/lisières** seedé : `obstacleClusters` foyers (tunable) de taille bornée, posés **hors-spine** uniquement. Densité globale conservée dans des bornes ; jamais d'obstacle sur la ligne de course.
6. **Tout le hasard via le RNG seedé** porté dans la génération (bruit de largeur, champ de sol, positions/tailles de flaques, foyers de grappes). Même `(seed, cfg)` → `Track` identique, bit pour bit.
7. **Valeurs de départ (tunables)** dans `data/genParams.ts` : amplitude de variation de largeur, échelle du bruit de sol, nombre/taille des flaques, nombre/taille des grappes d'obstacles.

## Hors-scope

- **Topologie du tracé** (chemins courbes/diagonaux, embranchements, raccourcis) : le tracé reste en escalier → PRD futur si besoin.
- **Effet visuel d'eau** (gerbe au passage) : cosmétique, `render/` → PRD dédié.
- **Biomes / décor visuel variés** : déjà hors-scope du PRD 07, le reste.
- **Réglage « difficulté » de la génération** (longueur, technicité) : reste hors-scope (PRD 07).
- **Nouvelles surfaces** ou modification du modèle de `Surface` : on réutilise l'existant.

## Impacts par couche

- `domain/` : `trackgen.ts` — bruit de largeur de `carve`, champ de sol seedé, passe flaques d'eau, passe grappes d'obstacles. `isTerminable` **inchangé** (réutilisé comme garde-fou). Aucun nouveau type exporté.
- `data/` : `genParams.ts` — nouveaux paramètres (amplitude de largeur, échelle du bruit de sol, densité/taille des flaques, densité/taille des grappes). `WATER` déjà présent dans `surfaces.ts`.
- `systems/` : **aucun changement** — la sélection « étape par seed » et la forme du `Track` produit sont préservées.
- `render/` : **aucun changement** — rend n'importe quel `Track` (argument de sûreté) ; `hazard` reste cosmétique.
- Tests : `trackgen.test.ts`.

## Critères d'acceptation

- Même `(seed, cfg)` → `Track` **identique** (tilemap, sols, eau, obstacles, checkpoints), bit pour bit.
- Sur un large échantillon de seeds : **100 % terminables** ; spine toujours dégagée (roulable, sans obstacle) ; l'eau ne rend jamais la spine non roulable.
- Les sols ne sont plus peints en **blocs uniformes par tronçon** (transitions par taches) ; les bords de couloir **varient** en largeur entre `laneWidthMin` et `laneWidthMax`.
- `generateTrack` reste **pure** de `(seed, cfg)` ; aucun `Math.random` ; tout hasard via le RNG seedé.
- Non-régression structurelle : `start`, `finishLine`, `checkpoints`, runway et invariant d'accessibilité inchangés dans leur contrat.

## Tests

- `trackgen.test.ts` :
  - **reproductibilité** : `generateTrack(seed, cfg)` deux fois → `Track` égal (incluant eau et grappes).
  - **terminabilité** : sur 1000 seeds, 100 % de circuits terminables ; la spine est toujours roulable et sans obstacle.
  - **bornes** : largeur du couloir dans `[laneWidthMin, laneWidthMax]` ; nombre/taille de flaques et de grappes dans leurs bornes ; couverture d'eau sur la spine sous le cap.
  - **naturalité** (fonctionnel, pas micro) : un sol ne s'étend plus uniformément sur tout un tronçon (présence de transitions de surface au sein d'un même segment) ; obstacles présents en grappes plutôt qu'isolés uniformément.
  - **checkpoints** : ordonnés et posés sur la piste.

## Risques / questions ouvertes

- **Choix du bruit** : champ de valeur seedé maison vs croissance de blobs vs bruit type Perlin réimplémenté pur — coût, qualité visuelle et stabilité. Trancher au plan, rester **pur et seedé**.
- **Eau sur la spine** : une flaque sur la ligne de course est un hazard *voulu*, mais trop d'eau = étape pénible voire injouable au ressenti. Borne nombre/taille/cap à **éprouver en jeu**, ne pas figer seul (cf. P2).
- **Lisibilité (P3/P4)** : des taches trop bruitées brouillent la lecture des lignes de course. Garder des zones lisibles ; échelle de bruit à éprouver.
- **Bords irréguliers vs terminabilité** : l'érosion ne doit **jamais** entamer la largeur minimale garantie autour de la spine — cap inférieur strict, testé.
- **Ordre de tirage RNG** : ajouter des passes (bruit, flaques, grappes) modifie la séquence consommée par le RNG. Fixer et **documenter un ordre stable** ; les seeds d'avant cette refonte produiront forcément d'autres tracés (rupture assumée de la repro inter-versions, pas de la repro à version figée).

---
