# Rallye Vecteur

Jeu de course de rallye **tour par tour** : à chaque tour, le joueur donne une
**impulsion** (flèche : direction + poussée) qui se combine à l'**inertie**
existante. L'impulsion n'est pas le déplacement — la quantité de mouvement décide.

**Ce fichier dit _comment_ travailler ici. Les PRD (`docs/prd-*.md`) disent _quoi_
construire.** En cas de conflit sur une loi d'architecture ou de déterminisme,
**ce fichier gagne** — signale le conflit, ne le tranche pas en silence. Le détail
de chaque domaine vit dans les **skills** (auto-invoqués), pas ici.

## Piliers de design (ils tranchent les arbitrages)

- **P1 — La tension naît de l'inertie.** Le joueur anticipe, ne réagit pas. Aucune aide qui *pilote* à sa place.
- **P2 — Risk/reward de la vitesse.** Crash = fin de course par défaut. Toute nuance est opt-in derrière un réglage.
- **P3 — Lisibilité de la trajectoire.** L'aide à la visée *montre*, ne *corrige* pas.
- **P4 — Maîtrise des surfaces.** `grip`/`drag` par sol créent les lignes de course.
- **P5 — Déterminisme.** Même seed + même séquence d'impulsions → même course. **Invariant central, non négociable.**

## Lois non négociables (priment sur tout PRD)

1. **Déterminisme.** `(seed, carId, trackId, impulsions)` → course identique. Tout hasard passe par le RNG seedé de `RaceState`, jamais `Math.random()`. *(détail : skill `simulation`)*
2. **Direction d'import unique** entre couches `data → domain → systems → render`. `domain/` pur, `data/` inerte, `render/` ne décide rien et ne mute jamais l'état. Vérifié par `npm run lint`. *(détail : skill `architecture`)*
3. **L'animation n'influence jamais l'état.** L'interpolation visuelle vit dans `systems/render`. *(détail : skill `simulation`)*
4. **Crash = fin** reste le défaut (P2) ; toute nuance est derrière un réglage.

## Workflow

1. Lire `docs/prd-00-fondation-ts-vite.md` puis le PRD ciblé. Respecter sa section **Impacts par couche** : « `domain/` : aucun changement » est un argument de sûreté, pas une suggestion.
2. Ne pas déborder du **Hors-scope** : les généralisations tentantes ont déjà leur PRD.
3. Implémenter **de bas en haut** : `domain/` (+ tests) → `data/` → `systems/` (+ tests) → `render/`.
4. Les **questions ouvertes** d'un PRD ne se tranchent pas seul : exposer et proposer.

Commandes projet : `/create-prd` (rédiger un PRD), `/prd` (l'implémenter),
`/review` (revue complète), `/check-tests` (couverture).

## « Terminé » signifie

- Tous les **critères d'acceptation** du PRD vérifiés.
- `npm run lint` + `npm run typecheck` + `npm run test:run` verts.
- Aucun import interdit ; aucun changement de `domain/` non prévu par le PRD.
- Invariant de déterminisme préservé (test présent et vert).

## Comportement

- Si une approche échoue après 2 tentatives, prendre du recul et repenser le plan avant de continuer.
- Ne jamais déclarer une tâche terminée sans avoir lancé les tests et vérifié qu'ils passent.

## Commandes

```bash
npm run dev        # Vite, serveur de dev
npm run build      # build de prod
npm run test       # Vitest (watch)
npm run test:run   # Vitest une passe (CI)
npm run lint       # ESLint, dont la règle de direction d'import entre couches
npm run typecheck  # tsc --noEmit
```

## Skills disponibles

- `architecture` — couches, règle d'import, où placer du code
- `surfaces` — sols (grip/drag/contact), obstacles, franchissement
- `cars` — caractéristiques voiture, physique impulsion×inertie, modificateurs de tour
- `simulation` — boucle de tour, phases, RNG seedé, dispersion, conséquences de contact, fantôme
- `testing` — déterminisme, fichiers de test, où placer un test
- `prd` — workflow complet pour implémenter un PRD ou une feature
