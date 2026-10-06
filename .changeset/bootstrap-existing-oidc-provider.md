---
"@slidesend/aws": patch
---

`slidesend bootstrap` imports the account's existing GitHub OIDC provider instead of creating a second one, so a second talk in the same AWS account can deploy. A provider that the talk's own bootstrap stack created stays in that stack.
