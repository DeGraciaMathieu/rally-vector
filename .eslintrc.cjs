/* ESLint — TypeScript strict + règle de direction d'import entre couches (P5 / archi).
   Direction unique : data → domain ; systems → domain, data ; render → tout.
   Une couche ne connaît que les couches à sa gauche. */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-restricted-paths': 'off',
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // domain/ ne dépend de RIEN d'autre.
          { target: './src/domain', from: ['./src/data', './src/systems', './src/render'] },
          // data/ ne dépend que des types de domain/.
          { target: './src/data', from: ['./src/systems', './src/render'] },
          // systems/ ne dessine jamais.
          { target: './src/systems', from: ['./src/render'] },
        ],
      },
    ],
  },
  settings: {
    'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
    'import/resolver': { node: { extensions: ['.ts', '.js'] } },
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts'],
};
