module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'scope-case': [2, 'always', ['lower-case']],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', ['lower-case']]
  }
};
