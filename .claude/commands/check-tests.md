Vérifie la couverture de tests et crée les tests manquants pour Rallye Vecteur.

Les tests sont de **comportement** : on teste « ce que fait le système », pas les
détails d'implémentation. On teste `domain/`, `data/` et `systems/` sans rendu —
`render/` n'est pas testé unitairement (couvert par la non-régression).

1. Lis les sources de `src/domain/`, `src/data/` et `src/systems/` pour identifier les comportements.
2. Lis les tests existants dans `test/` (miroir de `src/`) pour identifier le couvert. Cf. skill `testing` pour la carte des fichiers.
3. Compare et identifie les manques, en particulier :
   - **Déterminisme** : toute feature touchant la simulation a-t-elle son assertion `run(seed, inputs)` deux fois → `toEqual` ?
   - **Cas limites collision/géométrie** : premier contact, hors-grille = solide, segment qui saute une ligne fine (intersection de segments), franchissement dans le bon sens uniquement.
   - **Conséquences de contact** : seuils fatal / tête-à-queue (seedé) / frôlement.
   - **Modificateurs de tour** : effet et consommation de charges.
4. Liste les tests proposés à l'utilisateur et **attends sa validation** avant de les écrire.
5. Pour chaque test validé, crée-le dans le fichier approprié de `test/` (cf. skill `testing` pour le placement). Les tests doivent :
   - Vérifier des comportements (ex. « au-dessus du seuil fatal, le contact termine la course »).
   - Ne PAS tester les détails internes (valeurs intermédiaires, structure d'objets).
   - Utiliser les fonctions exportées comme un consommateur du module.
   - Rester concis et lisibles.
6. Lance `npm run test:run` et corrige les erreurs.
7. Produis un rapport :
   - Comportements couverts avant / après.
   - Tests ajoutés.
   - Résultat final de `test:run`.
