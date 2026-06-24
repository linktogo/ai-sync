import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  js.configs.recommended,
  // vue3-essential: error-prevention rules only, no opinionated template
  // formatting (those live in strongly-recommended/recommended).
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Single-word component names (Card, Column) are intentional in this app.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Node-side files: dev server, build/tooling config, and their tests.
    files: [
      'server.js',
      'server.test.js',
      'vite.config.js',
      'postcss.config.js',
      'tailwind.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
