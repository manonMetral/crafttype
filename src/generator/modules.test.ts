import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../shared/module/infrastructure/secondary/resourcesRoot.js';
import { propertiesFixture } from '../shared/test/ModuleAssertions.js';
import { allModuleResources } from './modules.js';

describe('module catalog', () => {
  const resources = allModuleResources(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('has unique slugs', () => {
    const slugs = resources.map(({ slug }) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only depends on modules declared before it, so they exist and there is no cycle', () => {
    const seen = new Set<string>();
    for (const { slug, dependsOn } of resources) {
      for (const dependency of dependsOn) {
        expect(seen, `${slug} depends on ${dependency}, which must be declared before it`).toContain(dependency);
      }
      seen.add(slug);
    }
  });

  it('only requires capabilities that a module provides, declared before it', () => {
    const position = new Map(resources.map(({ slug }, index) => [slug, index]));
    for (const { slug, requires } of resources) {
      for (const capability of requires) {
        const providers = resources.filter(({ provides }) => provides.includes(capability));
        expect(providers.length, `${slug} requires ${capability}, which nothing provides`).toBeGreaterThan(0);
        for (const provider of providers) {
          expect(
            position.get(provider.slug) as number,
            `${provider.slug} provides ${capability}, so it must be declared before ${slug}`,
          ).toBeLessThan(position.get(slug) as number);
        }
      }
    }
  });

  it('does not ask for a capability and a module that already provides it to be applied together', () => {
    for (const { slug, dependsOn, provides } of resources) {
      for (const dependency of dependsOn) {
        const needed = resources.find((candidate) => candidate.slug === dependency)!;
        expect(
          needed.provides.some((capability) => provides.includes(capability)),
          `${slug} depends on ${dependency}, and both provide the same capability`,
        ).toBe(false);
      }
    }
  });

  it.each(resources.map((resource) => [resource.slug, resource] as const))(
    'module %s builds with the default properties',
    (_slug, resource) => {
      expect(() => resource.factory(propertiesFixture())).not.toThrow();
    },
  );
});
