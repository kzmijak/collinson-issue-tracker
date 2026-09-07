export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // `spec` is mandated by CLAUDE.md for specification commits; config-conventional omits it.
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'spec',
        'style',
        'test',
      ],
    ],
    'subject-case': [0, 'never'],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0, 'always', 120],
  },
};
