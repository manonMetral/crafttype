import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../shared/module/infrastructure/secondary/resourcesRoot.js';
import { propertiesFixture } from '../shared/test/ModuleAssertions.js';
import { allModuleResources } from './modules.js';

describe('catalogue de modules', () => {
  const resources = allModuleResources(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('a des slugs uniques', () => {
    const slugs = resources.map(({ slug }) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ne référence que des modules existants et sans cycle (ordre du catalogue respecté)', () => {
    const seen = new Set<string>();
    for (const { slug, dependsOn } of resources) {
      for (const dependency of dependsOn) {
        expect(seen, `${slug} dépend de ${dependency}, qui doit être déclaré avant`).toContain(dependency);
      }
      seen.add(slug);
    }
  });

  it.each(resources.map((resource) => [resource.slug, resource] as const))('le module %s se construit avec les propriétés par défaut', (_slug, resource) => {
    expect(() => resource.factory(propertiesFixture())).not.toThrow();
  });
});
