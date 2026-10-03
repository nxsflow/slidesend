# The nodes of @nxsflow/slidesend-basics

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

Every field of every node, from its schema. How to use them: [writing-slides](../../slidesend-core/docs/writing-slides.md#the-nodes-of-nxsflowslidesend-basics).

## `section`

A slide template.

| Field | Type | Required | Default |
|---|---|---|---|
| `chapter` | chapter id | yes |  |
| `id` | string |  |  |
| `title` | string | yes |  |
| `subtitle` | string |  |  |
| `hero` | boolean |  | `false` |
| `panels` | object[] |  | `[]` |
| `panels[].content` | block node |  |  |
| `panels[].centered` | boolean |  | `false` |
| `panels[].notes` | string |  |  |
| `panels[].cue` | string |  |  |
| `panels[].minutes` | number |  |  |
| `panels[].activity` | activity node |  |  |
| `panels[].print` | print rule |  |  |
| `notes` | string |  |  |
| `cue` | string |  |  |
| `minutes` | number |  |  |
| `activity` | activity node |  |  |
| `print` | print rule |  |  |

## `statement`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `text` | string | yes |  |
| `size` | "medium" \| "large" |  | `"large"` |

## `quote`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `text` | string | yes |  |
| `source` | string |  |  |

## `list`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `items` | string[] | yes |  |
| `ordered` | boolean |  | `false` |
| `columnsFrom` | number |  | `7` |

## `timeline`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `entries` | object[] | yes |  |
| `entries[].label` | string | yes |  |
| `entries[].text` | string |  |  |

## `diff`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `before` | object | yes |  |
| `before.label` | string | yes |  |
| `before.text` | string | yes |  |
| `after` | object | yes |  |
| `after.label` | string | yes |  |
| `after.text` | string | yes |  |
| `number` | object |  |  |
| `number.value` | string | yes |  |
| `number.caption` | string |  |  |

## `reveal`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `items` | object[] | yes |  |
| `items[].text` | string | yes |  |
| `items[].notes` | string |  |  |
| `items[].cue` | string |  |  |
| `items[].minutes` | number |  |  |
| `items[].activity` | activity node |  |  |
| `items[].print` | print rule |  |  |
| `ordered` | boolean |  | `false` |

## `image`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `src` | string | yes |  |
| `alt` | string | yes |  |
| `caption` | string |  |  |
| `fit` | "contain" \| "cover" |  | `"contain"` |

## `qr`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `caption` | string |  | `"Join on your phone"` |
| `size` | number |  | `420` |

## `pollMatrix`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `of` | activity id |  |  |
| `id` | string |  |  |
| `questions` | object[] |  |  |
| `questions[].id` | string | yes |  |
| `questions[].text` | string | yes |  |
| `questions[].short` | string |  |  |
| `questions[].options` | object[] | yes |  |
| `questions[].options[].id` | string | yes |  |
| `questions[].options[].label` | string | yes |  |
| `message` | string |  |  |

## `pollList`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `of` | activity id |  |  |
| `id` | string |  |  |
| `questions` | object[] |  |  |
| `questions[].id` | string | yes |  |
| `questions[].text` | string | yes |  |
| `questions[].short` | string |  |  |
| `questions[].options` | object[] | yes |  |
| `questions[].options[].id` | string | yes |  |
| `questions[].options[].label` | string | yes |  |
| `message` | string |  |  |

## `textList`

A block.

| Field | Type | Required | Default |
|---|---|---|---|
| `of` | activity id |  |  |
| `id` | string |  |  |
| `prompt` | string |  |  |
| `multiple` | boolean |  | `false` |
| `message` | string |  |  |
| `limit` | number |  | `8` |

## `poll`

An activity.

| Field | Type | Required | Default |
|---|---|---|---|
| `id` | string | yes |  |
| `questions` | object[] | yes |  |
| `questions[].id` | string | yes |  |
| `questions[].text` | string | yes |  |
| `questions[].short` | string |  |  |
| `questions[].options` | object[] | yes |  |
| `questions[].options[].id` | string | yes |  |
| `questions[].options[].label` | string | yes |  |
| `message` | string |  |  |
| `keep` | true, or { until: slide id } |  |  |

## `text`

An activity.

| Field | Type | Required | Default |
|---|---|---|---|
| `id` | string | yes |  |
| `prompt` | string | yes |  |
| `multiple` | boolean |  | `false` |
| `message` | string |  |  |
| `keep` | true, or { until: slide id } |  |  |

## `wait`

An activity.

| Field | Type | Required | Default |
|---|---|---|---|
| `id` | string | yes |  |
| `text` | string | yes |  |
| `message` | string |  |  |
| `keep` | true, or { until: slide id } |  |  |

## `link`

An activity.

| Field | Type | Required | Default |
|---|---|---|---|
| `id` | string | yes |  |
| `url` | string | yes |  |
| `label` | string | yes |  |
| `hint` | string |  |  |
| `privacy` | string |  |  |
| `message` | string |  |  |
| `keep` | true, or { until: slide id } |  |  |
