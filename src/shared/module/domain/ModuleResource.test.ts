import { describe, expect, it } from 'vitest';
import { moduleBuilder } from './CraftModule.js';
import { ModulePropertiesDefinition } from './ModuleProperties.js';
import { moduleResource } from './ModuleResource.js';

const base = () =>
  moduleResource()
    .slug('example')
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Group', 'Does something');
const factory = (properties: Parameters<typeof moduleBuilder>[0]) => moduleBuilder(properties).build();

describe('module resource', () => {
  describe('what it needs and what it brings', () => {
    it('needs no module and no capability, and brings none, unless it says so', () => {
      const resource = base().standalone().tags('test').factory(factory);

      expect(resource.dependsOn).toEqual([]);
      expect(resource.requires).toEqual([]);
      expect(resource.provides).toEqual([]);
    });

    it('needs the modules it names', () => {
      const resource = base().dependsOn('typescript', 'vitest').tags('test').factory(factory);

      expect(resource.dependsOn).toEqual(['typescript', 'vitest']);
    });

    it('needs a module that provides each capability it requires, whichever module it is', () => {
      const resource = base()
        .dependsOn('vitest')
        .requires('front')
        .requires('database', 'cache')
        .tags('test')
        .factory(factory);

      expect(resource.requires).toEqual(['front', 'database', 'cache']);
      expect(resource.dependsOn).toEqual(['vitest']);
    });

    it('brings the capabilities it provides', () => {
      const resource = base().dependsOn('typescript').provides('front').tags('test').factory(factory);

      expect(resource.provides).toEqual(['front']);
      expect(resource.requires).toEqual([]);
    });

    it('can both require and provide, in any order', () => {
      const one = base().standalone().requires('a').provides('b').tags('test').factory(factory);
      const other = base().standalone().provides('b').requires('a').tags('test').factory(factory);

      expect(one.requires).toEqual(other.requires);
      expect(one.provides).toEqual(other.provides);
    });

    it('lists a capability once', () => {
      const resource = base()
        .standalone()
        .requires('front', 'front')
        .provides('web', 'web')
        .tags('test')
        .factory(factory);

      expect(resource.requires).toEqual(['front']);
      expect(resource.provides).toEqual(['web']);
    });
  });

  describe('immutability', () => {
    it('cannot have its relations changed afterwards', () => {
      const resource = base().dependsOn('a').requires('b').provides('c').tags('test').factory(factory);

      expect(() => (resource.requires as string[]).push('x')).toThrow(TypeError);
      expect(() => (resource.provides as string[]).push('x')).toThrow(TypeError);
    });

    it('leaves a step unchanged when another one is derived from it', () => {
      const step = base().standalone();

      const withFront = step.provides('front').tags('test').factory(factory);
      const withNothing = step.tags('test').factory(factory);
      const requiring = step.requires('front').tags('test').factory(factory);

      expect(withFront.provides).toEqual(['front']);
      expect(withNothing.provides).toEqual([]);
      expect(withNothing.requires).toEqual([]);
      expect(requiring.requires).toEqual(['front']);
      expect(requiring.provides).toEqual([]);
    });
  });
});
