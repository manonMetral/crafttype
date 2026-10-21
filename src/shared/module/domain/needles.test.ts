import { describe, expect, it } from 'vitest';
import { NeedleError } from './errors.js';
import { insertAtNeedle, isValidNeedleName, needleToken } from './needles.js';

const edit = (content: string, needle = 'imports') => ({ path: 'src/main.ts', needle, content });

describe('insertAtNeedle', () => {
  const file = ['import a from "a";', '// crafttype-needle-imports', '', 'run();', ''].join('\n');

  it('inserts the block just before the needle and keeps the needle for the following modules', () => {
    expect(insertAtNeedle(file, edit('import b from "b";'))).toBe(
      ['import a from "a";', 'import b from "b";', '// crafttype-needle-imports', '', 'run();', ''].join('\n'),
    );
  });

  it('reuses the indentation of the needle line, blank line included', () => {
    const indented = ['function f() {', '  // crafttype-needle-body', '}'].join('\n');

    expect(insertAtNeedle(indented, edit('a();\n\nb();', 'body'))).toBe(
      ['function f() {', '  a();', '', '  b();', '  // crafttype-needle-body', '}'].join('\n'),
    );
  });

  it('relies on the needle whatever comment surrounds it', () => {
    const html = '<ul>\n  <!-- crafttype-needle-items -->\n</ul>';

    expect(insertAtNeedle(html, edit('<li>one</li>', 'items'))).toBe(
      '<ul>\n  <li>one</li>\n  <!-- crafttype-needle-items -->\n</ul>',
    );
  });

  it('does not duplicate a block that is already present, even re-indented elsewhere in the file', () => {
    const once = insertAtNeedle(file, edit('import b from "b";'));

    expect(insertAtNeedle(once, edit('import b from "b";'))).toBe(once);
    expect(insertAtNeedle(once.replace('import b', '    import b'), edit('import b from "b";'))).toBe(
      once.replace('import b', '    import b'),
    );
  });

  it('adds the blocks of several modules in the order of application', () => {
    const twice = insertAtNeedle(insertAtNeedle(file, edit('import b from "b";')), edit('import c from "c";'));

    expect(twice.split('\n').slice(0, 4)).toEqual([
      'import a from "a";',
      'import b from "b";',
      'import c from "c";',
      '// crafttype-needle-imports',
    ]);
  });

  it('ignores line breaks at the end of the block', () => {
    expect(insertAtNeedle(file, edit('import b from "b";\n\n'))).toBe(insertAtNeedle(file, edit('import b from "b";')));
  });

  it('respects the CRLF line endings of the file', () => {
    const crlf = ['a', '// crafttype-needle-imports', 'b'].join('\r\n');

    expect(insertAtNeedle(crlf, edit('x\ny'))).toBe(['a', 'x', 'y', '// crafttype-needle-imports', 'b'].join('\r\n'));
  });

  it('does not mix up a needle with another whose name starts the same way', () => {
    const two = ['// crafttype-needle-main-imports', '// crafttype-needle-main'].join('\n');

    expect(insertAtNeedle(two, edit('x();', 'main'))).toBe(
      ['// crafttype-needle-main-imports', 'x();', '// crafttype-needle-main'].join('\n'),
    );
  });

  it('rejects a missing needle, naming the file and the needle', () => {
    const error = captured(() => insertAtNeedle('nothing here', edit('x', 'absent')));

    expect(error).toBeInstanceOf(NeedleError);
    expect(error.message).toContain('src/main.ts');
    expect(error.message).toContain('crafttype-needle-absent');
    expect(error.message).toContain('not found');
    expect(error.message).toContain('older version');
  });

  it('rejects a needle present several times', () => {
    const twice = ['// crafttype-needle-imports', '// crafttype-needle-imports'].join('\n');

    expect(captured(() => insertAtNeedle(twice, edit('x')))).toBeInstanceOf(NeedleError);
    expect(captured(() => insertAtNeedle(twice, edit('x'))).message).toContain('2 times');
  });
});

describe('needle names', () => {
  it.each(['imports', 'main-imports', 'a1', 'router-2'])('accepts %s', (name) => {
    expect(isValidNeedleName(name)).toBe(true);
  });

  it.each(['', 'Imports', 'main_imports', '-x', 'x-', 'a--b', '1a', 'a b', 'a.b'])('refuse %j', (name) => {
    expect(isValidNeedleName(name)).toBe(false);
  });

  it('prefixes the name to form the text to place in the file', () => {
    expect(needleToken('main-imports')).toBe('crafttype-needle-main-imports');
  });
});

const captured = (action: () => unknown): Error => {
  try {
    action();
  } catch (error) {
    return error as Error;
  }
  throw new Error('an error was expected');
};
