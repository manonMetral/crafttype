const STORAGE_KEY = 'crafttype.token';

/**
 * The token `crafttype ui` printed, found in the address it opened (`/?token=...`). It is kept for the tab, and taken
 * out of the address at once so that it is neither shown, nor bookmarked, nor copied by mistake. After a reload the
 * address no longer has it: the tab's copy is used.
 */
export const readToken = (
  location: Pick<Location, 'search' | 'pathname' | 'hash'>,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  history: Pick<History, 'replaceState'>,
): string | undefined => {
  const parameters = new URLSearchParams(location.search);
  const given = parameters.get('token');
  if (given === null) {
    return storage.getItem(STORAGE_KEY) ?? undefined;
  }
  parameters.delete('token');
  const rest = parameters.toString();
  history.replaceState(null, '', `${location.pathname}${rest === '' ? '' : `?${rest}`}${location.hash}`);
  if (given === '') {
    return storage.getItem(STORAGE_KEY) ?? undefined;
  }
  storage.setItem(STORAGE_KEY, given);
  return given;
};
