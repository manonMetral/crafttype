import Mustache from 'mustache';
import type { TemplateRenderer } from '../../domain/ports.js';
import type { TemplateContext } from '../../domain/CraftModule.js';

export class MustacheTemplateRenderer implements TemplateRenderer {
  render(template: string, context: TemplateContext): string {
    // No HTML escaping: we generate code, not pages. A free text property must therefore be
    // validated by its module (see documentation/module-creation.md).
    return Mustache.render(template, context, {}, { escape: (value: unknown) => String(value) });
  }
}
