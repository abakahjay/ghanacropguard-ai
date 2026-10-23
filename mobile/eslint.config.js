// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      "import/resolver": { typescript: { project: "./jsconfig.json" }, node: true },
    },
    // Expo modules export from platform files (*.native.js) the static checker cannot see;
    // the Metro production bundle verifies imports instead (npx expo export).
    rules: { "import/namespace": "off" },
  },
  {
    files: ["src/__tests__/**", "jest.setup.js"],
    languageOptions: {
      globals: { jest: "readonly", describe: "readonly", test: "readonly", expect: "readonly", beforeEach: "readonly", afterEach: "readonly" },
    },
  },
  { ignores: ["dist/*", ".expo/*", "android/*", "ios/*"] },
]);
