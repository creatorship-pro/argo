"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/lib/convex";

// Staff land on their own screen. Guests never come here: they open the
// private link or QR code they were given.
export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.staff.me, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (me?.role === "fde") router.replace("/fde");
    else if (me?.role === "facilitator") router.replace("/facilitator");
  }, [me, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">Argo</h1>
      <p className="max-w-md text-xl text-zinc-600">
        Event software for The Overhang.
      </p>
      {isLoading || (isAuthenticated && me === undefined) ? (
        <p className="text-xl text-zinc-500">Loading…</p>
      ) : !isAuthenticated || !me ? (
        <Link
          href="/sign-in"
          className="rounded-xl bg-zinc-900 px-8 py-4 text-2xl text-white"
        >
          Staff sign in
        </Link>
      ) : me.role === "admin" ? (
        <div className="flex gap-3">
          <Link
            href="/fde"
            className="rounded-xl bg-zinc-900 px-6 py-4 text-xl text-white"
          >
            FDE screens
          </Link>
          <Link
            href="/facilitator"
            className="rounded-xl bg-zinc-200 px-6 py-4 text-xl"
          >
            Run board
          </Link>
        </div>
      ) : null}
    </main>
  );
}
