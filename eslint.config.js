import js from '@eslint/js';
import globals from 'globals';
import nx from '@nx/eslint-plugin';

export default [
  {
    ignores: [
      'node_modules/**',
      'wk/**',
      'docs/**',
      '.claude/**',
      '.superpowers/**',
      '**/dist/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:sync', onlyDependOnLibsWithTags: ['scope:shared', 'scope:sync'] },
            { sourceTag: 'scope:workspace', onlyDependOnLibsWithTags: ['scope:shared', 'scope:workspace'] },
            { sourceTag: 'scope:board', onlyDependOnLibsWithTags: ['scope:board'] },
          ],
        },
      ],
    },
  },
];
