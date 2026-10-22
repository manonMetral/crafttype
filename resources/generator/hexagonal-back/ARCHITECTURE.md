# Architecture of `src/server`

The server is organized as hexagons, one per **context** (`greeting` is the
example: copy its shape for the next one).

```
src/server/
  app.ts, main.ts, composition.ts     assemble the server (outside the contexts)
  <context>/
    domain/                           rules, value objects, ports (interfaces)
    application/                      orchestration: calls the domain through its ports
    infrastructure/
      primary/                        what calls the application (Fastify routes)
      secondary/                      what the application calls (adapters of the ports)
```

## Rules

`architecture.test.ts` checks them with arch-unit-ts, and fails on a violation:

- the **domain** depends on nothing but itself: no application, no adapter, no
  `node:` module, no library (`fastify` included). Anything external goes
  through a port, an interface of the domain, and an adapter in `secondary/`;
- the **application** depends only on the domain (and on itself), same
  restriction on imports. It returns plain results, not domain objects the
  adapters would have to know;
- a **primary adapter** goes through the application: it depends neither on
  the domain nor on a secondary adapter;
- a **secondary adapter** implements a port of the domain and depends on
  nothing else of the context;
- a context never depends on another one.

Only `composition.ts` knows both the primary and the secondary adapters: it
builds them and registers the routes.

## Routes

Declare a route inside a Fastify plugin (`app.register(async (app) => ...)`,
see `greetingRoutes`), not on the root instance. A plugin registered earlier,
OpenAPI for instance, then sees it.

## What is not in a hexagon

`/api/health` is written inline in `app.ts` by the `fastify-server` module. It
stays there: moving it would mean rewriting a file that other modules complete
(`config`, `logs`), which CraftType cannot do yet without losing their
insertions.

## Add a context

1. Copy the `greeting` folder, rename it, and keep the four layers.
2. Register it in `composition.ts`.
3. Run `npm test`: `architecture.test.ts` picks it up (a context is a folder
   that has a `domain` folder).
