/**
 * Staff sign in with an email code, from an allowlist kept in the
 * STAFF_ALLOWLIST variable: `ana@example.com:fde,sam@example.com:facilitator`.
 * A bare email counts as `fde`. Codes are only sent to allowlisted emails.
 */
export type StaffRole = "fde" | "facilitator" | "admin";

export interface StaffMember {
  email: string;
  role: StaffRole;
}

const ROLES: readonly string[] = ["fde", "facilitator", "admin"];

export function parseAllowlist(raw: string | undefined): StaffMember[] {
  if (!raw) return [];
  const out: StaffMember[] = [];
  for (const part of raw.split(",")) {
    const [emailRaw, roleRaw] = part.trim().split(":");
    const email = emailRaw?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const role = (roleRaw?.trim().toLowerCase() || "fde") as string;
    if (!ROLES.includes(role)) continue;
    out.push({ email, role: role as StaffRole });
  }
  return out;
}

export function findStaff(
  list: StaffMember[],
  email: string | null | undefined,
): StaffMember | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return list.find((m) => m.email === e) ?? null;
}

export function canSee(
  role: StaffRole,
  allowed: readonly StaffRole[],
): boolean {
  return role === "admin" || allowed.includes(role);
}
