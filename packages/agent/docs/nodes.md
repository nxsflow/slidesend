# The nodes of @slidesend/agent

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

Every field of the agent chat, from its schema. How to use it: [agents](agents.md).

## `agentChat`

An activity.

| Field | Type | Required | Default |
|---|---|---|---|
| `id` | string | yes |  |
| `agent` | agent id | yes |  |
| `singleTurn` | boolean |  | `false` |
| `suggestions` | string[] |  | `[]` |
| `message` | string |  |  |
| `keep` | true, or { until: slide id } |  |  |
