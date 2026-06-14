# PRD 02 — Caméra et monde plus grand que l'écran

**Priorité : 1 — Impact ★★ — Effort moyen**

> Dépendances : dépend des PRD 00, 01 | bloque le PRD 07.

## Objectif

Le proto suppose que tout le circuit tient dans le canvas. Des tracés riches
(**P4**) et la procgen (PRD 07) imposent un monde plus grand que l'écran, donc une
**caméra** qui suit la voiture. Le joueur gagne en immersion (on « roule dans » la
spéciale) et le design se libère de la contrainte d'une seule vue fixe.

## Existant technique

- `render()` dessine en coordonnées monde = coordonnées écran (1:1), `buildCache` blitté en plein canvas.
- `pointerToWorld` mappe l'écran→monde via le `getBoundingClientRect` (ratio simple).
- Aucune notion de viewport/offset.

## Comportement

1. `systems/camera.ts` : état `{ x, y, zoom }`, fonction pure `worldToScreen`/`screenToWorld`.
2. Caméra qui suit la voiture avec un **lissage** (lerp vers la cible), clampée aux bornes du circuit pour ne pas montrer le vide.
3. Pendant la visée et l'animation, la caméra anticipe légèrement la direction de l'impulsion (dead-zone + look-ahead).
4. `pointerToWorld` passe par `screenToWorld` (la visée reste correcte sous caméra mobile).
5. Le cache de tracé reste en coordonnées monde ; `render/` n'en blitte que la portion visible (culling simple).
6. Option « vue circuit » (dézoom complet) sur touche, utile pour reconnaître la spéciale avant de pousser.

## Hors-scope

- Effets de caméra avancés (secousse de crash → PRD 08, transitions cinématiques).
- Mini-carte (potentiel futur).

## Impacts par couche

- `domain/` : aucun changement (la caméra ne touche pas la simulation — argument de sûreté : le déterminisme est intact).
- `data/` : bornes de caméra dérivées de la taille du `Track`.
- `systems/` : `camera.ts`.
- `render/` : `canvasRenderer.ts` applique la transformée caméra + culling.
- Tests : `camera.test.ts`.

## Critères d'acceptation

- La voiture reste visible et grossièrement centrée, jamais de zone hors-circuit affichée.
- La visée pointeur reste précise quelle que soit la position caméra.
- Déterminisme : la caméra ne modifie aucune valeur de `RaceState` (test : course identique caméra activée/désactivée).

## Tests

- `camera.test.ts` : `worldToScreen`/`screenToWorld` réciproques ; clamp aux bornes ; suivi lissé converge vers la cible.

## Risques / questions ouvertes

- Lissage vs précision de visée : une caméra trop molle peut décaler la cible perçue — éprouver en jeu.
- Zoom dynamique selon la vitesse (dézoom à haute vitesse) : tentant mais peut nuire à la lisibilité — à laisser ouvert.

---
