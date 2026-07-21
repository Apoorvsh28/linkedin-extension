import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./tests/globalSetup.ts",
    env: {
      DATABASE_URL: "postgresql://lgx:lgx@localhost:5432/leadsdb_test",
      ANTHROPIC_API_KEY: "test-key-unused",
      PORT: "4001",
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
