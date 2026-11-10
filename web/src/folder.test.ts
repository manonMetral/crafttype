import { describe, expect, it } from 'vitest';
import { folderForName } from './folder';

describe('folder that goes with a project name', () => {
  it('is the folder of the project, with its last segment replaced by the name', () => {
    expect(folderForName('/work/shop', 'my-app')).toBe('/work/my-app');
    expect(folderForName('/home/dev/projects/shop', 'api')).toBe('/home/dev/projects/api');
  });

  it('does not depend on a slash at the end', () => {
    expect(folderForName('/work/shop/', 'my-app')).toBe('/work/my-app');
    expect(folderForName('/work/shop//', 'my-app')).toBe('/work/my-app');
  });

  it('follows the separator of Windows', () => {
    expect(folderForName('C:\\work\\shop', 'my-app')).toBe('C:\\work\\my-app');
    expect(folderForName('C:\\work\\shop\\', 'my-app')).toBe('C:\\work\\my-app');
  });

  it('puts the project at the root when the folder is the root', () => {
    expect(folderForName('/', 'my-app')).toBe('/my-app');
    expect(folderForName('/shop', 'my-app')).toBe('/my-app');
  });

  it('ignores the spaces around the name', () => {
    expect(folderForName('/work/shop', '  my-app ')).toBe('/work/my-app');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['a dot', '.'],
    ['two dots', '..'],
    ['a path', 'a/b'],
    ['a path of Windows', 'a\\b'],
  ])('leaves the folder alone for a name that is %s', (_case, name) => {
    expect(folderForName('/work/shop', name)).toBeUndefined();
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['without a parent folder', 'shop'],
  ])('leaves the folder alone when it is %s', (_case, folder) => {
    expect(folderForName(folder, 'my-app')).toBeUndefined();
  });
});
