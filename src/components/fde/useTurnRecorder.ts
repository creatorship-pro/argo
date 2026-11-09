"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api, type Id } from "@/lib/convex";
import { SegmentRecorder, keepAwake } from "@/lib/capture/recorder";
import { UploadQueue } from "@/lib/capture/upload-queue";

type Payload = { blob: Blob; text?: string };

/**
 * Records one guest turn on the iPad. Consent must already be on record (the
 * server refuses to start a turn otherwise). Audio stays in memory on the iPad
 * until its segment has been transcribed and stored; segments retry in order
 * after a dropped connection. Only transcript text ever reaches Convex.
 */
export function useTurnRecorder(
  guestId: Id<"guests">,
  onStatus?: (recording: boolean) => void,
) {
  const startTurn = useMutation(api.capture.startTurn);
  const endTurn = useMutation(api.capture.endTurn);
  const addTranscript = useMutation(api.capture.addTranscript);

  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<SegmentRecorder | null>(null);
  const queue = useRef<UploadQueue<Payload> | null>(null);
  const turnId = useRef<Id<"turns"> | null>(null);
  const release = useRef<() => void>(() => {});

  const flush = useCallback(async () => {
    const q = queue.current;
    if (!q) return;
    await q.flush();
    setPending(q.pending);
  }, []);

  // Segments that could not upload while offline go again when the network returns.
  useEffect(() => {
    const again = () => void flush();
    window.addEventListener("online", again);
    const id = setInterval(() => {
      if ((queue.current?.pending ?? 0) > 0) void flush();
    }, 15_000);
    return () => {
      window.removeEventListener("online", again);
      clearInterval(id);
    };
  }, [flush]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const id = await startTurn({ guestId });
      turnId.current = id;
      queue.current = new UploadQueue<Payload>(async (seg) => {
        const p = seg.payload;
        if (p.text === undefined) {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: p.blob,
            headers: { "content-type": p.blob.type || "audio/mp4" },
          });
          if (!res.ok) throw new Error("transcribe");
          p.text = ((await res.json()) as { text: string }).text;
        }
        await addTranscript({ turnId: id, index: seg.index, text: p.text });
      });
      recorder.current = new SegmentRecorder(stream, (blob) => {
        queue.current?.push({ blob });
        setPending(queue.current?.pending ?? 0);
        void flush();
      });
      recorder.current.start();
      release.current = await keepAwake();
      setStartedAt(Date.now());
      setRecording(true);
      onStatus?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording.");
    }
  }, [guestId, startTurn, addTranscript, flush, onStatus]);

  const stop = useCallback(async () => {
    await recorder.current?.stop();
    recorder.current = null;
    release.current();
    setRecording(false);
    setStartedAt(null);
    onStatus?.(false);
    await flush();
    if (turnId.current)
      await endTurn({ turnId: turnId.current }).catch(() => {});
  }, [flush, endTurn, onStatus]);

  return { recording, startedAt, pending, error, start, stop };
}
