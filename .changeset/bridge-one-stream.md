---
"@slidesend/core": patch
---

The dev bridge serves all subscriptions of a page over one event stream. With a stream per subscription, desk, stage and phone in one browser used up the browser's six connections per host a few steps into the talk: the stage stopped following the desk, phones missed the current poll, and the desk counted no stage.
