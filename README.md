# CraftType

Générateur modulaire de projets **Node.js (Fastify)** et **Vue.js**, inspiré de [Seed4J](https://github.com/seed4j/seed4j).
Chaque module ajoute une seule chose à un projet (TypeScript, Vitest, un serveur Fastify, une application Vue...) et s'applique à la demande, dans l'ordre voulu.

> État : prototype de la phase 0. Le noyau et cinq modules fonctionnent, la CLI est minimale.

## Utilisation

```bash
npm install
npm run cli -- list
npm run cli -- apply init --project-folder ../mon-app --project-name mon-app
npm run cli -- apply typescript --project-folder ../mon-app
npm run cli -- apply vitest --project-folder ../mon-app
npm run cli -- apply fastify-server --project-folder ../mon-app --server-port 3000
npm run cli -- apply vue-app --project-folder ../mon-app
```

Les modules appliqués sont notés dans `.crafttype/modules/history.json` du projet généré. Un module refuse de s'appliquer si les modules dont il dépend ne sont pas dans cet historique.

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
    domain/                 fabrique : construit le CraftModule à partir des propriétés
    application/            service d'orchestration
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
