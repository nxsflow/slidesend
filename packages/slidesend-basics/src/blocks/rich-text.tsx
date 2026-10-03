import type { ReactNode } from "react";

/**
 * The inline subset a deck may use in text (spec §17): `**bold**`, `*emphasis*` and a line
 * break as a newline. Everything else stays literal text, and nothing from a deck ever becomes
 * HTML: the text is turned into React elements, so `<script>` is shown, not run.
 */
export const richTextSyntax = "**bold**, *emphasis*, newline for a line break";

const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(pattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/** Renders a deck's text with the inline subset above. */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split("\n").flatMap((line, index) => {
    const rendered = inline(line, `l${index}`);
    // The line's position is its identity here: the text is fixed while it is shown.
    // biome-ignore lint/suspicious/noArrayIndexKey: see above
    const br = <br key={`br${index}`} />;
    return index === 0 ? rendered : [br, ...rendered];
  });
}
