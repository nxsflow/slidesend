# Sessions and the desk

A **session** is one run of the talk: a rehearsal on Tuesday, the live talk on Thursday, the
same talk again next month. The **desk** at `/desk` is where you start, hold and review it.
Both need a platform (AWS, or the dev bridge from [getting-started](getting-started.md#2-run-it));
in local mode the desk only opens the stage in the same browser, where you step through it with
the keyboard, and no audience can join.

## Sessions

Every session is its own room: cursor, answers, agent conversations, presence and timings are
kept per session. Clock times belong here, never in the deck.

| Field | Meaning |
|---|---|
| `kind` | `rehearsal` or `live`. |
| `name` | Shown in the desk and on the phones' closed page. |
| `plannedStart` | Optional date and time with zone; an armed session opens before it. |
| `plannedMinutes` | The session's length. On AWS, the deck's planned minutes; with the dev bridge, `defaultPlannedMinutes` from `vite.config.ts`. |
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
| Storyboard | `/storyboard`: the whole talk on one page |

Phones always come back to the right slide on their own: after a reconnect, after the phone was
locked, when the network returns. On AWS a phone also opens its live connection afresh whenever it wakes up,
because a locked phone's connection can die without anyone noticing, and then reads what it
missed: the slide and the answers.

## Control

One **control secret** per deployment decides who steers. The dev server (`npm run dev`) and
`slidesend deploy` print a desk link with the secret in the address fragment, `/desk#key=...`;
`slidesend open` prints it again. Local mode (`slidesend dev` without a platform) needs no key. A fragment is never sent to a server and appears in no log. The desk stores the
secret and removes it from the address bar at once. Without it, the desk is view-only.

Hand the link only to whoever runs the talk. A browser without the key sees the desk as **view
only**, with a field to paste the key. **Remove control from this device**, in the desk's menu
(⋯), forgets the key on that device.

## The desk

One flow, for someone who has never held a talk with it: **Start → Present → Review**.

### Start

The talk's title, length and number of steps, and whether this device is in control. Then two
large choices:

- **Rehearse** — try the talk out. Phones join with the rehearsal's private address, and every
  step is timed.
- **Go live** — the real talk. The audience joins at `/` with the code on the stage.

One click creates the session, opens it and switches to Present; the name comes from the kind and
the date. A reload, e.g. when the dev server reloads the page after an edit, comes
back to the session this tab presented. While a session is open, the start page puts it first, with **Continue presenting**; Rehearse and
Go live stay below it, under "Or start another session".

Folded away below:

- **Plan a talk for later**: a start time, the kind and an optional name. The session is armed:
  it opens by itself `leadMinutes` before the start and closes after the talk.
- **Earlier sessions**: every session with what can be done with it — present an open one, open
  or cancel a planned one, review any of them.

Warnings appear on the start page when a live session is open elsewhere or another desk is on the
same session. The menu (⋯) names this device (proposed from its system and browser), so that the
warnings on other desks can say who is in control.

### Present

Dark, for a dark room, and laid out for reading aloud:

- **Header**: **← Start page** (the session keeps running), the chapter in its accent colour and the slide, the step counter, the clock
  (elapsed time and how far ahead or behind the plan, in colour), the session's kind, the
  connected stages and phones, when it closes, and **+10 min**.
- **Left**: what is on stage now (with **Fullscreen**), what comes next, the phones' activity with its live tile, and
  the join address with its QR code.
- **Right**: the cue, highlighted, and the speaker notes in large type.
- **Bottom bar**: Back, **Jump** (also **G**: every slide, grouped by chapter), **?** (the
  shortcuts), **End session**, Next.

If no stage is connected, a slim banner says so with **Open the stage**: the stage opens in a new
window, already authorized and bound to the session. Keys: →, ↓, PageDown or space next; ←, ↑ or
PageUp back; Home and End the first and last step; **G** jump; **?** shortcuts; Esc closes an
overlay. The stage window steers with the same keys and a
presenter remote once it holds the key.

**End session** asks first: for a rehearsal, whether it was a timed run ("no" discards its
times); for a live session, whether to end it. Then the desk shows the session's review. Nothing
in Present deletes data.

### Review

Per session, after it ended or from **Earlier sessions**:

- **Timings**: planned against measured per step. Steps with an activity are preselected for an
  estimate of audience time; unusually long dwell times are flagged.
- **Adopt as plan** stores the measurement as the plan. An adopted plan wins over the deck's
  `minutes` until the deck's timing changes; then it lapses with a notice. **Discard the plan**
  removes it.
- **Copy the analysis prompt** puts a short table (slide, planned, measured, audience time, the
  target) and two instructions into the clipboard for a coding agent: write the values into the
  deck as `minutes`, and propose cuts only if the total exceeds the target.
- **Export responses** downloads the session as JSON: its record, every answer and the timings.
- **Delete session data** is the only destructive function, and it lives only here. It works
  only after the session has ended, and keeps the session in the list.

Nothing is adopted automatically.

## A rehearsal, end to end

1. Start: **Rehearse**. The desk opens the rehearsal and switches to Present.
2. **Open the stage** from the banner; point a phone at the code on the stage (`/r/<token>`).
3. Talk through the deck. Phones answer; the stage shows the results.
4. **End session** and answer "Was it a timed run?".
5. Review: compare, adopt as plan or copy the prompt, export, delete the data.

A live session works the same with **Go live**, at `/` instead of `/r/<token>`, or planned ahead
with **Plan a talk for later**.
