# PRD 04 — Modèle de conséquences au contact (crash vs perte de contrôle)

**Priorité : 1 — Impact ★★★ — Effort moyen**

> Dépendances : dépend des PRD 00, 03.

## Objectif

Aujourd'hui tout contact solide = fin de course (règle voulue à l'origine). On
introduit une **taxonomie des conséquences** pour ouvrir un espace tactique sans
trahir **P2** : un mur ou un arbre reste fatal, mais certains contacts mineurs
(frôler la sortie de piste, mordre le gravier hors-tracé) pourraient coûter une
perte de contrôle plutôt qu'un game over. Le joueur ressent une gradation du
risque au lieu d'un couperet unique — **à valider en jeu**, car c'est le pilier de
tension qu'on touche.

## Existant technique

- `commit()` calcule le segment, `Physics.firstHit` renvoie le premier solide, `finishMove` passe en `crashed` si `anim.crash`.
- État `crashed` terminal, bannière de fin, `vel` remis à zéro.
- Une seule conséquence possible : fin de course.

## Comportement

1. Type `Contact { kind: 'fatal' | 'spin' | 'graze' }` renvoyé par la résolution de collision, dérivé de l'obstacle/surface touché et de la **vitesse à l'impact**.
2. `fatal` (mur, arbre, ou impact au-dessus d'un seuil de vitesse) → `crashed` (comportement actuel, inchangé par défaut).
3. `spin` (option) : sous un seuil de vitesse, le contact provoque un arrêt + réorientation aléatoire **seedée** (consomme le RNG de course — premier vrai usage de **P5** côté gameplay) plutôt que la fin.
4. `graze` (option) : frôlement = perte de vitesse sans arrêt.
5. Valeur d'équilibrage de départ : seuil `fatal` à ~70 % de `maxSpeed` ; en deçà sur sol non-mur, `spin`. Murs et arbres toujours `fatal`.
6. Le mode « crash = fin systématique » reste sélectionnable (préserve la version d'origine, lien PRD 10).

## Hors-scope

- Système de dégâts progressifs / santé du véhicule — futur, change la nature du jeu.
- Réparations, stands — futur.

## Impacts par couche

- `domain/` : `collision.ts` renvoie un `Contact` ; `gameState` gère les transitions `spin`/`graze`/`crashed`.
- `data/` : seuils dans `tuning.ts` ; mapping surface/obstacle → conséquence.
- `systems/` : `simulation.ts` applique la conséquence (le `spin` tire du RNG de course).
- `render/` : feedback distinct (bannière fatale vs tête-à-queue) — cosmétique.
- Tests : `collision.test.ts`, `simulation.test.ts`.

## Critères d'acceptation

- Mur et arbre = fin de course, sans condition (régression interdite).
- Un contact lent sur sol meuble (mode activé) ne tue pas mais coûte le contrôle.
- Mode « tout crash = fin » reproduit exactement le comportement actuel.
- Déterminisme : un `spin` est reproductible (même seed + mêmes inputs → même réorientation).

## Tests

- `collision.test.ts` : classification `fatal`/`spin`/`graze` selon vitesse et cible.
- `simulation.test.ts` : `spin` consomme le RNG de façon déterministe ; mode strict = toujours `fatal`.

## Risques / questions ouvertes

- **Décision de design non tranchée** : introduire le `spin` peut diluer la tension de **P2** (le couperet fait le sel du jeu). À garder optionnel et à éprouver — ne pas choisir seul.
- Réorientation d'un tête-à-queue : aléatoire seedé vs déterministe par l'angle d'impact — trancher au plan.

---
