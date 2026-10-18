---
"@slidesend/aws": patch
---

The workflow `slidesend` writes for a talk pins `actions/setup-node` v7.1.0 (was v7.0.0), the same pin the repository's own workflows use. An existing talk can update the `setup-node` line of its `.github/workflows/deploy.yml` to `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`.
