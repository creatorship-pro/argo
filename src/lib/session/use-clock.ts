"use client";

import { useEffect, useState } from "react";
import { clockOffset } from "./run";

/**
 * Keeps this device's clock offset from the server, so timers count down from
 * server end times. It asks once, and again whenever the connection or the tab
 * comes back (after a wifi drop). Returns the offset and a ticking "now".
 */
export function useServerClock(tickMs = 250) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        const { now: server } = (await res.json()) as { now: number };
        const t1 = Date.now();
        // Assume the reply took half the round trip to arrive.
        if (!cancelled) setOffset(clockOffset(server + (t1 - t0) / 2, t1));
      } catch {
        /* keep the last offset */
      }
    }
    void sync();
    const onBack = () => void sync();
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return { offset, now };
}
