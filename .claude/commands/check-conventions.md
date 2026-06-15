Analyse les modifications en cours par rapport aux conventions du projet Rallye Vecteur.

1. Lis le fichier `CLAUDE.md` à la racine pour charger les conventions et l'architecture.
2. Récupère les modifications avec `git diff`, `git diff --cached` et `git status` (fichiers non suivis inclus).
3. S'il n'y a aucune modification, indique-le et arrête-toi.
4. Pour chaque convention du CLAUDE.md, vérifie le respect. En particulier :
   - **Règle de couches** : direction d'import unique (`data → domain`, `systems → domain/data`, `render → domain/data/systems`). Aucun import interdit.
   - `domain/` reste **pur** : pas de `window`, `document`, canvas, `Date`, `Math.random`.
   - `data/` reste **inerte** : tables pures, aucune fonction à effet, aucune branche conditionnelle de gameplay.
   - `render/` **ne décide rien** et **ne mute jamais** `RaceState` : il lit et dessine.
   - `systems/` n'écrit l'état que via `domain/` ; ne dessine pas.
   - **Immutabilité** dans `domain/` : retours de nouveaux objets, pas de mutation d'arguments ; `Vec2` immuable.
   - **Pas de nombre magique** dans la logique : constantes d'équilibrage dans `data/tuning.ts`, `cars.ts`, `surfaces.ts`, `modifiers.ts`.
   - **Hasard seedé** uniquement : tout aléatoire passe par le RNG de `RaceState`, jamais `Math.random()`.
   - **Animation** : l'interpolation visuelle (`systems/render`) ne modifie jamais `RaceState`.
   - **Géométrie de franchissement** : intersection de segments, pas test de zone.
   - TypeScript `strict`, pas de `any` ; types/identifiants en anglais, commentaires en français.
   - Bon fichier modifié selon le type de changement (cf. skill `architecture`).
   - Pas d'imports inutilisés, constantes mortes ou lignes blanches superflues.
5. Cohérence simulation :
   - Toute feature touchant la simulation a-t-elle un test de déterminisme à jour ?
   - Un changement de `domain/` était-il prévu par le PRD concerné (sinon : alerte) ?
6. Lance `npm run lint`, `npm run typecheck` et `npm run test:run` ; vérifie qu'ils passent.
7. Produis un rapport concis :
   - Liste chaque convention vérifiée avec un statut (OK / VIOLATION / N/A).
   - Détaille les violations avec le code concerné.
   - Indique le résultat de lint / typecheck / test:run.
   - Termine par un verdict global.
