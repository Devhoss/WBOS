import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.development") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [".e2e/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@prisma/client": path.resolve(__dirname, "./node_modules/@prisma/client"),
    },
  },
});
