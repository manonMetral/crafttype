/**
 * The folder of a project named `name`: the folder it is in, with its last segment replaced by the name, so that
 * changing the name of the project moves it next to where it was. `undefined` when there is nothing to propose: a
 * name that cannot be a folder name (empty, `.`, `..`, a path), or a folder with no parent to put it in.
 */
export const folderForName = (folder: string, name: string): string | undefined => {
  const clean = name.trim();
  if (clean === '' || clean === '.' || clean === '..' || /[\\/]/.test(clean)) {
    return undefined;
  }
  const trimmed = folder.trim().replace(/[\\/]+$/, '');
  if (trimmed === '') {
    return folder.trim().startsWith('/') ? `/${clean}` : undefined;
  }
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return cut < 0 ? undefined : `${trimmed.slice(0, cut + 1)}${clean}`;
};
