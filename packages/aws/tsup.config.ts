import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts", "src/commands.ts", "src/infra.ts", "src/infra/app.ts"],
  // CDK is the talk project's, not ours: bundling it would give the stack a second copy of
  // `constructs` and break every `instanceof`.
  external: ["aws-cdk-lib", "constructs"],
  format: ["esm"],
  target: "es2023",
  // tsup sets `baseUrl` for its declaration build, which TypeScript 6 deprecates.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  sourcemap: true,
  clean: true,
});
