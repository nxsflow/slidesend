# A document with one sample that does not compile

```ts file=src/deck.ts
import { defineDeck } from "@nxsflow/slidesend-core";

export const deck = defineDeck({ meta: { title: "T", language: "en" }, chapters: [], slides: [] });
```

This one sees `src/deck.ts` above it, and misuses it:

```ts file=src/main.ts
import { deck } from "./deck";

const title: number = deck.meta.title;
```

```ts fragment
plugins: [this, is, not, compiled],
```
