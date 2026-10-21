import { NeedleError } from './errors.js';

/** Insertion d'un bloc de lignes dans un fichier existant, juste avant la ligne qui porte un repère (« needle »). */
export interface FileEdit {
  readonly path: string;
  /** Nom court du repère : `main-imports` désigne la ligne qui contient `crafttype-needle-main-imports`. */
  readonly needle: string;
  readonly content: string;
}

const NEEDLE_PREFIX = 'crafttype-needle-';
const NEEDLE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const isValidNeedleName = (name: string): boolean => NEEDLE_NAME.test(name);

/** Texte à placer dans le fichier généré, dans un commentaire propre à son langage : `// crafttype-needle-x`. */
export const needleToken = (name: string): string => `${NEEDLE_PREFIX}${name}`;

/**
 * Insère le bloc avant la ligne du repère, avec l'indentation de cette ligne. Le repère reste en place pour les modules
 * suivants. Si le bloc est déjà dans le fichier (mêmes lignes à l'indentation près), le contenu est rendu tel quel :
 * réappliquer un module ne duplique rien.
 *
 * Le repère doit apparaître exactement une fois : un fichier où il manque ou se répète a été modifié à la main, et
 * deviner l'endroit risquerait de casser le code de l'équipe.
 */
export const insertAtNeedle = (fileContent: string, { path, needle, content }: FileEdit): string => {
  const eol = fileContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = fileContent.split(eol);
  const token = needleToken(needle);
  // Le caractère qui suit ne doit pas prolonger le nom : `main` ne désigne pas `main-imports`.
  const pattern = new RegExp(`${token.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);

  const found = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []));
  const [index] = found;
  if (index === undefined) {
    throw new NeedleError(path, token, 'repère introuvable : le fichier a été modifié, ou généré par une version plus ancienne du module qui le crée. Ajoutez à la main une ligne de commentaire contenant ce repère là où le code doit être inséré');
  }
  if (found.length > 1) {
    throw new NeedleError(path, token, `repère présent ${found.length} fois : il doit être unique`);
  }

  const block = content.replace(/(\r?\n)+$/, '').split(/\r?\n/);
  if (containsLines(lines, block)) {
    return fileContent;
  }

  const indent = /^[ \t]*/.exec(lines[index] ?? '')?.[0] ?? '';
  const indented = block.map((line) => (line.trim() === '' ? '' : `${indent}${line}`));
  return [...lines.slice(0, index), ...indented, ...lines.slice(index)].join(eol);
};

const containsLines = (lines: readonly string[], block: readonly string[]): boolean => {
  const wanted = block.map((line) => line.trim());
  const existing = lines.map((line) => line.trim());
  return existing.some((_, start) => wanted.every((line, offset) => existing[start + offset] === line));
};
