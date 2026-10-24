import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist', '**/node_modules', 'film/out', 'film/out-e2e', 'apps/demo/public'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // noUncheckedIndexedAccess makes every typed-array read optional; the loops here stay in bounds.
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
)
