# CraftType

Générateur modulaire de projets **Node.js (Fastify)** et **Vue.js**, inspiré de [Seed4J](https://github.com/seed4j/seed4j).
Chaque module ajoute une seule chose à un projet (TypeScript, Vitest, un serveur Fastify, une application Vue...) et s'applique à la demande, dans l'ordre voulu.

> État : prototype de la phase 0. Le noyau et six modules fonctionnent, la CLI est minimale.

## Utilisation

```bash
npm install
npm run cli -- list
npm run cli -- apply init --project-folder ../mon-app --project-name mon-app
npm run cli -- apply typescript --project-folder ../mon-app
npm run cli -- apply vitest --project-folder ../mon-app
npm run cli -- apply prettier --project-folder ../mon-app
npm run cli -- apply fastify-server --project-folder ../mon-app --server-port 3000
npm run cli -- apply vue-app --project-folder ../mon-app
```

Les modules appliqués sont notés dans `.crafttype/modules/history.json` du projet généré, avec les propriétés qu'ils déclarent. Un module refuse de s'appliquer si les modules dont il dépend ne sont pas dans cet historique.
Les options déjà données à un module précédent (`--project-name` pour `init`, `--server-port` pour `fastify-server`) sont reprises par les suivants : `vue-app` proxifie vers le port choisi pour le serveur.
Chaque module déclare ses propres options : `npm run cli -- apply <module> --help` les liste.

Un module ne remplace jamais un fichier ou une entrée du `package.json` dont le contenu diffère : par défaut il liste les conflits et s'arrête, sans rien écrire. Trois options changent ce comportement :

| Option | Effet |
|---|---|
| `--skip-conflicts` | applique le module en gardant les éléments existants qui diffèrent, et les liste |
| `--force` | remplace les éléments existants qui diffèrent |
| `--dry-run` | affiche ce que le module créerait, laisserait inchangé ou trouverait en conflit, sans rien écrire (code de sortie 1 s'il reste un conflit) |

`--force` et `--skip-conflicts` sont incompatibles ; `--dry-run` se combine avec l'un ou l'autre pour voir leur effet.

**Versions de dépendances.** Une dépendance déjà présente dans le `package.json` avec une version égale, plus récente ou compatible avec celle du catalogue (`^5.0.0` pour `5.12.7`) n'est pas un conflit : elle est conservée, même avec `--force`, pour ne jamais faire reculer un projet mis à jour par Renovate. Une version plus ancienne, un tag (`latest`), une URL ou une référence de workspace restent des conflits.

## Vérifier que ça marche

```bash
npm test               # tests unitaires et d'acceptation (CLI)
npm run ci:generate    # génère une application complète puis l'installe, la compile et la teste
```

## Organisation du code

Chaque module est un « hexagone », comme dans Seed4J (voir `documentation/hexagonal-architecture.md` de leur dépôt) :

```
src/
  shared/module/            noyau : modèle de module, moteur d'application, adaptateurs (fichiers, mustache, CLI)
  generator/<module>/
    application/            service d'orchestration
    domain/                 fabrique : construit le CraftModule à partir des propriétés
    infrastructure/primary/ ressource de module (slug, propriétés, dépendances, tags)
  generator/modules.ts      catalogue des modules
  composition.ts            racine de composition
resources/generator/
  <module>/                 templates (.mustache) et fichiers copiés tels quels
  dependencies/             versions des paquets npm (common, vue), à faire suivre par Renovate
```

Créer un module : voir [documentation/module-creation.md](documentation/module-creation.md).

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md).

## Licence

Apache-2.0, voir [LICENSE](LICENSE). CraftType s'inspire du fonctionnement de Seed4J (également Apache-2.0) sans en reprendre le code.
