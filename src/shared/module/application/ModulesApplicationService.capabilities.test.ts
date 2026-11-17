import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import { moduleBuilder } from '../domain/CraftModule.js';
import { CapabilityAlreadyProvidedError, MissingModuleDependenciesError } from '../domain/errors.js';
import { ModulePropertiesDefinition } from '../domain/ModuleProperties.js';
import { moduleResource, type ModuleResource, type OrganizationStep } from '../domain/ModuleResource.js';

const clock = () => new Date('2026-10-20T10:00:00Z');

const resource = (
  slug: string,
  relations: (step: OrganizationStep) => ReturnType<OrganizationStep['standalone']>,
): ModuleResource =>
  relations(
    moduleResource()
      .slug(slug)
      .propertiesDefinition(ModulePropertiesDefinition.builder().build())
      .apiDoc('Test', `Module ${slug}`),
  )
    .tags('test')
    .factory((properties) => moduleBuilder(properties).build());

/** Two modules bring a `ui` (the real catalog has its own `front`), and two need one (one of them needs a module as well). */
const frontA = resource('front-a', (step) => step.standalone().provides('ui'));
const frontB = resource('front-b', (step) => step.standalone().provides('ui'));
const consumer = resource('consumer', (step) => step.standalone().requires('ui'));
const picky = resource('picky', (step) => step.dependsOn('typescript').requires('ui'));
const service = createModulesApplicationService({ clock, extraResources: [frontA, frontB, consumer, picky] });

const empty = () => tmpDirForTest();
const applied = (projectFolder: string) => service.projectState(projectFolder).applied.map(({ slug }) => slug);
const outcomes = (steps: readonly { outcome: string }[]) => steps.map(({ outcome }) => outcome);

describe('capabilities of the modules', () => {
  describe('Given a module that requires a capability', () => {
    it('When no applied module provides it Then it is refused, naming the capability and what can provide it', () => {
      const projectFolder = empty();

      const failure = (() => {
        try {
          service.apply('consumer', { projectFolder });
        } catch (error) {
          return error;
        }
      })();

      expect(failure).toBeInstanceOf(MissingModuleDependenciesError);
      expect(failure).toMatchObject({
        missing: [],
        missingCapabilities: [{ capability: 'ui', providers: ['front-a', 'front-b'] }],
        message:
          'Module consumer requires these modules to be applied first: a module that provides ui (front-a or front-b)',
      });
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it.each(['front-a', 'front-b'])('When %s is applied Then it is accepted, whichever provider it is', (provider) => {
      const projectFolder = empty();
      service.apply(provider, { projectFolder });

      service.apply('consumer', { projectFolder });

      expect(applied(projectFolder)).toEqual([provider, 'consumer']);
    });

    it('When it also needs a module Then both are named, the module first', () => {
      expect(() => service.apply('picky', { projectFolder: empty() })).toThrow(
        'Module picky requires these modules to be applied first: typescript, a module that provides ui (front-a or front-b)',
      );
    });

    it('When it needs a module and the capability is there Then it still names the module', () => {
      const projectFolder = empty();
      service.apply('front-a', { projectFolder });

      expect(() => service.apply('picky', { projectFolder })).toThrow(MissingModuleDependenciesError);
      expect(() => service.apply('picky', { projectFolder })).toThrow(
        'requires these modules to be applied first: typescript',
      );
    });

    it('When it is only planned Then it is refused as well: the plan says what would happen', () => {
      expect(() => service.apply('consumer', { projectFolder: empty() }, { dryRun: true })).toThrow(
        MissingModuleDependenciesError,
      );
    });
  });

  describe('Given two modules that provide the same capability', () => {
    it('When one is applied and the other is asked Then it is refused, naming the one that is there', () => {
      const projectFolder = empty();
      service.apply('front-a', { projectFolder });
      const history = service.projectState(projectFolder).applied;

      expect(() => service.apply('front-b', { projectFolder })).toThrow(CapabilityAlreadyProvidedError);
      expect(() => service.apply('front-b', { projectFolder })).toThrow(
        'Module front-b cannot be applied: ui is already provided by front-a',
      );
      expect(service.projectState(projectFolder).applied).toEqual(history);
    });

    it('When it is only planned Then it is refused as well', () => {
      const projectFolder = empty();
      service.apply('front-a', { projectFolder });

      expect(() => service.apply('front-b', { projectFolder }, { dryRun: true })).toThrow(
        CapabilityAlreadyProvidedError,
      );
    });

    it('When the one that is there is applied again Then it is accepted: it does not take its own place', () => {
      const projectFolder = empty();
      service.apply('front-a', { projectFolder });

      expect(() => service.apply('front-a', { projectFolder })).not.toThrow();
      expect(applied(projectFolder)).toEqual(['front-a']);
    });
  });

  describe('Given a basket', () => {
    it('When it holds a module and a provider of the capability it requires Then both are ready, the provider first', () => {
      const { steps, canApply } = service.previewBasket({ projectFolder: empty(), modules: ['consumer', 'front-b'] });

      expect(steps.map(({ slug }) => slug)).toEqual(['front-b', 'consumer']);
      expect(outcomes(steps)).toEqual(['ready', 'ready']);
      expect(canApply).toBe(true);
    });

    it('When the project already has a provider Then the module alone is ready', () => {
      const projectFolder = empty();
      service.apply('front-a', { projectFolder });

      const { steps } = service.previewBasket({ projectFolder, modules: ['consumer'] });

      expect(outcomes(steps)).toEqual(['ready']);
    });

    it('When it holds the module without any provider Then it is blocked, and says which capability is missing and who could bring it', () => {
      const { steps, canApply } = service.previewBasket({ projectFolder: empty(), modules: ['consumer'] });

      expect(steps).toEqual([
        {
          slug: 'consumer',
          outcome: 'blocked',
          error: expect.stringContaining('a module that provides ui'),
          missing: [],
          missingCapabilities: [{ capability: 'ui', providers: ['front-a', 'front-b'] }],
        },
      ]);
      expect(canApply).toBe(false);
    });

    it('When it holds the module and a module it needs but no provider Then both are said to be missing', () => {
      const { steps } = service.previewBasket({ projectFolder: empty(), modules: ['picky'] });

      expect(steps[0]).toMatchObject({
        outcome: 'blocked',
        missing: ['typescript'],
        missingCapabilities: [{ capability: 'ui', providers: ['front-a', 'front-b'] }],
      });
    });

    it('When it holds two providers of the same capability Then the first is ready and the second is blocked', () => {
      const { steps, canApply } = service.previewBasket({ projectFolder: empty(), modules: ['front-b', 'front-a'] });

      expect(steps.map(({ slug }) => slug)).toEqual(['front-a', 'front-b']);
      expect(outcomes(steps)).toEqual(['ready', 'blocked']);
      expect(steps[1]).toEqual({
        slug: 'front-b',
        outcome: 'blocked',
        error: 'Module front-b cannot be applied: ui is already provided by front-a',
        missing: [],
        missingCapabilities: [],
      });
      expect(canApply).toBe(false);
    });

    it('When it cannot apply Then nothing is written, as for any other reason', () => {
      const projectFolder = empty();

      const application = service.applyBasket({ projectFolder, modules: ['front-a', 'front-b'] });

      expect(application.outcome).toBe('refused');
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it('When it holds a provider and the module that needs it Then it applies them', () => {
      const projectFolder = empty();

      const application = service.applyBasket({ projectFolder, modules: ['consumer', 'front-a'] });

      expect(application.outcome).toBe('applied');
      expect(applied(projectFolder)).toEqual(['front-a', 'consumer']);
    });
  });
});
