import eslint from '@eslint/js';
import babelParser from '@babel/eslint-parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.crafttype/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ['@babel/preset-typescript'],
        },
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
];
