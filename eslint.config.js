import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// 순수 계산 계층(domain)이 React·three에 의존하지 않도록 강제 (PLAN.md 3장)
const domainRestriction = {
  patterns: [
    { group: ['react', 'react-dom', 'react/*'], message: 'domain/은 React에 의존할 수 없습니다.' },
    { group: ['three', 'three/*', '@react-three/*'], message: 'domain/은 three.js에 의존할 수 없습니다.' },
    {
      group: ['**/components/*', '**/scene/*', '**/hooks/*', '**/contexts/*', '**/features/*', '**/data/*', '**/workers/*'],
      message: 'domain/은 다른 앱 계층을 import할 수 없습니다.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'scripts/.cache'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Provider와 전용 훅을 한 파일에 두는 Context 패턴은 Fast Refresh 경고 대상에서 제외
    files: ['src/contexts/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', domainRestriction] },
  },
  {
    files: ['src/workers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['react', 'react/*', 'three', '@react-three/*'], message: 'Worker는 domain/만 사용합니다.' }] },
      ],
    },
  },
);
