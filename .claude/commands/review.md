Analyse complète de la feature en cours : conventions, couches, déterminisme, tests, maintenabilité et cohérence — projet Rallye Vecteur.

1. Lis `CLAUDE.md` (conventions + architecture) et, si un PRD est concerné, le fichier `docs/prd-NN-*.md` correspondant.
2. Récupère le périmètre avec `git diff`, `git diff --cached`, `git status` et `git log --oneline -5`.
3. S'il n'y a aucune modification (staged, unstaged ou commits récents non pushés), indique-le et arrête-toi.

## Conventions & couches

4. Vérifie le respect, en particulier :
   - **Direction d'import unique** (`data → domain`, `systems → domain/data`, `render → domain/data/systems`) ; aucun import interdit.
   - `domain/` **pur** (pas de `window`/`document`/canvas/`Date`/`Math.random`).
   - `data/` **inerte** (aucune logique ni branche de gameplay).
   - `render/` **ne décide rien** et **ne mute jamais** `RaceState` ; `systems/` n'écrit l'état que via `domain/`.
   - Immutabilité dans `domain/` ; `Vec2` immuable.
   - Pas de nombre magique : constantes dans `data/tuning.ts` / `cars.ts` / `surfaces.ts` / `modifiers.ts`.
   - Types/identifiants en anglais, commentaires en français ; `strict`, pas de `any`.
   - Pas d'imports inutilisés, constantes mortes, lignes blanches superflues.

## Déterminisme (P5)

5. Vérifie l'invariant central :
   - Tout hasard de gameplay passe par le RNG seedé de `RaceState` (jamais `Math.random()`).
   - L'animation/interpolation ne fuit jamais dans `RaceState`.
   - Un changement de `domain/` est-il prévu par le PRD ? (sinon : alerte sûreté du déterminisme).
   - Le rejeu fantôme re-seede à l'identique (pas de divergence silencieuse).

## Tests

6. Couverture :
   - Chaque comportement ajouté a-t-il un test correspondant dans `test/` ?
   - Toute feature de simulation a-t-elle une assertion de **déterminisme** ?
   - Cas limites collision/géométrie présents (premier contact, ligne fine, sens) ?
   - Tests macro (comportement), pas détails d'implémentation.
7. Lance `npm run lint`, `npm run typecheck`, `npm run test:run` et vérifie qu'ils passent.

## Maintenabilité

8. Analyse :
   - **Couplage** : dépendances circulaires, couplage fort entre fichiers/couches ?
   - **Responsabilité unique** : un système = un fichier à responsabilité claire ?
   - **Duplication** : code à factoriser ?
   - **Complexité** : fonctions trop longues / imbriquées (> 40 lignes, > 3 niveaux) ?
   - **Nommage** : explicite et cohérent avec l'existant ?
   - **Magic values** : valeurs en dur qui devraient être des constantes de `data/` ?

## Cohérence système

9. Vérifie :
   - L'intégration avec le reste (pas d'incohérence de phases `idle/animating/crashed`, de `RaceState`, de flow de tour).
   - Le shape de `RaceState` reste cohérent et prévisible (immutabilité, `readonly`).
   - Les nouvelles fonctions suivent les patterns existants (signatures pures, retours immuables).

## Rapport

10. Produis un rapport structuré :
    - **Conventions & couches** : statut par point (OK / VIOLATION / N/A).
    - **Déterminisme** : statut + risques.
    - **Tests** : résultat lint/typecheck/test:run + couverture manquante.
    - **Maintenabilité** : problèmes avec le code concerné.
    - **Cohérence** : incohérences ou risques.
    - **Verdict** : une phrase + liste d'actions correctives si nécessaire.
