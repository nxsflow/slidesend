---
"@slidesend/create": patch
"@slidesend/core": patch
---

A talk created with pnpm installs again under pnpm 12: the starter writes a `pnpm-workspace.yaml` that allows esbuild's install script. pnpm 12 failed the install over the ignored script (`ERR_PNPM_IGNORED_BUILDS`).
