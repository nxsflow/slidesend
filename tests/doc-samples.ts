import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { repositoryRoot } from "./doc-snippets";

/**
 * Free-standing `ts` and `tsx` samples in the docs are compiled against the packages (spec §15).
 *
 * A fence's info string says how a sample is compiled:
 *
 * - ```` ```ts ```` — a module of its own.
 * - ```` ```ts file=src/main.ts ```` — that file of a talk project. A later sample of the same
 *   document sees every named file before it, so `main.ts` can import the config shown above it.
 * - ```` ```ts fragment ```` — a piece of a larger file, such as one field of a config. Not
 *   compiled; use it only where the surrounding code would hide what the sample is about.
 *
 * Samples embedded from the example talk are compiled with the example talk and skipped here.
 */

/** One code sample of a document. */
export interface Sample {
  language: "ts" | "tsx";
  /** The file it stands for, from `file=`. */
  file?: string;
  fragment: boolean;
  code: string;
  /** The line of the opening fence, 1-based. */
  line: number;
}

/** The `ts` and `tsx` samples of a document, outside embedded snippets. */
export function samplesOf(document: string): Sample[] {
  const lines = document.split("\n");
  const samples: Sample[] = [];
  let embedded = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as string;
    if (line.startsWith("<!-- snippet:")) embedded = true;
    if (line.startsWith("<!-- end snippet")) embedded = false;
    const fence = /^```(\S*)(.*)$/.exec(line);
    if (!fence) continue;
    const end = lines.findIndex((other, at) => at > index && other.startsWith("```"));
    const close = end < 0 ? lines.length : end;
    const [language, info] = [fence[1], fence[2] ?? ""];
    if (!embedded && (language === "ts" || language === "tsx")) {
      const file = /\bfile=(\S+)/.exec(info)?.[1];
      samples.push({
        language,
        ...(file ? { file } : {}),
        fragment: /\bfragment\b/.test(info),
        code: lines.slice(index + 1, close).join("\n"),
        line: index + 1,
      });
    }
    index = close;
  }
  return samples;
}

/** One file written for the compiler, and where its lines came from. */
interface Written {
  path: string;
  document: string;
  line: number;
}

/** A compile error, located in the document. */
export interface SampleProblem {
  document: string;
  line: number;
  message: string;
}

/**
 * Compiles the samples of the given documents in one run of `tsc`, in a scratch folder inside
 * `projectDir`'s `node_modules` (a talk project that has the packages), and returns every error
 * at its line in the document. The scratch folder is removed afterwards.
 */
export function compileSamples(
  documents: readonly { name: string; text: string }[],
  projectDir = join(repositoryRoot, "examples", "gravity"),
): SampleProblem[] {
  // One folder per run: test files run in parallel, and two runs must not share one. It sits in
  // the project's node_modules, so the packages still resolve, but outside what a Vite dev server
  // watches: a tsconfig.json appearing in the project made a parallel `slidesend check --render`
  // reload in the middle of its measurement.
  const scratch = join(
    projectDir,
    "node_modules",
    `.doc-samples-${process.pid}-${randomUUID().slice(0, 8)}`,
  );
  const written: Written[] = [];
  try {
    for (const { name, text } of documents) {
      const named = new Map<string, Sample>();
      samplesOf(text).forEach((sample, position) => {
        if (sample.fragment) return;
        const folder = join(scratch, name.replace(/[^\w-]/g, "_"), String(position));
        const own = sample.file ?? `sample.${sample.language}`;
        const files = new Map(named);
        files.set(own, sample);
        for (const [file, source] of files) {
          const path = join(folder, file);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, `${source.code}\n`);
          written.push({ path, document: name, line: source.line });
        }
        if (sample.file) named.set(sample.file, sample);
      });
    }
    if (written.length === 0) return [];
    writeFileSync(
      join(scratch, "tsconfig.json"),
      JSON.stringify({
        extends: relative(scratch, join(repositoryRoot, "tsconfig.base.json")),
        compilerOptions: { types: ["vite/client", "node"] },
        include: ["**/*.ts", "**/*.tsx"],
      }),
    );
    const tsc = createRequire(join(repositoryRoot, "package.json")).resolve("typescript/bin/tsc");
    const result = spawnSync(process.execPath, [tsc, "--project", scratch, "--pretty", "false"], {
      cwd: scratch,
      encoding: "utf8",
    });
    const problems: SampleProblem[] = [];
    for (const match of result.stdout.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+: .*)$/gm)) {
      const [, path, line, message] = match as unknown as [string, string, string, string];
      const source = written.find((entry) => entry.path === join(scratch, path));
      if (!source) {
        problems.push({ document: path, line: Number(line), message });
        continue;
      }
      // The fence is on `source.line`; the sample's first line is the one after it.
      problems.push({ document: source.document, line: source.line + Number(line), message });
    }
    if (result.status !== 0 && problems.length === 0) {
      problems.push({ document: "tsc", line: 0, message: result.stdout + result.stderr });
    }
    // One sample seen by several later ones would report its error once per copy.
    return problems.filter(
      (problem, index) =>
        problems.findIndex(
          (other) =>
            other.document === problem.document &&
            other.line === problem.line &&
            other.message === problem.message,
        ) === index,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
