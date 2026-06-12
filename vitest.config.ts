import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer/src"),
      "@locales": resolve("src/locales"),
      "@resources": resolve("resources"),
      "@shared": resolve("src/shared"),
      "@types": resolve("src/types/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
