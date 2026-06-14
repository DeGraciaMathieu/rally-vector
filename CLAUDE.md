# CLAUDE.md — Rallye Vecteur

Jeu de course de rallye **tour par tour** : à chaque tour, le joueur donne une
**impulsion** (flèche : direction + poussée) qui se combine à l'**inertie**
existante. L'impulsion n'est pas le déplacement — la quantité de mouvement décide.
TS + Vite, architecture en couches strictes, simulation déterministe.

Ce fichier est la source de vérité sur **comment** coder ici. Les PRD (`prd/`)
disent **quoi** construire. En cas de conflit entre un PRD et ce fichier sur une
règle d'architecture ou de déterminisme, **ce fichier gagne** — signale le conflit.

---

## Piliers de design (ils tranchent les arbitrages)

- **P1 — La tension naît de l'inertie.** Le joueur anticipe, ne réagit pas. Ne jamais ajouter d'aide qui *pilote* à sa place.
- **P2 — Risk/reward de la vitesse.** Crash = fin de course par défaut. Le danger fait le sel ; ne pas l'édulcorer sans décision explicite.
- **P3 — Lisibilité de la trajectoire.** L'aide à la visée *montre*, elle ne *corrige* pas. La retirer est le bouton de difficulté.
- **P4 — Maîtrise des surfaces.** `grip`/`drag` par sol créent les lignes de course.
- **P5 — Déterminisme.** Même seed + même séquence d'impulsions → même course. **Invariant central, non négociable.**

---

## Architecture en couches — règle d'import

Une seule direction de dépendance. Une couche ne connaît que les couches à sa gauche.

```
data → domain        (data ne dépend que des TYPES de domain)
domain               (ne dépend de RIEN d'autre)
systems → domain, data
render  → domain, data, systems   (en LECTURE SEULE)
```

| Couche      | Rôle                                                   | Peut importer            | Interdits absolus                                  |
|-------------|--------------------------------------------------------|--------------------------|----------------------------------------------------|
| `domain/`   | Logique pure, déterministe                              | rien                     | `window`, `document`, canvas, `Date`, `Math.random`|
| `data/`     | Tables pures, zéro logique                              | types de `domain/`       | toute fonction à effet, toute branche conditionnelle de gameplay |
| `systems/`  | Orchestration temporelle, I/O, persistance, caméra     | `domain/`, `data/`       | dessiner ; muter l'état autrement que via `domain/`|
| `render/`   | Pixi/canvas : lit l'état, dessine                       | `domain/`, `data/`, `systems/` | **décider quoi que ce soit** ; écrire dans l'état |

**`render/` ne décide rien.** Il lit `RaceState` et dessine. Toute condition de
jeu (la voiture dérape-t-elle ? le contact est-il fatal ?) est calculée dans
`domain/` et exposée dans l'état ; `render/` ne fait que la visualiser. Si tu te
surprends à écrire une règle de jeu dans `render/`, c'est qu'elle va dans `domain/`.

Le moteur de rendu (canvas 2D aujourd'hui, peut-être Pixi demain) est un détail
caché derrière cette frontière : on doit pouvoir le remplacer sans toucher aux
trois autres couches.

---

## Modèle de simulation

- La simulation avance par **tours discrets**. Un tour = une impulsion validée.
- Le cœur est une **fonction pure** :
  ```ts
  step(state: RaceState, impulse: Vec2, car: Car): RaceState
  ```
  Pas de mutation en place, pas d'effet de bord, pas d'horloge, pas de hasard non seedé.
- L'**animation** entre deux tours (interpolation, easing) appartient à `render/`
  et **n'influence jamais l'état**. Le « fixed-step » de ce jeu, c'est le tour,
  pas un `dt` physique.
- Tout hasard de gameplay passe par le **RNG seedé** porté dans `RaceState`
  (ex. tête-à-queue du PRD 04). Jamais `Math.random()`.

---

## Invariants non négociables

1. **Déterminisme (P5).** `(seed, carId, trackId, séquence d'impulsions)` → course identique, bit pour bit au niveau `RaceState`. C'est ce qui fait marcher les fantômes (PRD 06) et les tests.
2. **`domain/` est pur.** Aucun accès DOM, horloge ou aléatoire global. Vérifiable par règle d'import lint.
3. **`render/` ne mute jamais l'état.**
4. **Crash = fin** reste le comportement par défaut (P2). Toute nuance (PRD 04) est opt-in et derrière un réglage.
5. **`data/` est inerte.** Si une « donnée » contient une décision, elle est mal placée.

---

## Conventions de code

- TypeScript `strict`. Pas de `any` ; préférer des types `domain/` explicites (`Vec2`, `Surface`, `CarState`, `RaceState`, `Track`).
- **Immutabilité dans `domain/`** : les fonctions retournent de nouveaux objets, ne mutent pas leurs arguments. `Vec2` est immuable (`add`, `scale`… renvoient un nouveau vecteur).
- Pas de nombre magique dans la logique : toute constante d'équilibrage vit dans `data/tuning.ts` ou la table concernée (`surfaces.ts`, `cars.ts`).
- Nommage : types et identifiants en anglais, commentaires et messages en français.
- Une couche = un dossier ; un système = un fichier à responsabilité unique (`lap.ts`, `camera.ts`, `ghost.ts`…).
- Pas de dépendance lourde sans raison ; le `domain/` reste sans dépendance externe.

---

## Tests (vitest)

- On teste `domain/`, `data/` et `systems/` **sans rendu**. `render/` n'est pas testé unitairement ; il est couvert par le critère de non-régression (état inchangé effets on/off).
- **Test de déterminisme systématique** pour toute feature touchant la simulation :
  ```ts
  // même seed + mêmes inputs → même suite d'états
  expect(run(seed, inputs)).toEqual(run(seed, inputs));
  ```
- Cas limites obligatoires côté collision/géométrie : premier contact, hors-grille = solide, segment qui « saute » par-dessus une ligne fine, franchissement dans le bon sens uniquement.
- Pour un **refacto** (ex. PRD 00) : critère « comportement identique » — la suite existante reste verte et l'état produit est inchangé.

---

## Commandes

```bash
npm run dev        # Vite, serveur de dev
npm run build      # build de prod
npm run test       # vitest (watch)
npm run test:run   # vitest une passe (CI)
npm run lint       # ESLint, dont la règle de direction d'import entre couches
npm run typecheck  # tsc --noEmit
```

Avant de considérer une tâche terminée : `lint`, `typecheck` et `test:run` passent.

---

## Structure des dossiers

```
src/
  domain/     vec2, surfaces (types), physics (step), collision, geometry, rng, gameState, trackgen
  data/       tuning, surfaces (table), cars, obstacles, tracks/, difficulty
  systems/    simulation, input, lap, camera, recorder, ghost, storage, audio
  render/     canvasRenderer, effects
  main.ts     composition root (câble systems + render)
test/         *.test.ts (miroir de src/)
prd/          les PRD numérotés + 00-conventions
CLAUDE.md
```

---

## Workflow PRD

1. Lire `prd/00-conventions.md` puis le PRD ciblé. Respecter sa section **Impacts par couche** : si elle dit « `domain/` : aucun changement », ne touche pas au domaine — c'est un argument de sûreté du déterminisme.
2. Ne pas déborder du **Hors-scope** : les généralisations tentantes ont déjà leur PRD.
3. Implémenter de bas en haut : `domain/` (+ tests) → `data/` → `systems/` (+ tests) → `render/`.
4. Les **questions ouvertes** du PRD ne se tranchent pas en silence : si une décision s'impose, l'exposer et proposer, ne pas choisir seul.

## Définition de « terminé »

- Les **critères d'acceptation** du PRD sont tous vérifiés.
- `lint` + `typecheck` + `test:run` verts.
- Règles de couches respectées (aucun import interdit).
- Invariant de déterminisme préservé (test présent et vert).
- Aucun changement de `domain/` non prévu par le PRD.

---

## Pièges connus

- **Mettre une décision dans `render/`** (ex. décider du dérapage pour afficher une trace). Non : la condition vient de `domain/`, `render/` ne fait que la lire.
- **Sauter une ligne fine à grande vitesse** : la détection de franchissement doit être une **intersection de segments**, pas un test de zone (le déplacement d'un tour est un segment droit potentiellement long).
- **Hasard non seedé** : tout `Math.random` casse P5 et les fantômes. Passer par le RNG de `RaceState`.
- **RNG et rejeu** (PRD 04 ↔ 06) : un tête-à-queue seedé doit être re-seedé à l'identique au rejeu, sinon le fantôme diverge silencieusement.
- **Animation qui fuit dans l'état** : l'interpolation visuelle ne doit jamais modifier `RaceState`.