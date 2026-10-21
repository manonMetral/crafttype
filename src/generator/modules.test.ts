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

  it.each(resources.map((resource) => [resource.slug, resource] as const))(
    'module %s builds with the default properties',
    (_slug, resource) => {
      expect(() => resource.factory(propertiesFixture())).not.toThrow();
    },
  );
});
