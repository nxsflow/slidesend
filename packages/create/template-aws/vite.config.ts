import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `aws-blocks` is the client AWS Blocks generates before `npm run dev` and `npm run build`. A run
// without AWS (`slidesend check --render`) has none, so the import points at an empty module.
export default defineConfig({
  plugins: [react()],
  resolve:
    process.env.VITE_SLIDESEND_PLATFORM === "aws"
      ? {}
      : { alias: { "aws-blocks": fileURLToPath(new URL("./src/no-blocks.ts", import.meta.url)) } },
});
