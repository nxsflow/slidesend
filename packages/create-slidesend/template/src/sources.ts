/**
 * This project's own source files, as text, for the code block in plugin.tsx. Vite reads them
 * when a page renders the block. It lives in a file of its own because a glob never includes the
 * file it is written in, and plugin.tsx shows its own code.
 *
 * Nothing but a rendered block calls this, so a server bundle without Vite can import it safely.
 */
export function sources(): Record<string, string> {
  return import.meta.glob(["./*.{ts,tsx}", "../*.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  });
}
