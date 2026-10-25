// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const betterTailwind = require('eslint-plugin-better-tailwindcss');
const importPlugin = require('eslint-plugin-import');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const globals = require('globals');

const TEMPLATE_RULES_DOC = 'See docs/design.md#template-rules.';

const FEATURE_FILES = ['src/app/**/*.html', 'src/app/**/*.ts'];
const BUILDING_BLOCK_FILES = ['src/app/shared/ui/**', 'src/app/shared/variants/**'];

module.exports = defineConfig([
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      eslintPluginPrettierRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: { ...globals.browser, ...globals.vitest },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { import: importPlugin, 'simple-import-sort': simpleImportSort },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../**'],
              message: 'Use src/... absolute imports instead of relative parents.',
            },
          ],
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/attributes-order': 'error',
    },
  },
  {
    files: ['src/**/*.html', 'src/**/*.ts'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: {
      'better-tailwindcss': { entryPoint: 'src/styles.css', tsconfig: 'tsconfig.json' },
    },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
    },
  },
  {
    files: FEATURE_FILES,
    ignores: BUILDING_BLOCK_FILES,
    plugins: { 'better-tailwindcss': betterTailwind },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '\\[',
              message: `Arbitrary values belong in a building block or a token. ${TEMPLATE_RULES_DOC}`,
            },
            {
              pattern: '^text-(xs|sm|base|lg|xl|[2-9]xl)$',
              message: `Use a text directive (appTitle, appBody, appMeta...) instead of $0. ${TEMPLATE_RULES_DOC}`,
            },
            {
              pattern: '^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$',
              message: `Use a text directive instead of $0. ${TEMPLATE_RULES_DOC}`,
            },
            {
              pattern: '^tracking-',
              message: `Use a text directive instead of $0. ${TEMPLATE_RULES_DOC}`,
            },
            {
              pattern: '^leading-',
              message: `Use a text directive instead of $0. ${TEMPLATE_RULES_DOC}`,
            },
          ],
        },
      ],
    },
  },
]);
