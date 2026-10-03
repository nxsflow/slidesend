# UI strings

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

A talk overrides any of these with `messages` in `presentation.config.ts`; an override of a key
that no installed package has is a validation error. Plugins ship their own keys the same way.

| Key | English |
|---|---|
| `core.connection.back` | Connected again. |
| `core.connection.lost` | Connection lost — trying again. |
| `core.desk.control.badge` | In control |
| `core.desk.control.enter` | Control key |
| `core.desk.control.explain` | This browser cannot steer the talk yet. Open the desk link that the dev server or “slidesend open” printed — it ends in #key=… — or paste the key here. |
| `core.desk.control.save` | Take control |
| `core.desk.control.title` | Take control of this talk |
| `core.desk.control.viewOnly` | View only |
| `core.desk.control.wrong` | That key does not work for this talk. |
| `core.desk.history.cancel` | Cancel the plan |
| `core.desk.history.open` | Open now |
| `core.desk.history.present` | Present |
| `core.desk.history.review` | Review |
| `core.desk.history.title` | Earlier sessions ({count}) |
| `core.desk.menu.device` | Name of this device |
| `core.desk.menu.deviceHint` | Other desks show it when they warn that this one is in control. |
| `core.desk.menu.open` | Settings |
| `core.desk.menu.release` | Remove control from this device |
| `core.desk.menu.releaseHint` | This browser forgets the key. Open the desk link again to steer. |
| `core.desk.meta` | {minutes} min · {steps} steps |
| `core.desk.name.live` | Talk, {when} |
| `core.desk.name.rehearsal` | Rehearsal, {when} |
| `core.desk.plan.hint` | It opens by itself shortly before the start and closes after the talk; you only open the stage. |
| `core.desk.plan.kind` | Kind |
| `core.desk.plan.name` | Name (optional) |
| `core.desk.plan.submit` | Plan it |
| `core.desk.plan.title` | Plan a talk for later |
| `core.desk.plan.when` | Start |
| `core.desk.presence.desks` | {count} desk(s) |
| `core.desk.presence.phones` | {count} phone(s) |
| `core.desk.presence.stages` | {count} stage(s) |
| `core.desk.present.back` | Start page |
| `core.desk.present.close` | Close |
| `core.desk.present.cue` | Cue |
| `core.desk.present.end` | End session |
| `core.desk.present.endCancel` | Keep going |
| `core.desk.present.endConfirm` | End it |
| `core.desk.present.endLive` | End the live session? Phones show the closing page. |
| `core.desk.present.extend` | +10 min |
| `core.desk.present.fullscreen` | Fullscreen |
| `core.desk.present.join` | Phones join at |
| `core.desk.present.jump` | Jump |
| `core.desk.present.jumpTitle` | Jump to a slide |
| `core.desk.present.last` | This is the last step. |
| `core.desk.present.next` | Next |
| `core.desk.present.noActivity` | Nothing to answer on this step. |
| `core.desk.present.noNotes` | No speaker notes for this step. |
| `core.desk.present.noStage` | The stage is not open yet. |
| `core.desk.present.notStarted` | the clock starts with the first step forward |
| `core.desk.present.notes` | Speaker notes |
| `core.desk.present.now` | Now on stage |
| `core.desk.present.openStage` | Open the stage |
| `core.desk.present.phones` | Phones · {count} |
| `core.desk.present.planned` | plan {time} |
| `core.desk.present.position` | {step} / {total} |
| `core.desk.present.previous` | Back |
| `core.desk.present.shortcuts` | → or space: next · ←: back · G: jump · ?: this list · Esc: close |
| `core.desk.review.adopt` | Adopt as plan |
| `core.desk.review.adopted` | Adopted. The plan now wins over the deck's minutes. |
| `core.desk.review.back` | Start page |
| `core.desk.review.column.audience` | Audience |
| `core.desk.review.column.measured` | Measured |
| `core.desk.review.column.planned` | Planned |
| `core.desk.review.column.step` | Step |
| `core.desk.review.copied` | The prompt is in the clipboard. |
| `core.desk.review.copy` | Copy the analysis prompt |
| `core.desk.review.delete` | Delete session data |
| `core.desk.review.deleteCancel` | Keep it |
| `core.desk.review.deleteConfirm` | Delete everything of “{session}” |
| `core.desk.review.deleted` | Deleted {keys} entries; {left} timings left. |
| `core.desk.review.empty` | This session has no measured times yet. |
| `core.desk.review.estimateHint` | 1:30 |
| `core.desk.review.export` | Export responses |
| `core.desk.review.exported` | Exported {responses} response(s). |
| `core.desk.review.flagged` | Much longer than planned. |
| `core.desk.review.plan` | A plan adopted on {when} is in force. |
| `core.desk.review.planClear` | Discard the plan |
| `core.desk.review.planLapsed` | The adopted plan lapsed: the deck's timing changed. |
| `core.desk.review.timed` | Was “{session}” a timed run? “No” discards its measured times. |
| `core.desk.review.timedNo` | No, discard them |
| `core.desk.review.timedYes` | Yes, keep the times |
| `core.desk.review.title` | Review of “{session}” |
| `core.desk.review.totals` | planned {planned} · measured {measured} + audience {audience} = {total} · target {target} min |
| `core.desk.review.visits` | (entered {visits} times, the first one counts) |
| `core.desk.sessions.closesAt` | open until {time} |
| `core.desk.sessions.live` | Live |
| `core.desk.sessions.opensAt` | opens at {time} |
| `core.desk.sessions.rehearsal` | Rehearsal |
| `core.desk.sessions.state.armed` | planned |
| `core.desk.sessions.state.closed` | ended |
| `core.desk.sessions.state.draft` | not opened |
| `core.desk.sessions.state.open` | open |
| `core.desk.start.another` | Or start another session |
| `core.desk.start.continue` | Continue presenting |
| `core.desk.start.live` | Go live |
| `core.desk.start.liveHint` | The real talk. The audience joins with the code on the stage. |
| `core.desk.start.local` | Local mode: the stage and this desk share this browser, and no audience can join. |
| `core.desk.start.openStage` | Open the stage |
| `core.desk.start.rehearse` | Rehearse |
| `core.desk.start.rehearseHint` | Try the talk out. Phones join with a private link, and every step is timed. |
| `core.desk.start.running` | “{name}” is running. |
| `core.desk.start.title` | How do you want to start? |
| `core.desk.title` | Desk |
| `core.desk.warning.liveOpen` | The live session “{name}” is open, controlled by {device}. |
| `core.desk.warning.secondDesk` | Another desk is on this session: {device}. |
| `core.desk.warning.unknownDevice` | another device |
| `core.error.title` | Something went wrong. |
| `core.join.local` | Local mode: no audience can join. |
| `core.print.counts` | {slides} slides · {steps} steps · {minutes} minutes planned |
| `core.session.live` | Live |
| `core.session.none` | No session is open. |
| `core.session.rehearsal` | Rehearsal |
| `core.storyboard.steps` | {steps} step(s) · {minutes} min |
| `core.view.unavailable` | The {view} view is not available yet. |
