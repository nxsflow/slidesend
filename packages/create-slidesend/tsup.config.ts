import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "es2023",
  sourcemap: true,
  clean: true,
});
