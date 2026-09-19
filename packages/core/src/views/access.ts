const storageKey = "slidesend.control";

/**
 * Takes the control secret from the address fragment (`#key=...`), keeps it in this browser and
 * removes it from the address bar at once (spec §11). A fragment never reaches a server or a log.
 * Returns the secret, from the fragment or from an earlier visit, or `undefined`.
 */
export function takeControlSecret(): string | undefined {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const fromAddress = fragment.get("key");
  try {
    if (fromAddress) {
      window.localStorage.setItem(storageKey, fromAddress);
      fragment.delete("key");
      const rest = fragment.toString();
      const { pathname, search } = window.location;
      window.history.replaceState(null, "", `${pathname}${search}${rest ? `#${rest}` : ""}`);
      return fromAddress;
    }
    return window.localStorage.getItem(storageKey) ?? undefined;
  } catch {
    // Storage can be blocked; then the secret lives only as long as this page.
    return fromAddress ?? undefined;
  }
}
