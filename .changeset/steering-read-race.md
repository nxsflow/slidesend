---
"@slidesend/core": patch
---

A desk or stage that steers is no longer pulled back a step when a read of the cursor lands while its own move is still on its way. The read returned the cursor before the move, and the window followed it.
