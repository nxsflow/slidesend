---
"@slidesend/aws": patch
"@slidesend/core": patch
---

On AWS, a page that wakes up (visible again, back online, shown from the back-forward cache) opens every live subscription afresh and then reads what it missed. A connection that died silently while a phone was locked no longer leaves the phone deaf to answers and agent replies until the next reconnect. Two wake signals at once open each subscription only once.
