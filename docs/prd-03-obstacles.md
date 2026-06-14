# PRD 03 — Obstacles first-class : arbres, flaques, et au-delà

**Priorité : 1 — Impact ★★ — Effort moyen**

> Dépendances : dépend du PRD 01 | lié au PRD 04.

## Objectif

`TREE` existe dans la table des surfaces (`solid:true`) mais n'est **jamais posé**,
et `WATER` n'est qu'un sol à faible grip. On promeut les obstacles au rang de
contenu de circuit à part entière, extensible (huile, glace, sauts…), pour nourrir
**P4** et le risk/reward de ligne. Le joueur affronte un terrain qui n'est plus
qu'un fond mais un adversaire ponctuel à lire et à éviter.

## Existant technique

- `S.TREE` (solide) et `S.WATER` (grip 0.18) définis dans la table ; `WATER` posé via `paint(11,13,12,14, S.WATER)`. `TREE` = **kind jamais généré**.
- `surfaceAt`/`isSolid` traitent déjà tout solide comme mur (donc un `TREE` posé crasherait — mais rendu et sémantique non distingués du mur).
- `addTexture` a déjà une branche de rendu `TREE` (couronne + tronc) inutilisée.

## Comportement

1. Distinguer **sol** (sous la voiture : grip/drag) et **obstacle** (sur la tuile : solide ou hazard) dans le modèle de tuile, pour superposer un arbre sur de la route.
2. `TREE` posable sur n'importe quelle tuile roulable ; contact = même conséquence que mur (cf. PRD 04 pour nuancer).
3. `WATER` : sol à très faible grip qui conserve la quantité de mouvement (déjà le cas) + drapeau hazard pour de futurs effets visuels (gerbe).
4. Table d'obstacles extensible : ajouter un type = une entrée de données + une branche de rendu, **zéro logique de jeu nouvelle** (preuve d'extensibilité = poser un type `OIL` low-grip en data sans toucher au domaine).
5. Au moins un arbre et une flaque réellement posés sur `track-02` comme contenu de design, pas comme démo.

## Hors-scope

- Obstacles destructibles ou mobiles (barrières, spectateurs) — futur.
- Sauts/tremplins (changement vertical) — futur, nécessite un axe Z dans la simulation.
- Conséquences différenciées au contact (→ PRD 04).

## Impacts par couche

- `domain/` : type `Tile { surface: SurfaceId, obstacle?: ObstacleId }` ; `surfaceAt` distinct de `obstacleAt`.
- `data/` : `obstacles.ts` (table), pose d'obstacles dans `tracks/track-02.ts`.
- `systems/` : collision lit `obstacleAt` (les solides obstacle ET mur déclenchent `firstHit`).
- `render/` : branche `TREE` activée, gerbe d'eau optionnelle (cosmétique).
- Tests : `obstacle.test.ts`, `collision.test.ts` (étendu).

## Critères d'acceptation

- Un arbre posé sur une tuile de route provoque un crash au contact, distinct visuellement du mur.
- Une flaque réduit l'adhérence sans être solide (on la traverse en glissant).
- Ajouter un nouveau type de sol/obstacle ne touche que `data/` + une branche `render/` (revue d'imports).
- Déterminisme : présence d'obstacles → résultat reproductible à seed/inputs égaux.

## Tests

- `obstacle.test.ts` : `obstacleAt` correct ; superposition sol+obstacle ; un type hazard non-solide ne crashe pas.
- `collision.test.ts` : `firstHit` déclenché par obstacle solide au milieu d'une tuile roulable.

## Risques / questions ouvertes

- Granularité : obstacle = tuile entière (simple) ou sous-tuile/forme (plus juste mais plus coûteux) — trancher au plan.
- La flaque doit-elle aussi *freiner* (drag accru) ou seulement *déraper* (grip réduit) ? Réglage à éprouver, lié à **P2**.

---
