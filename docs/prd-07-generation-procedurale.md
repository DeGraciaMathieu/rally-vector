# PRD 07 — Génération procédurale de circuits seedée

**Priorité : 2 — Impact ★★ — Effort élevé**

> Dépendances : dépend des PRD 01 (modèle de circuit), 02 (caméra), 03 (obstacles).

## Objectif

Un seed → une spéciale complète, valide et rejouable : c'est l'expression la plus
forte de **P5** et la source de rejouabilité quasi infinie. La contrainte
structurante (l'« accessibilité de l'étage » de ce jeu) : le circuit généré doit
être **bouclé et terminable** — une ligne de course existe forcément. Le joueur
partage un seed et court la même spéciale que ses amis.

## Existant technique

- `Track` du proto = boucle rectangulaire en dur. Post PRD 01, le `Track` est une donnée ; il faut un **producteur** de cette donnée.
- `rng.ts` seedé disponible (PRD 00) ; jamais consommé pour générer du contenu.

## Comportement

1. `domain/trackgen.ts` : `generateTrack(seed) → Track` pur et déterministe.
2. Tracé : boucle fermée (anneau déformé / spline sur grille) garantie non auto-bloquante, largeur de piste suffisante pour la `maxSpeed` de la voiture la plus rapide.
3. Surfaces réparties par seed (sections terre/gravier sur les portions rapides pour créer du risk/reward — **P2/P4**).
4. Obstacles (PRD 03) posés par seed **hors de la ligne de course minimale** (jamais un arbre infranchissable sur l'unique trajectoire).
5. **Invariant d'accessibilité** : un solveur interne vérifie qu'au moins une séquence d'impulsions boucle le circuit sans contact fatal ; sinon, re-génère (ou ajuste) — un seed ne produit jamais une spéciale impossible.
6. Checkpoints placés automatiquement le long de la boucle, ordonnés.

## Hors-scope

- Réglage fin « difficulté » de la génération (longueur, technicité) — peut venir en v2 via paramètres.
- Décor/biomes visuels variés — cosmétique futur.

## Impacts par couche

- `domain/` : `trackgen.ts`, `geometry.ts` étendu (validation de boucle), solveur d'accessibilité.
- `data/` : paramètres de génération (largeur min, densité d'obstacles).
- `systems/` : sélection « circuit par seed » dans le flux de course.
- `render/` : aucun changement (rend n'importe quel `Track` — argument de sûreté).
- Tests : `trackgen.test.ts`.

## Critères d'acceptation

- Même seed → circuit **identique** (tilemap, surfaces, obstacles, checkpoints).
- Tout circuit généré est bouclé et terminable (invariant d'accessibilité vérifié sur un large échantillon de seeds).
- Aucun obstacle fatal sur l'unique ligne de course quand elle est contrainte.
- Déterminisme : `generateTrack` est une fonction pure du seed.

## Tests

- `trackgen.test.ts` : reproductibilité par seed ; sur 1000 seeds, 100 % de circuits bouclés et terminables ; densité d'obstacles dans les bornes ; checkpoints ordonnés et sur la piste.

## Risques / questions ouvertes

- Le solveur d'accessibilité est le point dur : une recherche trop coûteuse ralentit la génération. Heuristique (largeur garantie) vs preuve (recherche de chemin) — trancher au plan.
- Qualité « fun » vs validité : un circuit valide peut être ennuyeux. Métriques de technicité (nombre de virages, alternance de surfaces) à définir — à éprouver en jeu.

---
