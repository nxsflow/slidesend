---
"@slidesend/aws": patch
"@slidesend/core": patch
"@slidesend/basics": patch
"@slidesend/agent": patch
"@slidesend/create": patch
---

Node.js 24 everywhere: the packages require Node.js 24 (`engines`), every Lambda of a deployed talk runs on `nodejs24.x` whatever runtime a library picks (the two library exceptions are named in a synth warning), the workflow `slidesend workflow` writes pins every action to a commit of a release that runs on Node.js 24, and the starter talk ships an `.nvmrc`.
