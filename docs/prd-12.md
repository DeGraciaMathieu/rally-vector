# PRD 12 — Dispersion seedée de l'impulsion (cône d'incertitude)

**Priorité : 1 — Impact ★★★ — Effort moyen**

> Dépendances : dépend du PRD 00 (RNG seedé / déterminisme). Interagit avec les PRD 06 (rejeu fantôme), 10 (paliers d'aide), 11 (pliage de trajectoire). Autonome : ne requiert pas le PRD 11.

## Objectif

Le tour est aujourd'hui un puzzle déjà résolu : l'aide montre exactement où on finit,
on ajuste jusqu'au vert, on valide. Zéro risque pris = zéro tension. On rend l'impulsion
**imparfaite** : un bruit seedé s'y ajoute, dont l'amplitude grossit avec la vitesse et
sur les sols à faible grip. Porter de la vitesse devient un **pari** au lieu d'un calcul
(**P2**), et l'aide cesse d'être une réponse : elle devient un **cône** d'incertitude
qu'on apprend à lire (**P3**). C'est aussi le premier usage réel du RNG de course (**P5**).
Le joueur ressent : « à cette vitesse, sur ce gravier, je ne peux plus viser au pixel —
je dois laisser de la marge. »

## Existant technique

- `commit()` lit `impulse` et appelle `Physics.step(vel, impulse, surf)` ; `drawAimAndGhost` trace une **ligne nette** verte/rouge (résultat exact) + réticule.
- `Physics.firstHit` pour la collision ; `surf.grip` par surface ; `TUNING.maxSpeed`.
- Post PRD 00 : `domain/rng.ts` (RNG seedé) **présent dans `RaceState` mais jamais consommé par le gameplay** — exactement le point d'accroche « scaffoldé, jamais interprété » que cette feature active.
- Aucune variance aujourd'hui : `step` est strictement déterministe au sens « impulsion → résultat unique ».

## Comportement

1. Après validation, l'impulsion **voulue** est perturbée par un tirage du RNG de course avant d'entrer dans `step`. L'impulsion **appliquée** = voulue + bruit borné.
2. Le bruit est un **cône angulaire** (rotation aléatoire de l'impulsion) avec un léger jitter de magnitude. Demi-angle : `coneHalf = base + kV·(speed/maxSpeed) + kSurf·(1 - grip)`. **Borné** : aucun tir possible hors du cône.
3. L'aide n'affiche plus une ligne mais un **secteur** couvrant l'éventail des arrivées possibles (bords du cône échantillonnés via `step`), coloré rouge dès qu'une partie du secteur touche un solide (`firstHit`). Le cône *est* l'aide dégradée par la vitesse — il se resserre à basse vitesse, s'ouvre quand on fonce.
4. Valeurs de départ : `base ≈ 2°`, `kV` → +~12° à vitesse max, `kSurf` → +~8° sur gravier/eau ; jitter de magnitude ±8 %. (tunables)
5. **Cohérence rejeu** : le recorder (PRD 06) enregistre l'**impulsion voulue** ; le bruit est re-tiré du même seed au même index de tour → fantôme strictement identique. Rien à changer dans le format d'enregistrement.
6. (option) Le palier d'aide (PRD 10) module l'affichage : secteur complet / arrivée médiane seule / rien — mais **le bruit s'applique toujours**, masqué ou non (« l'aide montre, ne pilote pas »).

## Hors-scope

- **Aide rationnée** (N aperçus par spéciale, aperçu coûteux) : levier distinct → PRD 10 ou PRD dédié.
- **Dispersion dépendant de la voiture** (stat de « stabilité ») → viendra avec le PRD 05.
- **Fusion avec le pliage** (PRD 11) : l'interaction est décrite, mais ce PRD reste autonome sur le modèle actuel.

## Impacts par couche

- `domain/` : `dispersion.ts` — `perturb(impulse, state, car, rng) → impulse`, pur, consomme le RNG porté par l'état. **`step` inchangé** (il reçoit l'impulsion déjà perturbée) — argument de sûreté.
- `data/` : `tuning.ts` — `coneBase`, `kV`, `kSurf`, `magJitter`.
- `systems/` : `simulation.ts` — entre `commit` et `step`, appliquer `perturb` en tirant du RNG de course (ordre de tirage fixé, cf. Risques).
- `render/` : `drawAimAndGhost` → secteur d'incertitude (échantillonnage de N trajectoires via `step`), code couleur vert/rouge.
- Tests : `dispersion.test.ts`, non-régression `step`/`ghost`.

## Critères d'acceptation

- Le tir effectif reste **toujours dans le cône affiché** : borne dure, aucun résultat hors enveloppe (condition de fairness).
- À vitesse nulle, cône ≈ `base` (quasi déterministe) ; il s'élargit de façon monotone avec la vitesse et avec la baisse de grip.
- Le RNG de course est consommé un **nombre déterministe de fois par tour** (pas de désynchronisation possible).
- Déterminisme : même seed + mêmes impulsions voulues → mêmes perturbations → même course ; le fantôme (PRD 06) se rejoue à l'identique.

## Tests

- `dispersion.test.ts` : bornes du cône (rien hors enveloppe) ; croissance monotone avec vitesse et avec `(1-grip)` ; reproductibilité par seed ; nombre de tirages RNG par tour constant.
- `regression` : suite `step`/`lap`/`ghost` verte ; un run rejoué depuis ses impulsions voulues = identique.

## Risques / questions ouvertes

- **Fun vs frustration** : c'est LA variable incertaine du lot (d'où l'intérêt de prototyper d'abord). Le cône honnête est la condition de fairness — le joueur doit toujours *voir* qu'il gamble. À éprouver en jeu ; garder un mode « dispersion off » (lien PRD 10) pour comparer.
- **Distribution** : uniforme dans le cône (borne nette, simple) vs gaussienne tronquée (plus naturelle, queue coupée). Trancher au plan.
- **Ordre de consommation du RNG** : si d'autres systèmes seedés s'ajoutent (le `spin` du PRD 04, les mods du PRD 13), fixer une **convention d'ordre de tirage par tour** pour ne pas désynchroniser les rejeux.
- **Couplage médailles / poursuivant** : la dispersion ajoute de la variance aux chronos. Vérifier qu'elle ne rend pas les médailles (futur) trop aléatoires — sinon plafonner le cône ou l'atténuer en mode chrono.
- **Interaction PRD 11** : si le pliage est en place, le bruit s'applique à l'impulsion pliée → la pointe de la trajectoire devient une **zone floue** au lieu d'un point. Décider si le cône remplace ou se superpose au disque atteignable.