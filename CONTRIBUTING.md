# Contribuer à CraftType

Merci de votre intérêt. Les contributions sont bienvenues : corrections, nouveaux modules, documentation, retours d'usage.
En participant, vous acceptez le [code de conduite](CODE_OF_CONDUCT.md). Vos contributions sont publiées sous [licence Apache-2.0](LICENSE), comme le reste du projet.

## Signaler un problème ou proposer une idée

Ouvrez une [issue](https://github.com/manonMetral/crafttype/issues). Pour un bogue, indiquez la commande lancée, la version de Node, le résultat attendu et le résultat obtenu.
Pour un nouveau module, décrivez ce qu'il ajoute au projet généré et de quels modules il dépend, avant de coder : cela évite un travail qui ne rentrerait pas dans le catalogue.

## Préparer son poste

Prérequis : Node.js 22.12 ou plus récent, et npm.

```bash
git clone git@github.com:manonMetral/crafttype.git
cd crafttype
npm ci
```

## Vérifier ses changements

```bash
npm run format        # met le code en forme (Prettier) ; format:check le vérifie, la CI aussi
npm run lint:types    # typecheck
npm test              # tests unitaires et d'acceptation
npm run build         # compilation vers dist/
npm run ci:generate   # génère une application complète avec tous les modules, puis l'installe, la type-check, la teste et la compile
```

La CI GitHub exécute les mêmes commandes sur Node 22 et 24. Une pull request doit être verte pour être fusionnée.

## Ajouter ou modifier un module

Suivez [documentation/module-creation.md](documentation/module-creation.md). En résumé :

1. Écrire d'abord le test de la fabrique avec `assertThatModule`.
2. Écrire la fabrique, les templates dans `resources/generator/<module>/` et, si besoin, les versions dans `resources/generator/dependencies/`.
3. Déclarer la ressource de module, puis l'ajouter dans `src/generator/modules.ts` après les modules dont elle dépend. `tests-ci/generate.sh` l'inclut alors automatiquement dans l'application complète.

Respectez l'architecture hexagonale du dépôt : le domaine ne dépend d'aucun adaptateur, les accès au disque et à mustache restent dans `infrastructure/secondary`. Une bibliothèque tierce utilisée par le domaine passe par un port (voir `VersionComparator` et son adaptateur `SemverVersionComparator`). `src/test/architecture/HexagonalArch.test.ts` ([arch-unit-ts](https://github.com/arch-unit-ts/arch-unit-ts)) vérifie ces règles dans `npm test` : un nouveau module qui les enfreint fait échouer les tests en nommant le fichier fautif.

## Versions des dépendances

Les versions injectées dans les projets générés vivent dans `resources/generator/dependencies/`. Elles sont exactes (sans `^`) et mises à jour par Renovate, dans une seule pull request groupée. Ne les modifiez à la main que pour ajouter un paquet.

## Proposer une pull request

- Partez de `main`, avec une branche par sujet.
- Un commit = un changement cohérent, avec un message de la forme `type: description` (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`), comme dans l'historique.
- Ajoutez ou adaptez les tests, et la documentation si le comportement change.
- Décrivez dans la pull request ce qui change et comment vous l'avez vérifié.
- `main` est protégée : la CI doit être verte et une personne listée dans [`.github/CODEOWNERS`](.github/CODEOWNERS) doit approuver la pull request avant la fusion.
