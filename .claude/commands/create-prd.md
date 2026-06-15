Crée un nouveau PRD pour Rallye Vecteur, dans la **forme exacte** des PRD existants de `docs/`.

L'argument éventuel (`$ARGUMENTS`) est le sujet/titre pressenti du PRD. Ne rédige
**rien** avant d'avoir interrogé l'utilisateur : un PRD se conçoit avec lui, il ne
s'invente pas seul (cf. règle « questions ouvertes » du CLAUDE.md).

## 1. Cadrer

1. Lis `CLAUDE.md` (piliers P1–P5, couches, déterminisme) et **un PRD existant** comme `docs/prd-13.md` pour la forme.
2. Détermine le **numéro** : prochain entier libre en scannant `docs/prd-*.md`.
3. Invoque le skill `architecture` pour situer les couches impactées.

## 2. Questionner (obligatoire, avant rédaction)

Pose des questions à l'utilisateur — regroupées, pas une par une — pour obtenir le
matériau de chaque section. Couvre au minimum :

- **Titre & intention** : le verbe de jeu visé, le problème ressenti aujourd'hui.
- **Pilier(s) servi(s)** : lequel de P1–P5 la feature renforce, et comment.
- **Priorité / Impact / Effort** : valeurs de l'en-tête (`Priorité N`, `Impact ★…`, `Effort faible/moyen/élevé`).
- **Dépendances** : quels PRD ce travail suppose, étend ou recoupe.
- **Existant technique** : ce qui existe déjà et sera touché (fonctions, état, données).
- **Comportement attendu** : la liste numérotée de ce que le système doit faire, valeurs de départ tunables incluses.
- **Hors-scope** : les généralisations tentantes renvoyées à d'autres PRD.
- **Risques / questions ouvertes** : arbitrages non tranchés (équilibrage, RNG, UI, déterminisme…).

Si une réponse manque pour une section, redemande ; ne comble pas un trou par une
supposition silencieuse.

## 3. Rédiger (gabarit imposé)

Crée `docs/prd-NN-<slug-kebab>.md` avec **ces sections, dans cet ordre** :

```
# PRD NN — <titre court>

**Priorité : N — Impact ★★★ — Effort <faible|moyen|élevé>**

> Dépendances : <…> | <bloque/étend/recoupe …>

## Objectif
<le pourquoi : tension actuelle → ce que le joueur ressentira ; cite le(s) pilier(s) P1–P5>

## Existant technique
<état du code concerné aujourd'hui, en puces ; fonctions/état/données réels>

## Comportement
<liste numérotée 1., 2., 3.… ; valeurs de départ explicitement « (tunables) »>

## Hors-scope
<puces ; renvoie chaque généralisation à son PRD>

## Impacts par couche
- `domain/` : <…ou « aucun changement »>
- `data/` : <…>
- `systems/` : <…>
- `render/` : <… (cosmétique)>
- Tests : <fichiers `*.test.ts`>

## Critères d'acceptation
<puces vérifiables ; inclure SYSTÉMATIQUEMENT le critère de déterminisme (seed + inputs → course identique) et, si la simulation est touchée, la non-régression « comportement inchangé »>

## Tests
<puces : un fichier `*.test.ts` par comportement clé, décrit fonctionnellement>

## Risques / questions ouvertes
<puces ; arbitrages à trancher au plan, jamais en silence>
```

Contraintes de forme :
- Titres en anglais pour le code, prose en français.
- Respecte les piliers et invariants : tout hasard via RNG seedé, `render/` ne décide rien, `data/` inerte, animation hors-état.
- Le ton et la densité doivent matcher les PRD existants (concis, orienté ressenti de jeu + sûreté du déterminisme).

## 4. Restituer

Affiche le chemin du fichier créé et un résumé d'une phrase. Ne lance ni lint ni
tests (un PRD est un document, pas du code).
