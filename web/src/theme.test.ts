import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const theme = readFileSync(join(import.meta.dirname, 'styles', 'theme.css'), 'utf8');

const color = (name: string): string => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`).exec(theme)?.[1] ?? '';

const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (first: string, second: string): number => {
  const [light = 0, dark = 0] = [luminance(color(first)), luminance(color(second))].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

describe('theme contrast (WCAG AA: 4.5:1 for text)', () => {
  it.each([
    ['text', 'bg'],
    ['text', 'surface'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ['primary', 'bg'],
    ['primary', 'surface'],
    ['primary-strong', 'primary-soft'],
    ['on-primary', 'primary'],
    ['on-primary', 'primary-strong'],
    ['danger', 'bg'],
  ])('%s on %s', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the borders of controls visible against the background (3:1, WCAG 1.4.11)', () => {
    expect(contrast('primary', 'bg')).toBeGreaterThanOrEqual(3);
  });

  it('reads every color of the theme', () => {
    for (const name of [
      'bg',
      'surface',
      'text',
      'muted',
      'primary',
      'primary-strong',
      'primary-soft',
      'on-primary',
      'danger',
    ]) {
      expect(color(name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
