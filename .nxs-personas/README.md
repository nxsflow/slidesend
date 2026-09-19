# .nxs-personas

Who your agents are, and where they talk. nexus-chat reads this folder — nothing writes it but you.

## One file per persona: `<handle>.yaml`

```yaml
handle: coder
job_title: Implementer
job_description: Builds what the work order asks for, and says so when it cannot.
system_prompt: |
  You implement one task at a time and report back in the thread you were asked in.
```

Address it with `nxc send --to coder -`, with the request on STDIN — `… - <<'EOF'`, your
text, then `EOF` on its own line — so the shell evaluates nothing in it. A one-liner may be an
argument instead.

## The channels they share: `channels.yaml`

```yaml
- name: review
  members: [coder, reviewer]
  timeout: 30m
```

Address it with `nxc send --to review -`, the same way. A channel may also declare a `flow:` —
its members in order — and then a send walks that order step by step.

## Nothing is declared until it is in here

There are no built-in personas and no ad-hoc targets: `nxc send --to` reaches what this folder
declares, and nothing else. That is the point — a target that is declared is readable, reviewable,
and survives the run.
