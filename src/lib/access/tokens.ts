/**
 * Guest links. Guests never log in: they open their page by a private link or
 * QR code that carries a long random token. The token expires and can be
 * revoked. Only a hash of the token is stored, so a database leak does not
 * hand out working links.
 *
 * Uses Web Crypto, which exists in Node, in Convex and in browsers.
 */

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export type TokenState = "ok" | "expired" | "revoked" | "unknown";

export interface StoredLink {
  expiresAt: number;
  revokedAt?: number | null;
}

export function checkLink(
  link: StoredLink | null | undefined,
  now: number,
): TokenState {
  if (!link) return "unknown";
  if (link.revokedAt != null) return "revoked";
  if (now >= link.expiresAt) return "expired";
  return "ok";
}

/** "A few days after the event": a link lasts this long unless told otherwise. */
export const DEFAULT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A plausible token shape, to reject junk before touching the database. */
export function looksLikeToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(s);
}
