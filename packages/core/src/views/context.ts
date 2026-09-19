import { createContext, useContext } from "react";
import type { Presentation } from "../deck/presentation";

/** The presentation every view renders; `mount` provides it. */
export const PresentationContext = createContext<Presentation | null>(null);

/** The presentation of the surrounding view. Throws outside `PresentationContext`. */
export function usePresentation(): Presentation {
  const presentation = useContext(PresentationContext);
  if (!presentation) throw new Error("usePresentation needs a PresentationContext provider.");
  return presentation;
}

/** The UI strings of the surrounding presentation, in the talk's language (spec §6.5). */
export function useText() {
  return usePresentation().text;
}

/** A node's data as its component receives it: the node without core's envelope keys. */
export function nodeData(node: object, envelope: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!envelope.includes(key)) data[key] = value;
  }
  return data;
}
