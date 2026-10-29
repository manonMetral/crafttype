import { describe, it } from 'vitest';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { DockerFactory } from './DockerFactory.js';

describe('DockerFactory', () => {
  const module = new DockerFactory().buildModule(propertiesFixture({ serverPort: 4321 }));

  it('builds the server in a multi-stage image that runs as the node user', () => {
    assertThatModule(module).hasFileContaining(
      'Dockerfile',
      'FROM node:26-alpine AS build',
      'RUN npm run server:build',
      'RUN npm ci --omit=dev',
      'USER node',
      'CMD ["node", "dist/server/main.js"]',
    );
  });

  it('listens on every interface, on the server port', () => {
    assertThatModule(module).hasFileContaining('Dockerfile', 'HOST=0.0.0.0 PORT=4321', 'EXPOSE 4321');
  });

  it('checks the health endpoint with the port of the environment', () => {
    assertThatModule(module).hasFileContaining('Dockerfile', 'HEALTHCHECK', "process.env.PORT + '/api/health'");
  });

  it('keeps dependencies, build output and secrets out of the build context', () => {
    assertThatModule(module).hasFileContaining('.dockerignore', 'node_modules', 'dist', '.env');
  });
});
