const storageKey = "slidesend.device";

const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/**
 * This browser's device id: random, kept in local storage, and used to recognise a phone's own
 * responses when it comes back (spec §9). Participants never sign in; this is not an account.
 */
export function deviceId(): string {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return stored;
    const created = random();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    // Private windows can refuse storage; then the id lives as long as the page does.
    return random();
  }
}
