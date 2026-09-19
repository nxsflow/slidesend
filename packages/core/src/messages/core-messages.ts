import { defineMessages } from "./catalog";

/**
 * The UI strings core itself shows. Everything a person reads in core's views comes from here,
 * so a talk can be held in any language (spec §6.5).
 */
export const coreMessages = defineMessages({
  en: {
    "core.view.unavailable": "The {view} view is not available yet.",
    "core.connection.lost": "Connection lost — trying again.",
    "core.connection.back": "Connected again.",
    "core.session.none": "No session is open.",
    "core.session.rehearsal": "Rehearsal",
    "core.session.live": "Live",
    "core.join.local": "Local mode: no audience can join.",
    "core.error.title": "Something went wrong.",
  },
});
