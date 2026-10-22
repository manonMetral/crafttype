import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { FetchClientFactory } from './FetchClientFactory.js';

describe('FetchClientFactory', () => {
  const module = new FetchClientFactory().buildModule(propertiesFixture());

  it('adds the client, the health call and their tests under src/webapp/api', () => {
    expect(module.files.map((file) => file.destination)).toEqual([
      'src/webapp/api/http.ts',
      'src/webapp/api/health.ts',
      'src/webapp/api/http.test.ts',
      'src/webapp/api/health.test.ts',
    ]);
  });

  it('calls the API under /api, as the Vite proxy of vue-app forwards it', () => {
    assertThatModule(module)
      .hasFileContaining('src/webapp/api/http.ts', "export const API_BASE = '/api'", 'export class ApiError')
      .hasFileContaining('src/webapp/api/health.ts', "getJson<HealthResponse>('/health'");
  });

  it('adds no dependency and no script, and does not touch the files of vue-app', () => {
    expect(module.packageJson).toEqual({ fields: {}, dependencies: {}, devDependencies: {}, scripts: {} });
    expect(module.edits).toEqual([]);
  });
});
