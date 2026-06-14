# PRD 10 — Modes de difficulté et calibrage de l'aide à la visée

**Priorité : 2 — Impact ★★ — Effort faible**

> Dépendances : dépend des PRD 00, 08 (rendu de l'aide).

## Objectif

L'aide à la visée est, par conception, le **bouton de difficulté** (**P3**). On la
formalise en paliers et on regroupe les options de difficulté (conséquences de
contact du PRD 04, présence du fantôme, assistance) en profils cohérents. Le joueur
choisit son niveau d'exigence : du fantôme complet qui enseigne l'inertie au
pilotage « à l'aveugle » où il faut l'avoir intégrée.

## Existant technique

- `showAid` booléen (bouton + touche `A`) : montre/masque la trajectoire prévue, le réticule et la continuation en roue libre ; la flèche d'impulsion reste toujours visible.
- `drawAimAndGhost` calcule déjà : trajectoire réelle (verte/rouge), réticule, 2 tours de roue libre.

## Comportement

1. Trois paliers d'aide : **complète** (trajectoire + réticule + roue libre, état actuel) ; **point d'arrivée seul** (réticule, sans le tracé ni la projection) ; **aucune** (seule la flèche d'impulsion).
2. Profils de difficulté regroupant : palier d'aide + mode de conséquence de contact (PRD 04 : strict « crash = fin » vs nuancé) + fantôme on/off.
3. Profils proposés : *Découverte* (aide complète, contacts nuancés), *Spéciale* (point d'arrivée, crash = fin), *Pro* (aucune aide, crash = fin).
4. Le réglage est lisible et changeable hors course ; il n'affecte que l'affichage et les règles de contact, **jamais** la physique de base (une même impulsion produit la même trajectoire quel que soit le palier d'aide).
5. Persistance du profil choisi (localStorage, cf. PRD 06 `storage.ts`).

## Hors-scope

- Aides de conduite « actives » (correction de trajectoire automatique) — contraire à **P1**, exclu.
- Difficulté adaptative dynamique — futur.

## Impacts par couche

- `domain/` : aucun changement de physique (l'aide est en lecture seule ; argument de sûreté pour **P3**).
- `data/` : table des profils de difficulté.
- `systems/` : application du profil (sélection du mode de contact, du fantôme), persistance.
- `render/` : `drawAimAndGhost` respecte le palier d'aide.
- Tests : `difficulty.test.ts`.

## Critères d'acceptation

- À impulsion égale, la trajectoire réelle est identique quel que soit le palier d'aide (l'aide n'aide qu'à *voir*, pas à *piloter*).
- Le mode *Pro* n'affiche que la flèche d'impulsion ; aucune projection.
- Le profil choisi survit au rechargement.
- Déterminisme : le profil n'altère pas `RaceState` (hors règles de contact explicitement choisies).

## Tests

- `difficulty.test.ts` : chaque profil mappe les bons réglages ; le palier d'aide ne modifie pas la physique (même `step` en sortie).

## Risques / questions ouvertes

- Nommage des profils (parlant pour un public rallye sans jargon) — à affiner.
- Le palier « point d'arrivée seul » est-il un vrai cran intermédiaire ou un entre-deux mou ? — à éprouver en jeu.
