module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    '@react-native',
  ],
  ignorePatterns: ['android/**', 'ios/**'],
};
