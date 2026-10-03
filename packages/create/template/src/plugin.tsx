import { cssVariable, defineBlock, definePlugin } from "@slidesend/core";
import { z } from "zod";
import { sources } from "./sources";

/** The lines of a region marked by snippet comments, without their indentation. */
export function excerpt(source: string, region?: string): string | undefined {
  const lines = source.split("\n");
  if (!region) return source.trim();
  const start = lines.findIndex((line) => line.trim() === `// snippet: ${region}`);
  const length = lines.slice(start + 1).findIndex((line) => line.trim() === "// end snippet");
  if (start < 0 || length < 0) return undefined;
  const body = lines.slice(start + 1, start + 1 + length);
  const indent = Math.min(
    ...body.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return body.map((line) => line.slice(indent)).join("\n");
}

/** How the code block looks: the excerpt as large as fits, with a caption. */
function CodeView({ file, region, caption }: { file: string; region?: string; caption?: string }) {
  const key = file.startsWith("src/") ? `./${file.slice(4)}` : `../${file}`;
  const source = sources()[key];
  const text =
    source === undefined
      ? `${file} is not a file of this project.`
      : (excerpt(source, region) ?? `${file} has no snippet "${region}".`);
  const lines = text.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));
  // As large as fits: by height (lines) and by width (the longest line).
  const size = Math.max(14, Math.min(34, 660 / (lines.length * 1.35), 1500 / (longest * 0.62)));
  return (
    <figure style={{ margin: 0, display: "grid", gap: 16 }}>
      <pre
        style={{
          margin: 0,
          padding: "24px 32px",
          borderRadius: `var(${cssVariable("radius", "large")})`,
          background: `var(${cssVariable("color", "surface")})`,
          fontFamily: `var(${cssVariable("font", "mono")})`,
          fontSize: Math.floor(size),
          lineHeight: 1.35,
        }}
      >
        <code>{text}</code>
      </pre>
      <figcaption style={{ fontSize: 28, color: `var(${cssVariable("color", "textMuted")})` }}>
        {caption ?? file}
      </figcaption>
    </figure>
  );
}

// snippet: code-block
/** A block of this talk's own: a piece of this project's source code, on the stage. */
export const code = defineBlock({
  type: "code",
  schema: z.object({
    file: z.string(), // e.g. "src/deck.ts"
    region: z.string().optional(), // the name after "// snippet:" in that file
    caption: z.string().optional(),
  }),
  Component: ({ data }) => <CodeView {...data} />,
});
// end snippet

/** This talk's own plugin: the nodes it needs beyond @slidesend/basics. */
export const starterPlugin = definePlugin({ name: "starter", blocks: [code] });
