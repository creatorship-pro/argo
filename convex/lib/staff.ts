import type { GenericCtx } from "@convex-dev/better-auth";
import { authComponent } from "../auth";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  canSee,
  findStaff,
  parseAllowlist,
  type StaffMember,
  type StaffRole,
} from "../../src/lib/access/staff";

export async function getStaff(
  ctx: GenericCtx<DataModel>,
): Promise<StaffMember | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  return findStaff(parseAllowlist(process.env.STAFF_ALLOWLIST), user?.email);
}

export async function requireStaff(
  ctx: GenericCtx<DataModel>,
  roles?: readonly StaffRole[],
): Promise<StaffMember> {
  const staff = await getStaff(ctx);
  if (!staff) throw new Error("Not signed in as staff.");
  if (roles && !canSee(staff.role, roles))
    throw new Error("Not allowed for your role.");
  return staff;
}

/** An FDE may touch only their own guests. Facilitators and admins may touch any. */
export async function requireGuestAccess(
  ctx: QueryCtx,
  guestId: Id<"guests">,
): Promise<{ staff: StaffMember; guest: Doc<"guests"> }> {
  const staff = await requireStaff(ctx);
  const guest = await ctx.db.get(guestId);
  if (!guest) throw new Error("Guest not found.");
  if (staff.role === "fde" && guest.fdeEmail !== staff.email) {
    throw new Error("This guest is not assigned to you.");
  }
  return { staff, guest };
}
