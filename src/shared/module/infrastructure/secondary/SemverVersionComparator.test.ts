import { describe, expect, it } from 'vitest';
import { SemverVersionComparator } from './SemverVersionComparator.js';

describe('SemverVersionComparator', () => {
  const comparator = new SemverVersionComparator();

  it.each([
    ['5.13.0', '5.12.7', 'version exacte plus récente'],
    ['6.0.0', '5.12.7', 'version majeure plus récente'],
    ['^5.13.0', '5.12.7', 'intervalle dont le minimum est plus récent'],
    ['^5.0.0', '5.12.7', 'intervalle qui accepte la version du catalogue'],
    ['>=5', '5.12.7', 'intervalle ouvert'],
    ['*', '5.12.7', 'toute version'],
  ])('garde %s face à %s (%s)', (existing, wanted) => {
    expect(comparator.keepsExistingVersion(existing, wanted)).toBe(true);
  });

  it.each([
    ['5.0.0', '5.12.7', 'version plus ancienne'],
    ['^4.0.0', '5.12.7', 'majeure plus ancienne'],
    ['~5.1.0', '5.12.7', 'intervalle qui exclut la version du catalogue'],
    ['5.0.0-beta.1', '5.0.0', 'préversion face à la version finale'],
    ['latest', '5.12.7', 'tag'],
    ['github:org/repo', '5.12.7', 'URL'],
    ['workspace:*', '5.12.7', 'référence de workspace'],
    ['file:../fastify', '5.12.7', 'chemin local'],
  ])('ne garde pas %s face à %s (%s)', (existing, wanted) => {
    expect(comparator.keepsExistingVersion(existing, wanted)).toBe(false);
  });
});
