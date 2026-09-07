const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // These React Compiler-era hooks rules shipped as errors in this SDK's
    // eslint-config-expo bump. They flag long-standing, safe patterns already
    // used throughout this codebase (e.g. `useRef(x).current` lazy init,
    // syncing local state from props in an effect) — downgraded to warnings
    // rather than rewriting working code to satisfy brand-new heuristics.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);
