# PRD 16 — Peloton de bots pilotés par IA (course simultanée)

**Priorité : 2 — Impact ★★★ — Effort élevé**

> Dépendances : dépend des PRD 00 (déterminisme), 01 (checkpoints/arrivée), 05 (voitures), 07/15 (circuits générés). **Réutilise l'infrastructure du PRD 06** (avancer une voiture en rejouant des tours) — un bot est une voiture pilotée *en direct* au lieu d'être rejouée. Recoupe le PRD 04 (RNG de contact par voiture).

## Objectif

Aujourd'hui on court **seul** : contre le décor et le chrono. On ajoute des
**adversaires** — un peloton de voitures pilotées par une IA — pour transformer la
spéciale en **course**. Le joueur ne se mesure plus à une ligne idéale abstraite mais
à des rivaux visibles qui prennent leurs propres risques. Sert **P5** (l'IA est
déterministe, comme tout le reste : même seed → même course, bots compris), **P1**
(les bots *anticipent l'inertie* — ils incarnent la maîtrise que le jeu demande) et
**P2** (un bot agressif pousse et finit dans le mur ; le joueur arbitre vitesse vs
sécurité pour le doubler). Les voitures **se traversent** : la course se joue sur la
ligne et la prise de risque, pas sur le contact.

## Existant technique

- `RaceState` (domain/gameState) = **une seule voiture** (le joueur) : `car`, `rng`, `phase`, mods/charges. `step`/`resolveMove`/`applyMove` sont purs et déterministes.
- `systems/simulation.ts:advanceTurn(state, track, tuning, car, impulse, …)` avance une voiture d'un tour ; déjà réutilisé par le **fantôme** (`systems/ghost.ts`) qui réinjecte des impulsions enregistrées.
- `systems/lap.ts:LapTracker` suit checkpoints+arrivée **par voiture** (instanciable), franchissement par intersection de segments orientés.
- `systems/input.ts` produit l'impulsion du joueur (visée bornée). Aucun pilote automatique.
- RNG seedé porté dans `RaceState.rng` (un seul flux, celui du joueur). Aucune notion de plusieurs flux indépendants.
- Le contact (mur/obstacle) → `phase: 'crashed'` (P2). Aucune notion de contact voiture-voiture.

## Comportement

1. **Pilote IA pur** : `domain/ai.ts:decideImpulse(state, track, profile, rng) → { impulse, rng }`, **fonction pure et déterministe**. L'IA vise le **prochain checkpoint** (puis l'arrivée) en **corrigeant l'inertie** (l'impulsion oriente la quantité de mouvement vers le waypoint, ne pointe pas bêtement dessus — **P1**), et module la poussée selon le profil.
2. **Profils de skill variés** *(tunables)* : chaque bot a un `BotProfile` (ex. agressivité = fraction de `maxImpulse` visée, marge de freinage avant virage, bruit de visée seedé). Un profil agressif va plus vite et crashe plus ; un prudent sécurise. Au moins 3–4 profils distincts pour peupler le peloton.
3. **Peloton** *(tunable, défaut 5 bots)* : N voitures adverses, chacune une voiture à part entière (état type `RaceState`) avançant via `advanceTurn` avec l'impulsion décidée par l'IA.
4. **Course simultanée, tour par tour** : à chaque round, le joueur vise et valide ; **les bots décident leur impulsion pour le même round** ; toutes les voitures avancent d'un tour, puis l'animation joue. Le round n'avance que sur la validation du joueur (**pas de temps réel** ; les bots « attendent » le joueur).
5. **Pas de collision voiture-voiture** : les voitures **se traversent**. Seuls murs et obstacles déclenchent un contact (P2). Aucune physique inter-voitures, aucun couplage d'ordre de résolution entre voitures.
6. **Crash = élimination** : un bot qui heurte mur/obstacle passe `crashed` et **n'avance plus** (cohérent P2). Le joueur qui crashe est sorti de la course (il a perdu ; on peut afficher le classement final des bots).
7. **Victoire** : la **première voiture** à franchir l'arrivée (tous checkpoints validés, bon sens) gagne. Classement par ordre d'arrivée ; le joueur voit sa **position**.
8. **RNG par voiture** : chaque voiture tire dans **son propre flux seedé**, dérivé du seed de course (ex. `seed ⊕ index`), pour que l'entrelacement joueur/bots n'affecte jamais la reproductibilité. Tout hasard (dispersion, contact, bruit de visée IA) via ces flux ; jamais `Math.random`.
9. **Grille de départ** *(tunable)* : les bots démarrent à des positions/offsets déterministes près du départ (les voitures pouvant se superposer, l'offset est surtout lisibilité). Offsets dérivés du seed → déterministes.

## Hors-scope

- **Collisions / blocage entre voitures** (se gêner, se taper) : explicitement écarté ici → éventuel PRD dédié.
- **Bots utilisant les modificateurs de tour** (boost/frein à main, PRD 13) : v1 sur impulsion de base uniquement → réglage ultérieur si l'équilibrage l'exige.
- **Rubber-banding / IA de rattrapage** (adapter la vitesse des bots à celle du joueur) : non, profils fixes seedés.
- **Pathfinding / apprentissage avancé** : on livre une **heuristique** (viser le prochain checkpoint en corrigeant l'inertie), pas un solveur de ligne optimale.
- **Multijoueur en ligne / classements partagés** : nécessiterait du déterminisme cross-plateforme (PRD 00, Risques).
- **Un bot qui « continue après crash »** (peloton fourni jusqu'au bout) : écarté (crash = élimination).

## Impacts par couche

- `domain/` : `ai.ts` (`decideImpulse` pur) + types `BotProfile`. **Aucun changement** à `physics`/`step`/`collision` (réutilisés tels quels — argument de sûreté du déterminisme). Helper de dérivation de seed dans `rng.ts` si besoin.
- `data/` : `bots.ts` (table de profils + taille du peloton + grille de départ) ; constantes d'IA dans `tuning.ts`.
- `systems/` : orchestration multi-voitures (extension de `simulation.ts` ou nouveau `race.ts`) — instancier N adversaires (état + RNG seedé + `LapTracker`), les avancer chaque round, suivre arrivées/classement, gérer l'élimination. `input.ts` inchangé (joueur). Réutilise `advanceTurn` (PRD 06).
- `render/` : dessin des voitures adverses (distinctes du joueur et du fantôme), HUD de **classement/position** — cosmétique, ne décide rien.
- Tests : `ai.test.ts`, `race.test.ts`, extension du test de déterminisme.

## Critères d'acceptation

- **Déterminisme** : `(raceSeed, carId, trackId, impulsions du joueur)` → course **identique** bots compris (positions, crashes, ordre d'arrivée), rejouée bit pour bit.
- **Non-régression** : course **sans bot** (peloton vide) → `RaceState` du joueur **strictement inchangé** par rapport à aujourd'hui.
- `decideImpulse` est une **fonction pure** de `(state, track, profile, rng)` ; aucun `Math.random` ; chaque voiture a un flux RNG seedé dérivé du `raceSeed`.
- **Pas de contact voiture-voiture** : deux voitures au même point ne déclenchent aucune conséquence ; seuls murs/obstacles le font.
- Un bot `crashed` **n'avance plus** ; la première voiture à valider l'arrivée gagne ; le classement reflète l'ordre d'arrivée.
- **Profils distincts** : un profil agressif est mesurablement plus rapide **et** crashe plus souvent qu'un prudent sur un échantillon de seeds.

## Tests

- `ai.test.ts` : `decideImpulse` déterministe (mêmes entrées → même impulsion) ; impulsion **bornée** à `maxImpulse` ; un profil agressif vise une poussée supérieure à un prudent ; l'impulsion **réduit** la distance au prochain checkpoint en tenant compte de l'inertie (vise la trajectoire, pas le point brut).
- `race.test.ts` : course multi-voitures rejouée deux fois (même seed + mêmes inputs joueur) → **identique** ; peloton vide = course solo identique à aujourd'hui ; un bot qui crashe s'arrête ; deux voitures superposées ne se percutent pas ; classement par ordre d'arrivée.
- Extension du test de déterminisme global (la suite de `RaceState` joueur **et** bots est reproductible).

## Risques / questions ouvertes

- **Qualité de l'IA (P1)** : l'heuristique « viser le prochain checkpoint en corrigeant l'inertie, pousser selon le profil » doit produire des bots **crédibles** (freiner avant un virage serré, ne pas s'écraser systématiquement). C'est l'enjeu dur — à éprouver en jeu, ne pas figer seul ; rester **pur et seedé**.
- **RNG par voiture** : fixer la **dérivation de seed** (ex. `raceSeed` + index voiture) et l'ordre de tirage, **documentés**, pour que l'entrelacement joueur/bots n'altère pas la repro (dépendance fine avec le contact seedé du PRD 04).
- **Modèle de tour simultané** : confirmer que le round n'avance qu'à la validation du joueur (les bots ne jouent pas en temps réel). Lisibilité : montrer le déplacement simultané des bots sans noyer la visée du joueur (recoupe l'aide à la visée, PRD 10/12).
- **Fin de course côté joueur** : si le joueur crashe ou finit, poursuit-on la simulation des bots pour afficher le classement complet ? (cohérent P2 : joueur sorti = perdu, mais on calcule le résultat.) À trancher au plan.
- **Équilibrage des profils** : il doit exister des rivaux battables **et** des relevés ; régler agressivité/marges en jeu, pas seul.
- **Grille de départ** : sans collision, les voitures peuvent se superposer au départ ; un offset déterministe améliore la lisibilité — cosmétique vs impact sim, à trancher.
- **Charge de rendu** : un peloton + fantôme + aide à la visée peut surcharger l'écran ; prévoir la hiérarchie visuelle (joueur > rivaux proches > lointains).

---
