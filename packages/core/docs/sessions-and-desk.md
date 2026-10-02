# Sessions and the desk

A **session** is one run of the talk: a rehearsal on Tuesday, the live talk on Thursday, the
same talk again next month. The **desk** at `/desk` is where you prepare, hold and review it.
Both need a platform (AWS, or the dev bridge from [getting-started](getting-started.md#5-phones-still-without-a-cloud-account));
in local mode the desk drives the stage in the same browser, and no audience can join.

## Sessions

Every session is its own room: cursor, answers, agent conversations, presence and timings are
kept per session. Clock times belong here, never in the deck.

| Field | Meaning |
|---|---|
| `kind` | `rehearsal` or `live`. |
| `name` | Shown in the desk and on the phones' closed page. |
| `plannedStart` | Optional date and time with zone; an armed session opens before it. |
| `plannedMinutes` | The session's length; defaults to the deck's planned minutes. |
| `leadMinutes` | How long before `plannedStart` an armed session opens; default 10. |
| `graceMinutes` | How long after its planned end an open session closes on its own; default 15. |
| `closedPageMinutes` | How long phones show the closed page afterwards; default 15. |

A session moves through `draft` → `armed` → `open` → `closed`.

- **Door and clock are separate.** `open` means phones may join. The talk clock starts with the
  first step forward.
- **Arming** opens the session `leadMinutes` before `plannedStart` without anyone at the desk.
- **Auto-close** is the cost guard for a forgotten session: an open session closes after its
  planned length plus grace. The desk can extend it by ten minutes at a time.
- **At most one live session is open at a time.** Rehearsals may run while a live session is
  open; the desk warns and names the device in control.
- **Nothing that costs money runs outside an open session.** Every answer and every agent
  question is refused before the session opens and after it closes.

## Addresses

| View | Address |
|---|---|
| Phones, live session | `/` |
| Phones, rehearsal | `/r/<joinToken>`; a rehearsal has its own random join token |
| Stage | `/stage/<sessionId>`, opened from the desk |
| Desk | `/desk` |
| Print | `/print` |

Phones always come back to the right slide on their own: after a reconnect, after the phone was
locked, when the network returns.

## Control

One **control secret** per deployment decides who steers. `slidesend dev` and `slidesend deploy`
print a desk link with the secret in the address fragment, `/desk#key=...`; `slidesend open`
prints it again. A fragment is never sent to a server and appears in no log. The desk stores the
secret and removes it from the address bar at once. Without it, the desk is view-only.

Hand the link only to whoever runs the talk. **Hand over control** in the desk forgets the
secret on that device.

## The desk

Three tabs, in the order you need them.

### Prepare

Reads top to bottom like a checklist:

- **Control**: whether this device holds control, always visible; a field for the secret. Name
  the device here, so that warnings on other desks can say who is in control.
- **Session**: create, select, open, arm, close, extend. Warnings when a live session is open
  elsewhere or another desk is on the same session.
- **Join**: the phone address with a QR code, and **Open the stage**. The stage opens in a new
  window, already authorized and bound to the selected session.
- **Deck**: the result of validation: slides, steps, planned minutes against the session length.

### Present

A fixed layout with nothing destructive in it: what is on stage now and next, the phones'
activity with its live tile, the notes in large type, the cue highlighted, the clock (elapsed,
planned, ahead or behind), and who is connected (stages, desks, phones). If no stage is
connected, Present says so and offers to open one.

Keys: → or space next, ← previous, **G** jump to a slide (grouped by chapter), **?** the list of
shortcuts. The stage window steers with the same keys and a presenter remote once it holds the
secret.

### Review

Per session:

- **Timings**: planned against measured per step. Steps with an activity are preselected for an
  estimate of audience time; unusually long dwell times are flagged.
- **Adopt as plan** stores the measurement as the plan. An adopted plan wins over the deck's
  `minutes` until the deck's timing changes; then it lapses with a notice.
- **Copy the analysis prompt** puts a short table (slide, planned, measured, audience time, the
  target) and two instructions into the clipboard for a coding agent: write the values into the
  deck as `minutes`, and propose cuts only if the total exceeds the target.
- **Export responses** downloads every answer of the session.
- **Delete session data** is the only destructive function, and it lives only here.

When a rehearsal closes, the desk asks whether it was a timed run; "no" discards its timings.
Nothing is adopted automatically.

## A rehearsal, end to end

1. Prepare: create a session of kind *Rehearsal*, open it, open the stage.
2. Point a phone at the rehearsal address under Join (`/r/<token>`).
3. Present: talk through the deck. Phones answer; the stage shows the results.
4. Close the session and answer "Was it a timed run?".
5. Review: compare, adopt as plan or copy the prompt, export, delete the data.

A live session works the same, at `/` instead of `/r/<token>`, and is usually armed with a
planned start rather than opened by hand.
