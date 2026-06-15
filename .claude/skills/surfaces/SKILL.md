---
name: surfaces
description: Use when modifying surfaces, grip/drag, obstacles, contact policy, or adding a new ground type in the rally-vector project
auto_invoke: true
---

# Surfaces & contact — Rallye Vecteur

**P4 — Maîtrise des surfaces.** `grip`/`drag` par sol créent les lignes de course.
**P2 — Risk/reward.** Crash = fin de course par défaut ; toute nuance est opt-in.

## Anatomie d'une surface (`domain/surfaces.ts` → table `data/surfaces.ts`)

| Champ      | Rôle |
|------------|------|
| `id`       | identifiant ouvert (string) — ajouter un sol = une entrée de données |
| `label`    | nom affiché |
| `solid`    | `true` = mur/hors-piste, heurté → contact |
| `contact`  | `ContactPolicy` si solide heurté (défaut `'fatal'`) |
| `grip`     | autorité de l'impulsion sur la trajectoire (0 = aucune, 1 = kart) |
| `drag`     | décélération multiplicative par tour |
| `hazard`   | sol dangereux — **cosmétique** uniquement (effets visuels) |
| `color`/`dot` | rendu |

Le type vit dans `domain/surfaces.ts` ; **les valeurs** dans `data/surfaces.ts`
(table `S`). `data/` est inerte : aucune logique, aucune branche de gameplay.

## Politique de contact (`domain/collision.ts`, `domain/track.ts`)

`contactAt(track, x, y)` renvoie la `ContactPolicy` de la cible solide heurtée.
L'obstacle solide **prime sur le sol** ; défaut `'fatal'` (préserve P2).
À n'appeler que sur un point déjà solide (`isSolid`).

Les seuils de conséquence (frôlement / tête-à-queue / fatal) vivent dans
`tuning.contact` (`data/tuning.ts`), exprimés en fraction de `maxSpeed` :
`fatalSpeedFrac`, `spinSpeedFrac`, `grazeSpeedKeep`.

## Obstacles (`domain/obstacles.ts`, `data/obstacles.ts`)

Un obstacle est posé sur une tuile ; s'il est `solid` avec `radius > 0`, le contact
se teste sur le disque (centre de tuile, rayon en fraction de `tileSize`). Sa
`contact` prime sur celle du sol.

## Géométrie de franchissement — piège connu

Le déplacement d'un tour est un **segment droit potentiellement long**. La
détection de contact / de franchissement de ligne doit être une **intersection de
segments** (`domain/geometry.ts`, `domain/collision.ts`), jamais un test de zone :
sinon une ligne fine est « sautée » à grande vitesse.

## Ajouter une nouvelle surface

1. Ajouter l'entrée dans la table `S` de `data/surfaces.ts` (`grip`, `drag`, `solid`, `contact`, couleurs).
2. Aucune modification du `domain/` n'est nécessaire (l'ID est ouvert).
3. Référencer l'ID dans la `palette` d'un circuit (`data/tracks/`).
4. Le rendu suit `color`/`dot` automatiquement dans `render/canvasRenderer.ts`.
5. Ajouter un test d'effet mouvement/contact si le comportement est nouveau (skill `testing`).
