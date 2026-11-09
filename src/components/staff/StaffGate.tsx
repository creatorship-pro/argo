"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { canSee, type StaffRole } from "@/lib/access/staff";

/**
 * Wraps staff-only screens. The real checks happen in Convex on every call;
 * this only decides what to show.
 */
export function StaffGate({
  roles,
  children,
}: {
  roles: readonly StaffRole[];
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.staff.me, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && me === undefined)) {
    return <Notice>Loading…</Notice>;
  }
  if (!isAuthenticated) {
    return (
      <Notice>
        <p>Sign in to continue.</p>
        <Link
          href="/sign-in"
          className="mt-4 inline-block rounded-xl bg-zinc-900 px-6 py-4 text-xl text-white"
        >
          Staff sign in
        </Link>
      </Notice>
    );
  }
  if (!me)
    return (
      <Notice>This email is not on the staff list. Ask Mezie to add it.</Notice>
    );
  if (!canSee(me.role, roles))
    return <Notice>This screen is not for your role ({me.role}).</Notice>;
  return <>{children}</>;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center text-2xl">
      {children}
    </main>
  );
}
