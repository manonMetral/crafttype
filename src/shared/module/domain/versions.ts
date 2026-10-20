import { gte, minVersion, satisfies, validRange } from 'semver';

/**
 * Faut-il garder la version déjà présente dans le projet plutôt que celle du catalogue ?
 * Oui si elle accepte la version du catalogue (`^5.0.0` pour `5.12.7`) ou lui est supérieure ou égale :
 * c'est le cas d'un projet dont Renovate a déjà fait monter les versions. Une version plus ancienne, un tag
 * (`latest`), une URL ou une référence de workspace ne sont pas comparables : le module ne peut pas la garder
 * sans risque, c'est un conflit.
 */
export const keepsExistingVersion = (existing: string, wanted: string): boolean => {
  if (validRange(existing) === null || validRange(wanted) === null) {
    return false;
  }

  const existingMin = minVersion(existing);
  const wantedMin = minVersion(wanted);
  if (existingMin === null || wantedMin === null) {
    return false;
  }

  return satisfies(wantedMin, existing) || gte(existingMin, wantedMin);
};
