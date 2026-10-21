import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { GithubActionsFactory } from './GithubActionsFactory.js';

describe('GithubActionsFactory', () => {
  const module = new GithubActionsFactory().buildModule(propertiesFixture());

  it('adds one workflow that runs on pushes to main and on pull requests', () => {
    assertThatModule(module).hasFileContaining(
      '.github/workflows/ci.yml',
      'push:\n    branches: [main]',
      'pull_request:',
      'permissions:\n  contents: read',
    );
  });

  it('runs the scripts of the other modules and skips the ones that are not there', () => {
    assertThatModule(module).hasFileContaining(
      '.github/workflows/ci.yml',
      'run: npm ci',
      'run: npm run typecheck',
      'run: npm test',
      'run: npm run --if-present format:check',
      'run: npm run --if-present webapp:typecheck',
      'run: npm run --if-present server:build',
      'run: npm run --if-present webapp:build',
    );
  });

  it('does not touch package.json', () => {
    expect(module.packageJson).toEqual({ fields: {}, dependencies: {}, devDependencies: {}, scripts: {} });
  });
});
