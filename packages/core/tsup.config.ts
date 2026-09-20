import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts", "src/testing.ts", "src/checks.ts", "src/cli.ts"],
  // Playwright belongs to the talk project that runs the checks, not to the bundle.
  external: ["@playwright/test"],
  format: ["esm"],
  target: "es2023",
  // tsup sets `baseUrl` for its declaration build, which TypeScript 6 deprecates.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  sourcemap: true,
  clean: true,
});
