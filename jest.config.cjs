module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.cjs"],
  roots: ["<rootDir>/apps"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: {
          ignoreCodes: [151002]
        },
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json"
      }
    ]
  },
  collectCoverageFrom: ["apps/**/*.ts", "!apps/**/*.spec.ts", "!apps/**/main.ts"]
};
