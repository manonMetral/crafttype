import { describe, expect, it } from 'vitest';
import { NeedleError } from './errors.js';
import { insertAtNeedle, isValidNeedleName, needleToken } from './needles.js';

const edit = (content: string, needle = 'imports') => ({ path: 'src/main.ts', needle, content });

describe('insertAtNeedle', () => {
  const file = ['import a from "a";', '// crafttype-needle-imports', '', 'run();', ''].join('\n');

  it('insère le bloc juste avant le repère et garde le repère pour les modules suivants', () => {
    expect(insertAtNeedle(file, edit('import b from "b";'))).toBe(
      ['import a from "a";', 'import b from "b";', '// crafttype-needle-imports', '', 'run();', ''].join('\n'),
    );
  });

  it('reprend l’indentation de la ligne du repère, ligne vide comprise', () => {
    const indented = ['function f() {', '  // crafttype-needle-body', '}'].join('\n');

    expect(insertAtNeedle(indented, edit('a();\n\nb();', 'body'))).toBe(['function f() {', '  a();', '', '  b();', '  // crafttype-needle-body', '}'].join('\n'));
  });

  it('s’appuie sur le repère quel que soit le commentaire qui l’entoure', () => {
    const html = '<ul>\n  <!-- crafttype-needle-items -->\n</ul>';

    expect(insertAtNeedle(html, edit('<li>un</li>', 'items'))).toBe('<ul>\n  <li>un</li>\n  <!-- crafttype-needle-items -->\n</ul>');
  });

  it('ne duplique pas un bloc déjà présent, même ré-indenté ailleurs dans le fichier', () => {
    const once = insertAtNeedle(file, edit('import b from "b";'));

    expect(insertAtNeedle(once, edit('import b from "b";'))).toBe(once);
    expect(insertAtNeedle(once.replace('import b', '    import b'), edit('import b from "b";'))).toBe(once.replace('import b', '    import b'));
  });

  it('ajoute les blocs de plusieurs modules dans l’ordre d’application', () => {
    const twice = insertAtNeedle(insertAtNeedle(file, edit('import b from "b";')), edit('import c from "c";'));

    expect(twice.split('\n').slice(0, 4)).toEqual(['import a from "a";', 'import b from "b";', 'import c from "c";', '// crafttype-needle-imports']);
  });

  it('ignore les retours à la ligne en fin de bloc', () => {
    expect(insertAtNeedle(file, edit('import b from "b";\n\n'))).toBe(insertAtNeedle(file, edit('import b from "b";')));
  });

  it('respecte les fins de ligne CRLF du fichier', () => {
    const crlf = ['a', '// crafttype-needle-imports', 'b'].join('\r\n');

    expect(insertAtNeedle(crlf, edit('x\ny'))).toBe(['a', 'x', 'y', '// crafttype-needle-imports', 'b'].join('\r\n'));
  });

  it('ne confond pas un repère avec un autre dont le nom commence pareil', () => {
    const two = ['// crafttype-needle-main-imports', '// crafttype-needle-main'].join('\n');

    expect(insertAtNeedle(two, edit('x();', 'main'))).toBe(['// crafttype-needle-main-imports', 'x();', '// crafttype-needle-main'].join('\n'));
  });

  it('refuse un repère absent, en nommant le fichier et le repère', () => {
    const error = captured(() => insertAtNeedle('rien ici', edit('x', 'absent')));

    expect(error).toBeInstanceOf(NeedleError);
    expect(error.message).toContain('src/main.ts');
    expect(error.message).toContain('crafttype-needle-absent');
    expect(error.message).toContain('introuvable');
    expect(error.message).toContain('version plus ancienne');
  });

  it('refuse un repère présent plusieurs fois', () => {
    const twice = ['// crafttype-needle-imports', '// crafttype-needle-imports'].join('\n');

    expect(captured(() => insertAtNeedle(twice, edit('x')))).toBeInstanceOf(NeedleError);
    expect(captured(() => insertAtNeedle(twice, edit('x'))).message).toContain('2 fois');
  });
});

describe('noms de repère', () => {
  it.each(['imports', 'main-imports', 'a1', 'router-2'])('accepte %s', (name) => {
    expect(isValidNeedleName(name)).toBe(true);
  });

  it.each(['', 'Imports', 'main_imports', '-x', 'x-', 'a--b', '1a', 'a b', 'a.b'])('refuse %j', (name) => {
    expect(isValidNeedleName(name)).toBe(false);
  });

  it('préfixe le nom pour former le texte à poser dans le fichier', () => {
    expect(needleToken('main-imports')).toBe('crafttype-needle-main-imports');
  });
});

const captured = (action: () => unknown): Error => {
  try {
    action();
  } catch (error) {
    return error as Error;
  }
  throw new Error('une erreur était attendue');
};
