import { defineConfig } from "vitest/config";

// Vitest rulează doar testele unitare din src/. Testele E2E (e2e/*.spec.ts)
// sunt Playwright și se rulează separat cu `npm run test:e2e`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
