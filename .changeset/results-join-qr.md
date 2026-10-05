---
"@slidesend/basics": minor
"@slidesend/core": patch
---

`pollMatrix`, `pollList` and `textList` take `qr: true`: a small join QR code beside the results, so latecomers can still join while the answers come in. It shows the running session's own address (a rehearsal's private link included) and nothing in local mode or in print. The plugins guide shows how a block of your own reads the join address (`useSessionInfo`, `joinUrl`).
