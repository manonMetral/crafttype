import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { FileSystemProjectFiles } from './FileSystemProjectFiles.js';
import { OverlayProjectSimulator } from './OverlayProjectSimulator.js';

describe('OverlayProjectSimulator', () => {
  const simulator = () => new OverlayProjectSimulator(new FileSystemProjectFiles());

  it('starts from the history the project really has', () => {
    const folder = tmpDirForTest();
    mkdirSync(join(folder, '.crafttype/modules'), { recursive: true });
    writeFileSync(
      join(folder, '.crafttype/modules/history.json'),
      JSON.stringify({ modules: [{ slug: 'init', properties: {}, appliedAt: '2026-10-20T10:00:00.000Z' }] }),
    );

    const { history } = simulator().start();

    expect(history.list(folder).map(({ slug }) => slug)).toEqual(['init']);
  });

  it('records the modules of the simulation without writing the real history', () => {
    const folder = tmpDirForTest();
    const { history } = simulator().start();

    history.record(folder, {
      slug: 'init',
      properties: { projectName: 'shop' },
      appliedAt: '2026-10-20T10:00:00.000Z',
    });

    expect(history.list(folder).map(({ slug }) => slug)).toEqual(['init']);
    expect(existsSync(join(folder, '.crafttype'))).toBe(false);
  });

  it('shows the files written in the simulation to its history and to nobody else', () => {
    const folder = tmpDirForTest();
    const first = simulator().start();
    first.files.write(folder, 'package.json', '{}');

    expect(first.files.read(folder, 'package.json')).toBe('{}');
    expect(simulator().start().files.read(folder, 'package.json')).toBeUndefined();
  });

  it('starts every simulation from the real project again', () => {
    const folder = tmpDirForTest();
    const sim = simulator();
    sim.start().history.record(folder, { slug: 'init', properties: {}, appliedAt: '2026-10-20T10:00:00.000Z' });

    expect(sim.start().history.list(folder)).toEqual([]);
  });
});
