import type { z } from "zod";
import type { AnyDefinition } from "./define";

/** One field of a node's data, as the generated reference lists it (spec §15). */
export interface FieldRow {
  /** The field's path, e.g. `panels[].content`. */
  path: string;
  /** A readable type, e.g. `string`, `"medium" \| "large"`, `block node`. */
  type: string;
  required: boolean;
  /** The default as JSON, if the schema has one. */
  default?: string;
}

// Zod's definitions are internal API, but stable within a major version and the only way to read
// a schema back. Only the parts the reference needs are typed here.
interface Definition {
  type: string;
  innerType?: Schema;
  element?: Schema;
  in?: Schema;
  options?: Schema[];
  shape?: Record<string, Schema>;
  entries?: Record<string, string | number>;
  values?: unknown[];
  defaultValue?: unknown;
}
interface Schema {
  _zod: { def: Definition };
  description?: string;
}

const asSchema = (schema: z.ZodType) => schema as unknown as Schema;

/** Unwraps optional, default and nullable, and remembers what they said. */
function unwrap(schema: Schema) {
  let current = schema;
  let required = true;
  let nullable = false;
  let fallback: string | undefined;
  let description = schema.description;
  for (;;) {
    const def = current._zod.def;
    if (def.type === "optional" && def.innerType) required = false;
    else if (def.type === "default" && def.innerType) {
      required = false;
      fallback = JSON.stringify(def.defaultValue);
    } else if (def.type === "nullable" && def.innerType) nullable = true;
    else break;
    current = def.innerType;
    description ??= current.description;
  }
  return { schema: current, required, nullable, fallback, description };
}

/** A readable name for a schema's type; a description, where a slot or reference sets one, wins. */
function typeName(schema: Schema): string {
  const inner = unwrap(schema);
  const def = inner.schema._zod.def;
  let name: string;
  if (inner.description) name = inner.description;
  else if (def.type === "enum") {
    name = Object.values(def.entries ?? {})
      .map((value) => JSON.stringify(value))
      .join(" \\| ");
  } else if (def.type === "literal") {
    name = (def.values ?? []).map((value) => JSON.stringify(value)).join(" \\| ");
  } else if (def.type === "array" && def.element) name = `${typeName(def.element)}[]`;
  else if (def.type === "union") name = (def.options ?? []).map(typeName).join(" or ");
  else if (def.type === "pipe" && def.in) name = typeName(def.in);
  else if (def.type === "custom") name = "unknown";
  else name = def.type;
  return inner.nullable ? `${name} or null` : name;
}

/**
 * The fields of an object schema, nested objects and arrays of objects flattened into paths. A
 * field whose schema carries a description is one row: it names a shared shape, such as a slot.
 */
export function schemaFields(schema: z.ZodType, prefix = ""): FieldRow[] {
  const def = unwrap(asSchema(schema)).schema._zod.def;
  const rows: FieldRow[] = [];
  for (const [name, field] of Object.entries(def.shape ?? {})) {
    const path = `${prefix}${name}`;
    const inner = unwrap(field);
    rows.push({
      path,
      type: typeName(field),
      required: inner.required,
      ...(inner.fallback === undefined ? {} : { default: inner.fallback }),
    });
    if (inner.description) continue;
    const innerDef = inner.schema._zod.def;
    if (innerDef.type === "object") {
      rows.push(...schemaFields(inner.schema as unknown as z.ZodType, `${path}.`));
    } else if (innerDef.type === "array" && innerDef.element) {
      const element = unwrap(innerDef.element);
      if (!element.description && element.schema._zod.def.type === "object") {
        rows.push(...schemaFields(element.schema as unknown as z.ZodType, `${path}[].`));
      }
    }
  }
  return rows;
}

const groupNames = {
  slide: "A slide template",
  block: "A block",
  activity: "An activity",
} as const;

/**
 * The field reference of the given node definitions as Markdown: one table per node, generated
 * from its schema, so that the docs cannot drift from the code.
 */
export function nodeReferenceTable(definitions: readonly AnyDefinition[]): string {
  const sections = definitions.map((definition) => {
    const rows = schemaFields(definition.schema);
    if (definition.group === "slide") {
      rows.unshift(
        { path: "chapter", type: "chapter id", required: true },
        { path: "id", type: "string", required: false },
      );
    }
    const table = rows.map(
      (row) =>
        `| \`${row.path}\` | ${row.type} | ${row.required ? "yes" : ""} | ${row.default === undefined ? "" : `\`${row.default}\``} |`,
    );
    return [
      `## \`${definition.type}\``,
      "",
      `${groupNames[definition.group]}.`,
      "",
      "| Field | Type | Required | Default |",
      "|---|---|---|---|",
      ...table,
      "",
    ].join("\n");
  });
  return sections.join("\n");
}
