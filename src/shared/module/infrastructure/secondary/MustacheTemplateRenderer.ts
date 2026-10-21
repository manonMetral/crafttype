import Mustache from 'mustache';
import type { TemplateRenderer } from '../../domain/ports.js';
import type { TemplateContext } from '../../domain/CraftModule.js';

export class MustacheTemplateRenderer implements TemplateRenderer {
  render(template: string, context: TemplateContext): string {
    // Pas d'échappement HTML : on génère du code, pas des pages. Une propriété de texte libre doit donc être
    // validée par son module (voir documentation/module-creation.md).
    return Mustache.render(template, context, {}, { escape: (value: unknown) => String(value) });
  }
}
