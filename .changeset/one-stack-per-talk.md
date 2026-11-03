---
"@slidesend/aws": patch
---

`slidesend deploy` works again on AWS Blocks 0.9.0. The hosting monitoring of AWS Blocks 0.9.0 adds a second stack in us-east-1 for the CloudFront alarm, and the deploy, which names no stack, stopped with "specify which stacks to use". The talk stack now turns the hosting monitoring off: its alarms went to an SNS topic nobody subscribed to. A deployed talk loses that topic on its next deploy. If a library adds a stack again, the synth stops and says so.
