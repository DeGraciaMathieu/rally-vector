# Rallye Vecteur — Backlog PRD

Document de cadrage destiné à être donné à Claude Code, PRD par PRD. Le proto
actuel est un fichier HTML unique (`rallye-vecteur.html`) sans build, sans types,
sans tests. Le **PRD 00** transforme ce proto en projet TS/Vite en couches ; tous
les PRD suivants référencent les modules issus de ce portage.

---

## Piliers de design (référence transverse)

- **P1 — La tension naît de l'inertie.** L'impulsion n'est pas le déplacement ; la
  quantité de mouvement décide. Le joueur anticipe au lieu de réagir.
- **P2 — Risk/reward de la vitesse portée.** Vite = chrono, mais lignes plus larges
  et crash = fin. Chaque poussée est un pari.
- **P3 — Lisibilité de la trajectoire.** Le fantôme rend l'inertie lisible ;
  le retirer est le bouton de difficulté.
- **P4 — Maîtrise des surfaces.** `grip`/`drag` par sol créent des lignes de course ;
  le terrain est un adversaire.
- **P5 — Déterminisme.** Même seed + même séquence d'impulsions → même course.
  Socle des fantômes, des chronos et des tests.

## Conventions d'architecture (à graver dans `CLAUDE.md`, produit par le PRD 00)

- **`domain/`** — logique pure, déterministe, zéro DOM/Pixi : maths vecteurs,
  `Surface`, `CarState`, `step()`, détection de collision, RNG seedé.
- **`data/`** — tables pures, aucune logique : `tuning.ts`, `surfaces.ts`,
  `tracks/*.ts`, `cars.ts`.
- **`systems/`** — orchestration temporelle et I/O : driver de simulation,
  input→impulsion, suivi tours/checkpoints, fantôme, persistance, caméra.
  Mute l'état **uniquement** via le domaine.
- **`render/`** — Pixi/canvas : lit l'état, dessine, **ne décide rien**.
  L'interpolation entre tours est cosmétique.
- **Tests** — vitest sur `domain/`, `data/`, `systems/` sans rendu.

## Modèle de simulation (rappel)

La simulation avance par **tours discrets** : un tour = une impulsion validée.
`step(state, impulse, car) → state'` est une fonction pure. Le déterminisme est à
la granularité du tour ; l'animation entre deux tours appartient à `render/` et
n'influence jamais l'état. Le « fixed-step » de ce jeu, c'est le tour, pas un `dt`
physique.

---
