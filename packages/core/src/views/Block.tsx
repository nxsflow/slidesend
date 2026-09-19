import type { BlockNode, SlideProps } from "../nodes/types";
import { nodeData, usePresentation } from "./context";

/** Props of `Block`: the block node from a slot, and the state its template passes on. */
export interface BlockViewProps extends Partial<Omit<SlideProps<unknown>, "data">> {
  node: BlockNode;
}

/**
 * Renders the block node in a slot (spec §6.2) with the block's own component. A template
 * passes the step within the block; a block that builds up counts its steps from 0.
 */
export function Block({
  node,
  step = 0,
  previousStep = null,
  direction = "forward",
  presence = "present",
}: BlockViewProps) {
  const { registry } = usePresentation();
  const definition = registry.definition(node.type);
  if (definition?.group !== "block") return null;
  const { Component } = definition;
  return (
    <Component
      data={nodeData(node, ["type"])}
      step={step}
      previousStep={previousStep}
      direction={direction}
      presence={presence}
    />
  );
}
