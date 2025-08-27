module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always'],
    'scope-empty': [0, 'never'], // Allow empty scopes (optional scopes)
    'body-max-line-length': [2, 'always', 2000],
  },
};
