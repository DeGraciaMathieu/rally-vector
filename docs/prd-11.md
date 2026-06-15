# PRD 11 — Geste de visée : pliage de trajectoire

**Priorité : 1 — Impact ★★★ — Effort moyen**

> Dépendances : dépend des PRD 00 (couches/déterminisme) et 01 (grip de surface via les circuits). **Révise la couche input établie au PRD 00.** Interagit avec le PRD 06 (compatibilité préservée), et avec les PRD 08 / 10 (rendu de la poignée et palier d'aide).

## Objectif

Aujourd'hui on tire une flèche de poussée depuis la voiture, on regarde le fantôme
vert/rouge, on ajuste jusqu'à ce que ce soit vert, on valide : le tour est un puzzle
qu'on résout au lieu d'un geste qu'on engage. On remplace la métaphore « pousser une
force » par « **plier la trajectoire** » : le jeu affiche le vecteur vitesse (là où
l'inertie t'emmène), tu **attrapes son bout** et tu le tires où tu veux finir ; le
grip **clampe** à quel point tu peux le plier. Sert directement **P1** — l'inertie
n'est plus une info à lire, c'est une résistance qu'on sent dans le geste — et **P3**,
puisque la zone atteignable *est* l'aide. Le joueur ressent : « je négocie avec
l'inertie au lieu de la calculer ».

## Existant technique

- `aimAt(p)` (proto) : `impulse = clamp(p - carPos, maxImpulse)`. La flèche dessinée = l'impulsion (l'ordre), le fantôme = le résultat via `Physics.step`.
- `commit()` lit `impulse`, appelle `Physics.step(vel, impulse, surf)`, anime, détecte le crash. `drawAimAndGhost` dessine flèche d'impulsion + trajectoire prévue + réticule + roue libre.
- `Physics.step` : `v' = (v + impulse·grip)·(1 - drag)`, avec `angleGripLoss` qui réduit le grip quand l'impulsion s'oppose à la vitesse à haute vitesse.
- Validation : aujourd'hui via bouton/`Espace` ; le relâcher du pointeur ne valide pas.
- Post PRD 00, ces rôles vivent dans `systems/input.ts`, `domain/physics.ts`, `render/`.

**Propriété clef à exploiter** : avec `|impulse| ≤ maxImpulse`, l'endpoint atteignable
`pos + (v + impulse·grip)(1-drag)` décrit un **disque** centré sur l'endpoint de roue
libre `pos + v(1-drag)`, de rayon `maxImpulse · grip · (1-drag)`. Le grip est donc
littéralement le rayon de ce qu'on peut plier. Rien à inventer côté physique.

## Comportement

1. **Poignée et vecteur vitesse.** En début de tour, afficher depuis la voiture le vecteur vitesse (sa pointe = endpoint de roue libre) avec une **poignée** saisissable à son bout. À l'arrêt (`v≈0`), la poignée est sur la voiture : la tirer crée la première impulsion (équivalent du modèle actuel, pas de cas particulier à apprendre).
2. **Saisir → tirer → lâcher.** Pointer-down sur/près de la poignée = saisie ; drag = déplace l'endpoint cible (le fantôme, le vecteur résultant et la zone atteignable se mettent à jour en direct) ; **release = valide et anime**. `Espace`/bouton restent une validation alternative (accessibilité, joueurs qui délibèrent).
3. **Zone morte d'annulation.** Relâcher à moins de `cancelRadius` de la voiture = roue libre (impulsion nulle). Un geste d'annulation explicite (`Échap` / relâcher hors cadre) **n'consomme pas le tour**. Anti-commit accidentel au doigt.
4. **Zone atteignable = inertie tangible.** Clamper la cible dans le **disque** centré sur l'endpoint de roue libre, rayon `maxImpulse · grip · (1-drag)` (grip = surface × voiture). Petit sur gravier, large sur route. Rendu comme une aide (palier du PRD 10) ; même masqué, le clamp s'applique (« l'aide montre, ne pilote pas »).
5. **Freinage lisible.** Tirer la poignée **vers** la voiture raccourcit `v'` : la trajectoire passe en couleur « frein » dès que la composante demandée s'oppose à la vitesse. Résout le faux problème actuel (on peut déjà décélérer, mais ça ne se voit pas).
6. **Mapping pur cible → impulsion.** Fonction `solveImpulse(state, target, car)` dans le domaine :
   `impulse = ((target - pos) - v·(1-drag)) / (grip·(1-drag))`, le clamp découlant du clamp de `target` dans le disque (donc `|impulse| ≤ maxImpulse` garanti). Le résultat est passé **tel quel** à `step` inchangé.
7. **(Coûteux, optionnel) Zone atteignable anisotrope.** Remplacer le disque par une **ellipse** alignée sur la vitesse : autorité longitudinale (accélérer/freiner) ≠ latérale (tourner), la latérale chutant avec la vitesse. Plus « rallye », mais solve non linéaire et re-tuning → laissé en question ouverte, pas activé par défaut.

## Hors-scope

- Refonte de la formule de `step` : on la garde. B ne change que la **production** de l'impulsion, pas la physique. L'ellipse anisotrope (point 7), si retenue, fera l'objet d'une itération dédiée.
- Frein à main / second verbe dédié (potentiel PRD séparé — c'est une mécanique, pas du geste).
- Mapping manette / directionnel riche : la poignée est pensée pointeur/tactile d'abord ; clavier minimal seulement.
- Changement de l'enregistrement fantôme (PRD 06) : **aucun** — l'artefact reste l'impulsion (voir Critères).

## Impacts par couche

- `domain/` : `physics.ts` gagne `solveImpulse(state, target, car)` et `reachableRadius(state, car)` (purs). **`step` inchangé** — argument de sûreté du déterminisme et de la non-régression. `geometry.ts` : clamp d'un point dans un disque (et plus tard une ellipse).
- `data/` : `tuning.ts` — `cancelRadius`, seuil de déplacement minimal avant commit ; (option) coefficients d'anisotropie. Rien sur `surfaces.ts` (le grip existe déjà).
- `systems/` : `input.ts` réécrit autour de la poignée (états saisie/drag/release/cancel) ; produit la cible → `solveImpulse` → impulsion. `simulation.ts` : release = `commit`.
- `render/` : `drawAimAndGhost` dessine poignée, vecteur vitesse, disque atteignable, couleur de frein ; respecte le palier d'aide du PRD 10.
- Tests : `physics.test.ts`, `input.test.ts`, plus un test de non-régression A↔B.

## Critères d'acceptation

- Round-trip cohérent : pour une cible donnée, `solveImpulse` puis `step` produit un endpoint **égal à la cible clampée** dans le disque.
- Le rayon de la zone atteignable croît avec le grip (gravier < route < voiture adhérente), vérifiable numériquement.
- Relâcher dans la zone morte = roue libre, sans commit accidentel ; l'annulation ne consomme pas de tour.
- **Non-régression physique** : pour une impulsion finale donnée, le modèle B produit exactement le même `RaceState` que le modèle A (puisque `step` est inchangé). Suite de tests existante verte.
- Déterminisme : même seed + même séquence de **cibles** → mêmes impulsions → même course ; l'enregistrement fantôme (impulsions) reste rejouable à l'identique.

## Tests

- `physics.test.ts` : `solveImpulse` inverse bien `step` (cible → impulsion → `step` → endpoint = cible clampée) ; `reachableRadius == maxImpulse·grip·(1-drag)` ; clamp respecte `|impulse| ≤ maxImpulse` ; cas `v≈0` (poignée sur la voiture).
- `input.test.ts` : saisie de poignée, clamp de cible dans le disque, zone morte → impulsion nulle, annulation → tour non consommé, release → commit, seuil de déplacement minimal respecté.
- `regression.test.ts` : un scénario joué en A et en B avec impulsions finales identiques → suites de `RaceState` identiques ; un fantôme enregistré avant la bascule B se rejoue à l'identique.

## Risques / questions ouvertes

- **Disque (grip constant) vs ellipse anisotrope** : à trancher en jeu. Le disque est sûr et réutilise tout le tuning existant ; l'ellipse est plus « rallye » mais non linéaire et impose un re-équilibrage. Recommandation : livrer le disque, prototyper l'ellipse derrière un flag — ne pas choisir seul.
- **`angleGripLoss`** : conservé dans `step`, il rend le disque légèrement non circulaire (le rayon réel dépend de la direction de l'impulsion). Décider : le **neutraliser sous le modèle B** (c'est alors le clamp/l'ellipse qui porte l'anisotropie) ou l'absorber dans l'ellipse. Ne jamais laisser les deux agir en double — sinon l'inertie est comptée deux fois.
- **Lisibilité de la poignée à `v≈0`** : quand la voiture est presque à l'arrêt, la poignée se confond avec la zone morte d'annulation. Définir sans ambiguïté le geste de démarrage (tirer depuis le centre) vs l'annulation.
- **Commit accidentel au doigt** : éprouver `cancelRadius` et le seuil de déplacement avant qu'un tap ne soit interprété comme un mini-pli ; mobile prioritaire (le joueur joue au doigt).
- **Couplage avec le PRD 10** : le disque atteignable est une aide forte. En mode Pro on le masque, mais le clamp reste actif (cohérent avec P3). Valider que masquer l'aide ne masque pas le *retour de freinage* nécessaire à la lisibilité de base.